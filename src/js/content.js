/* global Highlight */
(() => {
const isCommonJs = typeof module !== 'undefined' && module.exports;
const scannerModule = isCommonJs ? require('./core/scanner') : globalThis;
const scanTextForKeywords = scannerModule.scanTextForKeywords;
const hashString = scannerModule.hashString;

let scanWorker = null;
const DEFAULT_CHUNK_SIZE = 150000;
const DEFAULT_CHUNK_OVERLAP = 200;
let scanRequestId = 0;
const workerRequests = new Map();
let workerFailed = false;

// Prevent duplicate injection in the same frame (skip for CommonJS/tests so exports are available)
if (!isCommonJs && globalThis.__WORDSPOTTING_CONTENT_LOADED__) {
    return;
}
globalThis.__WORDSPOTTING_CONTENT_LOADED__ = true;

// content.js - Content Script

let lastScanSignature = null;
let idleHandle = null;
let currentScanController = null;
let observer = null;
let observerDebounce = null;
let lastSnapshot = { text: '', timestamp: 0 };

// Main execution (ignored during tests)
/* istanbul ignore next */
(async () => {
    try {
        const items = await getFromStorage("wordspotting_extension_on");
        logit("Checking if extension is on...");
        if (items.wordspotting_extension_on) {
            proceedWithSiteListCheck();
        }
    } catch (e) {
        console.error("Error checking extension status:", e);
    }
})();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        try {
            const items = await getFromStorage("wordspotting_extension_on");
            const extensionOn = items.wordspotting_extension_on;

            if (msg.from === 'popup' && msg.subject === 'word_list_request') {
                if (!extensionOn) {
                    sendResponse({ word_list: [], disabled: true });
                    return;
                }

                const storage = await getFromStorage("wordspotting_word_list");
                const keyword_list = storage.wordspotting_word_list;

                if (isValidObj(keyword_list) && keyword_list.length > 0) {
                    const occurring_word_list = getWordList(keyword_list);
                    sendResponse({ word_list: occurring_word_list });
                } else {
                    sendResponse({ word_list: [] });
                }
                return;
            }

            if (msg.from === 'background' && msg.subject === 'settings_updated') {
                lastScanSignature = null; // force a fresh scan on settings change
                scheduleScan();
                sendResponse({ ack: true });
                return;
            }

            sendResponse({}); // Always respond to avoid leaving the channel open
        } catch (error) {
            console.error("Error in onMessage:", error);
            sendResponse({ word_list: [] });
        }
    })();
    return true; // Keep channel open
});

/**
 * Wrapper around core scanner to keep existing interface.
 */
function getWordList(keyword_list, bodyText) {
    const textToScan = typeof bodyText === 'string' ? bodyText : (document.body ? document.body.innerText : "");
    return scanTextForKeywords(keyword_list, textToScan);
}

async function proceedWithSiteListCheck() {
    try {
        const items = await getFromStorage("wordspotting_website_list");
        const allowed_sites = items.wordspotting_website_list || [];
        const compiled = compileSitePatterns(allowed_sites);

        if (isUrlAllowedCompiled(location.href, compiled)) {
            // Initial check after load/idle
            deferUntilPageIdle();

            // Set up observer for SPA
            setupObserver();
        } else {
            logit("No matching allowed site. Idling.");
        }
    } catch (e) {
        console.error("Error in proceedWithSiteListCheck:", e);
    }
}

function cancelScheduledScan() {
    if (idleHandle && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
    } else if (idleHandle) {
        clearTimeout(idleHandle);
    }
    idleHandle = null;
    if (currentScanController) {
        currentScanController.abort();
        currentScanController = null;
    }
}

function scheduleScan() {
    cancelScheduledScan();

    currentScanController = new AbortController();
    const run = () => performScan(currentScanController.signal);

    if ('requestIdleCallback' in window) {
        idleHandle = requestIdleCallback(run, { timeout: 2000 });
    } else {
        idleHandle = setTimeout(run, 300);
    }
}

function deferUntilPageIdle() {
    if (document.readyState === 'complete') {
        scheduleScan();
    } else {
        window.addEventListener('load', () => scheduleScan(), { once: true });
    }
}

async function performScan(signal) {
    try {
        if (signal?.aborted) return;
        if (!chrome.runtime || !chrome.runtime.id) return;

        const items = await getFromStorage(["wordspotting_word_list", "wordspotting_highlight_on", "wordspotting_highlight_color"]);
        const keyword_list = items.wordspotting_word_list;
        const highlightOn = items.wordspotting_highlight_on === true;
        const highlightColor = items.wordspotting_highlight_color || '#FFFF00';

        if (!isValidObj(keyword_list) || keyword_list.length === 0) {
            sendKeywordCount(0);
            if (highlightOn) clearHighlights();
            return;
        }

        // Check if content changed significantly
        // We use innerText hash as a cheap proxy for "did the page content change?"
        // This is shared between both highlight and non-highlight modes.
        const bodyText = await getBodyTextSnapshot(signal);
        if (signal?.aborted) return;

        // Include highlight setting in signature to force re-scan if user toggles switch
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

async function performStandardScan(keyword_list, bodyText) {
    let occurring_word_list = [];
    try {
        occurring_word_list = await scanWithWorker(keyword_list, bodyText);
    } catch (e) {
        console.warn("Worker scan failed, falling back", e);
        occurring_word_list = getWordList(keyword_list, bodyText);
    }
    return occurring_word_list.length;
}

async function performHighlightScan(keyword_list, color, signal) {
    try {
        const textNodes = getTextNodes(document.body);
        if (signal?.aborted) return 0;

        // Prepare chunks for worker
        const chunks = textNodes.map((node, index) => ({
            id: index,
            text: node.nodeValue
        }));

        const results = await scanWithWorkerForHighlights(keyword_list, chunks);
        if (signal?.aborted) return 0;

        return applyHighlights(results, textNodes, color);

    } catch (e) {
        console.error("Highlight scan failed:", e);
        // Fallback to standard scan if highlighting fails, but don't highlight
        return performStandardScan(keyword_list, document.body.innerText);
    }
}

async function scanWithWorkerForHighlights(keywordList, chunks) {
    const worker = await getScanWorkerAsync();
    if (!worker) {
        throw new Error("Worker not available for highlighting");
    }
    return new Promise((resolve, reject) => {
        const id = ++scanRequestId;
        workerRequests.set(id, { resolve, reject });
        worker.postMessage({
            type: 'scan_for_highlights',
            id,
            keywords: keywordList,
            chunks // array of {id, text}
        });
    });
}

function getTextNodes(root) {
    const nodes = [];
    if (!root) return nodes;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            // Filter out empty or whitespace-only nodes to save processing
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            // Filter out script/style/etc
            if (node.parentNode && ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
            // Filter invisible? (expensive, maybe skip for now)
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

function applyHighlights(results, textNodes, color) {
    if (!('highlights' in CSS)) return 0;

    const ranges = [];
    const foundKeywords = new Set();

    for (const [idStr, matches] of Object.entries(results)) {
        const id = parseInt(idStr, 10);
        const node = textNodes[id];
        if (!node) continue;

        for (const match of matches) {
            try {
                const range = new Range();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match.length);
                ranges.push(range);
                foundKeywords.add(match.keyword);
            } catch (_e) {
                // Ignore range errors (e.g. node changed)
            }
        }
    }

    const highlight = new Highlight(...ranges);
    CSS.highlights.set('wordspotting-match', highlight);

    // Apply styles dynamically (or ensure CSS is present)
    // We can't set styles directly on Highlight object, we need a CSS rule.
    // However, we can't easily inject a stylesheet that references the custom highlight name dynamically if we want user configured color.
    // Actually we can: ::highlight(wordspotting-match)
    updateHighlightStyle(color);

    return foundKeywords.size;
}

function clearHighlights() {
    if ('highlights' in CSS) {
        CSS.highlights.delete('wordspotting-match');
    }
}

let highlightStyleElement = null;
function updateHighlightStyle(color) {
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


// Debounce function to limit how often we scan
function debounce(func, wait) {
    let timeout = null;
    function debounced(...args) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    }
    debounced.cancel = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
    };
    return debounced;
}

// Throttled body text snapshot to avoid hammering innerText on chatty pages.
async function getBodyTextSnapshot(signal) {
    const now = Date.now();
    const cacheWindow = 500; // ms
    if (now - lastSnapshot.timestamp < cacheWindow) {
        return lastSnapshot.text;
    }

    if (signal?.aborted) return '';

    const text = document.body ? document.body.innerText || '' : '';
    lastSnapshot = { text, timestamp: now };
    return text;
}

async function getScanWorkerAsync() {
    if (workerFailed) return null;
    if (scanWorker) return scanWorker;

    try {
        const workerUrl = chrome.runtime.getURL('src/js/scan-worker.js');
        // Prefer a normal worker loaded from the packaged extension URL.
        // Some pages may block worker creation; we fall back to main-thread scanning.
        scanWorker = new Worker(workerUrl);
        setupWorkerListeners(scanWorker);
        return scanWorker;
    } catch (e) {
        console.warn("Wordspotting worker creation failed:", e);
        workerFailed = true;
        return null;
    }
}

function setupWorkerListeners(worker) {
    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', (e) => {
        console.warn("Wordspotting worker error:", e);
        workerFailed = true;
        cleanupWorker();
    });
}

function handleWorkerMessage(event) {
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

function cleanupWorker() {
    if (scanWorker) {
        scanWorker.terminate();
        scanWorker = null;
    }
    workerRequests.forEach((pending) => {
        pending.reject(new Error('Worker terminated'));
    });
    workerRequests.clear();
}

async function scanWithWorker(keywordList, text) {
    const worker = await getScanWorkerAsync();
    if (!worker) {
        // Fallback for counting only (legacy/safety)
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

function getChunkingConfig(text, keywordList) {
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
        ? keywordList.reduce((max, k) => (typeof k === 'string' && k.length > max ? k.length : max), 0)
        : 0;
    overlap = Math.max(overlap, Math.min(longestKeyword, 800));

    return { chunkSize, overlap };
}

function sendKeywordCount(count) {
    try {
        chrome.runtime.sendMessage({
            wordfound: count > 0,
            keyword_count: count
        }, () => {
            // Best-effort; ignore any errors (navigation, worker sleep, etc.)
            void chrome.runtime.lastError;
        });
    } catch (err) {
        // Context gone; ignore.
        void err;
    }
}

if (typeof module !== 'undefined') {
    module.exports = {
        getWordList,
        debounce,
        getBodyTextSnapshot,
        hashString,
        sendKeywordCount,
        performScan,
        scheduleScan,
        deferUntilPageIdle,
        proceedWithSiteListCheck,
        getTextNodes, // exported for testing
        applyHighlights // exported for testing
    };
}

function setupObserver() {
    // Observer config
    const config = { childList: true, subtree: true, characterData: true };

    // Create an observer instance linked to the callback function
    // Debounce the scan to avoid performance hit on frequent updates
    observerDebounce = debounce(() => {
        scheduleScan();
    }, 500); // Scan at most twice per second on changes

    observer = new MutationObserver(observerDebounce);

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);

    // Pause scans when tab is hidden; resume when visible.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (observer) observer.disconnect();
            cancelScheduledScan();
        } else {
            if (document.body) {
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

})();
