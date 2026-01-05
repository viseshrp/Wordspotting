(() => {
const isCommonJs = typeof module !== 'undefined' && module.exports;
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
let lastHighlightSignature = null;
let lastReportedCount = null;
let isHighlighting = false;
const HIGHLIGHT_CLASS = 'ws-highlight';
const DEFAULT_HIGHLIGHT_COLOR = '#ffb3b3';

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
 * optimizedGetWordList - Scans text using a single combined Regex with Named Capture Groups.
 * @param {string[]} keyword_list
 * @param {string} [bodyText] Optional pre-fetched body text to avoid extra reads
 * @returns {string[]} List of found keywords
 */
function getWordList(keyword_list, bodyText) {
    // Filter out empty or invalid strings first
    const validKeywords = keyword_list.filter(k => k && k.trim().length > 0);
    if (validKeywords.length === 0) return [];

    const textToScan = typeof bodyText === 'string' ? bodyText : (document.body ? document.body.innerText : "");
    const foundKeywords = new Set();

    // Build Combined Regex with Named Groups: (?<k0>...)|(?<k1>...)
    const patterns = [];
    const patternMap = []; // index -> original keyword

    validKeywords.forEach((word, index) => {
        try {
            // Validate regex
            new RegExp(word);
            // Escape the index just in case, though it's an integer
            patterns.push(`(?<k${index}>${word})`);
            patternMap[index] = word;
        } catch (_e) {
            console.warn("Skipping invalid regex:", word);
        }
    });

    if (patterns.length === 0) return [];

    const combinedPattern = patterns.join('|');
    // We cannot optimize further easily because we need to know WHICH one matched.
    const regex = new RegExp(combinedPattern, 'ig');

    let match;
    match = regex.exec(textToScan);
    while (match !== null) {
        if (match.groups) {
            for (const key in match.groups) {
                if (match.groups[key] !== undefined) {
                    // key is "k0", "k1", etc.
                    const index = parseInt(key.substring(1), 10);
                    if (patternMap[index]) {
                        foundKeywords.add(patternMap[index]);
                    }
                }
            }
        }

        if (foundKeywords.size === validKeywords.length) {
            return Array.from(foundKeywords);
        }

        match = regex.exec(textToScan);
    }

    return Array.from(foundKeywords);
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

        const items = await getFromStorage(["wordspotting_word_list", "wordspotting_highlight_enabled", "wordspotting_highlight_color"]);
        const keyword_list = items.wordspotting_word_list;
        const highlightEnabled = items.wordspotting_highlight_enabled !== false;
        const highlightColor = normalizeHighlightColor(items.wordspotting_highlight_color);

        if (!isValidObj(keyword_list) || keyword_list.length === 0) {
            clearHighlights();
            sendKeywordCount(0);
            return;
        }

        const bodyText = await getBodyTextSnapshot(signal);
        if (signal?.aborted) return;

        const occurring_word_list = getWordList(keyword_list, bodyText);
        const keywordSignature = Array.isArray(keyword_list) ? keyword_list.join('|') : '';
        const bodyHash = hashString(bodyText);
        const baseSignature = `${bodyText.length}:${bodyHash}:${hashString(keywordSignature)}`;
        const highlightSignature = `${baseSignature}:${highlightEnabled}:${highlightColor}:${hashString(occurring_word_list.join('|'))}`;

        if (highlightEnabled && occurring_word_list.length > 0) {
            if (highlightSignature !== lastHighlightSignature) {
                ensureHighlightStyle(highlightColor);
                try {
                    highlightKeywords(keyword_list, { maxNodes: 5000, maxHighlights: 500 });
                } catch (err) {
                    console.warn("Highlighting skipped due to error:", err);
                }
                lastHighlightSignature = highlightSignature;
            }
        } else if (lastHighlightSignature !== null) {
            clearHighlights();
            lastHighlightSignature = null;
        }

        if (lastScanSignature !== baseSignature || lastReportedCount !== occurring_word_list.length) {
            lastScanSignature = baseSignature;
            sendKeywordCount(occurring_word_list.length);
        }
    } catch (e) {
        console.error("Error in talkToBackgroundScript:", e);
    }
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

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}

function sendKeywordCount(count) {
    if (lastReportedCount === count) return;
    lastReportedCount = count;
    logit("Firing message from content script...");
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

function normalizeHighlightColor(value) {
    if (!value || typeof value !== 'string') return DEFAULT_HIGHLIGHT_COLOR;
    const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
    if (match) {
        return `#${match[1].toLowerCase()}`;
    }
    return DEFAULT_HIGHLIGHT_COLOR;
}

function ensureHighlightStyle(color) {
    const styleId = 'ws-highlight-style';
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = `
.${HIGHLIGHT_CLASS} {
    background: ${color};
    color: #111;
    padding: 0 2px;
    border-radius: 3px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
}
`;
}

function clearHighlights() {
    const existing = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    existing.forEach((node) => {
        const text = node.textContent || '';
        node.replaceWith(document.createTextNode(text));
    });
}

function highlightKeywords(keywords, limits = {}) {
    isHighlighting = true;
    try {
        clearHighlights();
        const validKeywords = Array.isArray(keywords) ? keywords.filter((k) => k && k.trim().length > 0) : [];
        if (validKeywords.length === 0 || !document.body) return;

        // Avoid heavy scans on huge documents.
    const textBudget = 600000; // characters
    if ((document.body.innerText || '').length > textBudget) {
        console.warn("Skipping highlights: document too large");
        return;
    }

    const patterns = [];
    validKeywords.forEach((word) => {
        try {
            new RegExp(word);
            patterns.push(`(${word})`);
        } catch (_e) {
            console.warn("Skipping invalid regex:", word);
        }
    });
    if (patterns.length === 0) return;

    const combined = patterns.join('|');
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                return shouldSkipTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let node = walker.nextNode();
    let visited = 0;
    let applied = 0;
    const maxNodes = typeof limits.maxNodes === 'number' ? limits.maxNodes : 0;
    const maxHighlights = typeof limits.maxHighlights === 'number' ? limits.maxHighlights : 0;

    while (node) {
        visited += 1;
        if (maxNodes && visited > maxNodes) break;

        const text = node.nodeValue;
        if (!text || !text.trim()) continue;

        const regex = new RegExp(combined, 'ig');
        let match;
        let lastIndex = 0;
        const fragments = [];

        match = regex.exec(text);
        while (match !== null) {
            const start = match.index;
            const end = regex.lastIndex;
            if (start > lastIndex) {
                fragments.push(document.createTextNode(text.slice(lastIndex, start)));
            }
            const span = document.createElement('span');
            span.className = HIGHLIGHT_CLASS;
            span.textContent = text.slice(start, end);
            fragments.push(span);
            lastIndex = end;
        }

        if (fragments.length > 0) {
            if (lastIndex < text.length) {
                fragments.push(document.createTextNode(text.slice(lastIndex)));
            }

            const frag = document.createDocumentFragment();
            for (const part of fragments) {
                frag.appendChild(part);
            }
            node.parentNode.replaceChild(frag, node);

            applied += fragments.filter((f) => f.nodeType === 1 && f.classList.contains(HIGHLIGHT_CLASS)).length;
            if (maxHighlights && applied >= maxHighlights) {
                break;
            }
        }

        node = walker.nextNode();
    }
    } finally {
        isHighlighting = false;
    }
}

function shouldSkipTextNode(node) {
    if (!node || !node.parentNode) return true;
    if (!node.nodeValue || !node.nodeValue.trim()) return true;

    let parent = node.parentNode;
    while (parent) {
        if (parent.nodeType === 1) {
            const tag = parent.tagName;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'META', 'LINK', 'OPTION', 'TEXTAREA'].includes(tag)) {
                return true;
            }
            if (parent.classList?.contains(HIGHLIGHT_CLASS)) {
                return true;
            }
            if (parent.getAttribute && parent.getAttribute('contenteditable') === 'true') {
                return true;
            }
        }
        parent = parent.parentNode;
    }
    return false;
}

if (typeof module !== 'undefined') {
    module.exports = {
        getWordList,
        debounce,
        getBodyTextSnapshot,
        hashString,
        performScan,
        scheduleScan,
        deferUntilPageIdle,
        proceedWithSiteListCheck,
        sendKeywordCount,
        normalizeHighlightColor,
        highlightKeywords,
        clearHighlights,
        shouldSkipTextNode
    };
}

function setupObserver() {
    // Observer config
    const config = { childList: true, subtree: true, characterData: true };

    // Create an observer instance linked to the callback function
    // Debounce the scan to avoid performance hit on frequent updates
    observerDebounce = debounce(() => {
        if (isHighlighting) return;
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
        if (observerDebounce?.cancel) {
            observerDebounce.cancel();
        }
    });
}

})();
