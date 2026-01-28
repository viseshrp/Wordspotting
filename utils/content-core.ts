import { browser } from 'wxt/browser';
import { getFromStorage, isValidObj, logit, compileSitePatterns, isUrlAllowedCompiled } from '@/utils/utils';
import { scanTextForKeywords, hashString } from '@/utils/scanner';

// State
let scanWorker: Worker | null = null;
const DEFAULT_CHUNK_SIZE = 150000;
const DEFAULT_CHUNK_OVERLAP = 200;
let scanRequestId = 0;
const workerRequests = new Map<number, { resolve: (...args: any[]) => void, reject: (...args: any[]) => void }>();
let workerFailed = false;

let lastScanSignature: string | null = null;
let idleHandle: any = null;
let currentScanController: AbortController | null = null;
let observer: MutationObserver | null = null;
let observerDebounce: any = null;
let lastSnapshot = { text: '', timestamp: 0 };

// Types
declare global {
    // Highlight is usually available in recent lib.dom.d.ts, avoiding conflict
    // var Highlight: any;
    interface CSS {
        highlights: any;
    }
}

export { hashString, debounce }; // Re-export for testing parity

export function resetScanSignature() {
    lastScanSignature = null;
}

export function resetContentState() {
    lastSnapshot = { text: '', timestamp: 0 };
    lastScanSignature = null;
}

export function getWordList(keyword_list: any, bodyText?: string) {
    const textToScan = typeof bodyText === 'string' ? bodyText : (document.body ? document.body.innerText : "");
    return scanTextForKeywords(keyword_list, textToScan);
}

export async function proceedWithSiteListCheck() {
    try {
        const items = await getFromStorage("wordspotting_website_list");
        const allowed_sites = items.wordspotting_website_list || [];
        const compiled = compileSitePatterns(allowed_sites);

        if (isUrlAllowedCompiled(location.href, compiled)) {
            deferUntilPageIdle();
            setupObserver();
        } else {
            logit("No matching allowed site. Idling.");
        }
    } catch (e) {
        console.error("Error in proceedWithSiteListCheck:", e);
    }
}

export function cancelScheduledScan() {
    if (idleHandle && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleHandle);
    } else if (idleHandle) {
        clearTimeout(idleHandle);
    }
    idleHandle = null;
    if (currentScanController) {
        currentScanController.abort();
        currentScanController = null;
    }
}

export function scheduleScan() {
    cancelScheduledScan();

    currentScanController = new AbortController();
    const run = () => performScan(currentScanController!.signal);

    if ('requestIdleCallback' in window) {
        idleHandle = (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
        idleHandle = setTimeout(run, 300);
    }
}

export function deferUntilPageIdle() {
    if (document.readyState === 'complete') {
        scheduleScan();
    } else {
        window.addEventListener('load', () => scheduleScan(), { once: true });
    }
}

export async function performScan(signal: AbortSignal) {
    try {
        if (signal?.aborted) return;
        // Check runtime availability
        if (!browser.runtime || !browser.runtime.id) return;

        const items = await getFromStorage(["wordspotting_word_list", "wordspotting_highlight_on", "wordspotting_highlight_color"]);
        const keyword_list = items.wordspotting_word_list;
        const highlightOn = items.wordspotting_highlight_on === true;
        const highlightColor = items.wordspotting_highlight_color || '#FFFF00';

        if (!isValidObj(keyword_list) || keyword_list.length === 0) {
            sendKeywordCount(0);
            if (highlightOn) clearHighlights();
            return;
        }

        const bodyText = await getBodyTextSnapshot(signal);
        if (signal?.aborted) return;

        const signature = `${highlightOn}:${bodyText.length}:${hashString(bodyText)}`;
        if (signature === lastScanSignature) {
            return;
        }

        lastScanSignature = signature;
        let foundCount = 0;

        if (highlightOn) {
            foundCount = await performHighlightScan(keyword_list, highlightColor, signal);
        } else {
            clearHighlights();
            foundCount = await performStandardScan(keyword_list, bodyText);
        }

        sendKeywordCount(foundCount);

    } catch (e) {
        console.error("Error in performScan:", e);
    }
}

export async function performStandardScan(keyword_list: any, bodyText: string) {
    let occurring_word_list: string[] = [];
    try {
        occurring_word_list = await scanWithWorker(keyword_list, bodyText) as string[];
    } catch (e) {
        console.warn("Worker scan failed, falling back", e);
        occurring_word_list = getWordList(keyword_list, bodyText);
    }
    return occurring_word_list.length;
}

export async function performHighlightScan(keyword_list: any, color: string, signal: AbortSignal) {
    try {
        const textNodes = getTextNodes(document.body);
        if (signal?.aborted) return 0;

        const chunks = textNodes.map((node, index) => ({
            id: index,
            text: node.nodeValue
        }));

        const results = await scanWithWorkerForHighlights(keyword_list, chunks);
        if (signal?.aborted) return 0;

        return applyHighlights(results, textNodes, color);

    } catch (e) {
        console.error("Highlight scan failed:", e);
        return performStandardScan(keyword_list, document.body.innerText);
    }
}

export async function scanWithWorkerForHighlights(keywordList: any, chunks: any[]) {
    const worker = await getScanWorkerAsync();
    if (!worker) {
        throw new Error("Worker not available for highlighting");
    }
    return new Promise<any>((resolve, reject) => {
        const id = ++scanRequestId;
        workerRequests.set(id, { resolve, reject });
        worker.postMessage({
            type: 'scan_for_highlights',
            id,
            keywords: keywordList,
            chunks
        });
    });
}

export function getTextNodes(root: Node) {
    const nodes: Node[] = [];
    if (!root) return nodes;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (node.parentNode && ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes((node.parentNode as Element).tagName)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    let node = walker.nextNode();
    while (node) {
        nodes.push(node);
        node = walker.nextNode();
    }
    return nodes;
}

export function applyHighlights(results: any, textNodes: Node[], color: string) {
    if (!('highlights' in CSS)) return 0;

    const ranges: Range[] = [];
    const foundKeywords = new Set<string>();

    for (const [idStr, matches] of Object.entries(results)) {
        const id = parseInt(idStr, 10);
        const node = textNodes[id];
        if (!node) continue;

        for (const match of (matches as any[])) {
            try {
                const range = new Range();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match.length);
                ranges.push(range);
                foundKeywords.add(match.keyword);
            } catch (_e) {
            }
        }
    }

    const highlight = new Highlight(...ranges);
    CSS.highlights.set('wordspotting-match', highlight);
    updateHighlightStyle(color);
    return foundKeywords.size;
}

export function clearHighlights() {
    if ('highlights' in CSS) {
        CSS.highlights.delete('wordspotting-match');
    }
}

let highlightStyleElement: HTMLStyleElement | null = null;
export function updateHighlightStyle(color: string) {
    if (!highlightStyleElement) {
        highlightStyleElement = document.createElement('style');
        document.head.appendChild(highlightStyleElement);
    }
    highlightStyleElement.textContent = `
        ::highlight(wordspotting-match) {
            background-color: ${color};
            color: black;
        }
    `;
}

function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: any = null;
    function debounced(...args: any[]) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    }
    debounced.cancel = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
    };
    return debounced;
}

export async function getBodyTextSnapshot(signal: AbortSignal) {
    const now = Date.now();
    const cacheWindow = 500;
    if (now - lastSnapshot.timestamp < cacheWindow) {
        return lastSnapshot.text;
    }
    if (signal?.aborted) return '';
    const text = document.body ? document.body.innerText || '' : '';
    lastSnapshot = { text, timestamp: now };
    return text;
}

export async function getScanWorkerAsync() {
    if (workerFailed) return null;
    if (scanWorker) return scanWorker;

    try {
        const workerUrl = browser.runtime.getURL('/js/scan-worker.js');
        const scannerUrl = browser.runtime.getURL('/js/scanner.js');

        const [workerRes, scannerRes] = await Promise.all([
            fetch(workerUrl),
            fetch(scannerUrl)
        ]);

        const workerCode = await workerRes.text();
        const scannerCode = await scannerRes.text();

        const combinedCode = `${scannerCode}\n${workerCode}`;
        const blob = new Blob([combinedCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        scanWorker = new Worker(blobUrl);
        setupWorkerListeners(scanWorker);
        return scanWorker;
    } catch (e) {
        console.warn("Wordspotting worker creation failed (inline blob):", e);
        workerFailed = true;
        return null;
    }
}

export function setupWorkerListeners(worker: Worker) {
    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', (e) => {
        console.warn("Wordspotting worker error:", e);
        workerFailed = true;
        cleanupWorker();
    });
}

export function handleWorkerMessage(event: MessageEvent) {
    const data = event.data || {};
    if (typeof data.id !== 'number') return;
    const pending = workerRequests.get(data.id);
    if (!pending) return;
    workerRequests.delete(data.id);

    if (data.type === 'scan_result') {
        pending.resolve(Array.isArray(data.words) ? data.words : []);
    } else if (data.type === 'scan_highlights_result') {
        pending.resolve(data.results || {});
    } else if (data.type === 'scan_error') {
        pending.reject(new Error(data.error || 'Worker scan failed'));
    }
}

export function cleanupWorker() {
    if (scanWorker) {
        scanWorker.terminate();
        scanWorker = null;
    }
    workerRequests.forEach((pending) => {
        pending.reject(new Error('Worker terminated'));
    });
    workerRequests.clear();
}

export async function scanWithWorker(keywordList: any, text: string) {
    const worker = await getScanWorkerAsync();
    if (!worker) {
        return scanTextForKeywords(keywordList, text);
    }
    return new Promise((resolve, reject) => {
        const { chunkSize, overlap } = getChunkingConfig(text, keywordList);
        const id = ++scanRequestId;
        workerRequests.set(id, { resolve, reject });
        worker.postMessage({
            type: 'scan',
            id,
            keywords: keywordList,
            text,
            chunkSize,
            overlap
        });
    });
}

export function getChunkingConfig(text: string, keywordList: any) {
    const length = typeof text === 'string' ? text.length : 0;
    let chunkSize = DEFAULT_CHUNK_SIZE;
    let overlap = DEFAULT_CHUNK_OVERLAP;

    if (length > 800000) {
        chunkSize = 300000;
        overlap = 400;
    } else if (length > 300000) {
        chunkSize = 200000;
        overlap = 300;
    } else if (length > 120000) {
        chunkSize = 160000;
        overlap = 240;
    }

    const longestKeyword = Array.isArray(keywordList)
        ? keywordList.reduce((max: number, k: string) => (typeof k === 'string' && k.length > max ? k.length : max), 0)
        : 0;
    overlap = Math.max(overlap, Math.min(longestKeyword, 800));

    return { chunkSize, overlap };
}

export function sendKeywordCount(count: number) {
    try {
        browser.runtime.sendMessage({
            wordfound: count > 0,
            keyword_count: count
        }).catch(() => {});
    } catch (err) {
        void err;
    }
}

export function setupObserver() {
    const config = { childList: true, subtree: true, characterData: true };
    observerDebounce = debounce(() => {
        scheduleScan();
    }, 500);

    observer = new MutationObserver(observerDebounce);
    if (document.body) {
        observer.observe(document.body, config);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (observer) observer.disconnect();
            cancelScheduledScan();
        } else {
            if (document.body && observer) {
                observer.observe(document.body, config);
            }
            scheduleScan();
        }
    });

    window.addEventListener('pagehide', () => {
        if (observer) observer.disconnect();
        cancelScheduledScan();
        cleanupWorker();
        if (observerDebounce?.cancel) {
            observerDebounce.cancel();
        }
    });
}
