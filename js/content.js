// content.js - Content Script

let lastScanSignature = null;
let idleHandle = null;
let currentScanController = null;
let observer = null;
let lastSnapshot = { text: '', timestamp: 0 };

// Main execution
(async function() {
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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
            } else {
                sendResponse({}); // Always respond to avoid leaving the channel open
            }
        } catch (e) {
            console.error("Error in onMessage:", e);
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
        } catch (e) {
            console.warn("Skipping invalid regex:", word);
        }
    });

    if (patterns.length === 0) return [];

    const combinedPattern = patterns.join('|');
    // We cannot optimize further easily because we need to know WHICH one matched.
    const regex = new RegExp(combinedPattern, 'ig');

    let match;
    while ((match = regex.exec(textToScan)) !== null) {
        if (match.groups) {
            for (const key in match.groups) {
                if (match.groups[key] !== undefined) {
                    // key is "k0", "k1", etc.
                    const index = parseInt(key.substring(1));
                    if (patternMap[index]) {
                        foundKeywords.add(patternMap[index]);
                    }
                }
            }
        }

        if (foundKeywords.size === validKeywords.length) {
            return Array.from(foundKeywords);
        }
    }

    return Array.from(foundKeywords);
}

async function proceedWithSiteListCheck() {
    try {
        const items = await getFromStorage("wordspotting_website_list");
        const allowed_sites = items.wordspotting_website_list || [];

        if (isUrlAllowed(location.href, allowed_sites)) {
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

function scheduleScan() {
    // Cancel any pending idle callback to avoid redundant work.
    if (idleHandle && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
    } else if (idleHandle) {
        clearTimeout(idleHandle);
    }

    // Abort any in-flight scan.
    if (currentScanController) {
        currentScanController.abort();
    }
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
        if (signal.aborted) return;

        const items = await getFromStorage("wordspotting_word_list");
        const keyword_list = items.wordspotting_word_list;

        if (isValidObj(keyword_list) && keyword_list.length > 0) {
            const bodyText = await getBodyTextSnapshot(signal);
            if (signal.aborted) return;

            const signature = `${bodyText.length}:${hashString(bodyText)}`;
            if (signature === lastScanSignature) {
                return;
            }

            lastScanSignature = signature;

            const occurring_word_list = getWordList(keyword_list, bodyText);

            logit("Firing message from content script...");
            chrome.runtime.sendMessage({
                wordfound: occurring_word_list.length > 0,
                keyword_count: occurring_word_list.length
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // ignore
                } else {
                     logit("Background ack: " + (response ? response.ack : 'no response'));
                }
            });
        }
    } catch (e) {
        console.error("Error in talkToBackgroundScript:", e);
    }
}

// Debounce function to limit how often we scan
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttled body text snapshot to avoid hammering innerText on chatty pages.
async function getBodyTextSnapshot(signal) {
    const now = Date.now();
    const cacheWindow = 500; // ms
    if (now - lastSnapshot.timestamp < cacheWindow) {
        return lastSnapshot.text;
    }

    if (signal.aborted) return '';

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

function setupObserver() {
    // Observer config
    const config = { childList: true, subtree: true, characterData: true };

    // Create an observer instance linked to the callback function
    // Debounce the scan to avoid performance hit on frequent updates
    observer = new MutationObserver(debounce(() => {
        scheduleScan();
    }, 500)); // Scan at most twice per second on changes

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);

    // Pause scans when tab is hidden; resume when visible.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (observer) observer.disconnect();
            if (currentScanController) currentScanController.abort();
        } else {
            if (document.body) {
                observer.observe(document.body, config);
            }
            scheduleScan();
        }
    });

    window.addEventListener('pagehide', () => {
        if (observer) observer.disconnect();
        if (currentScanController) currentScanController.abort();
    });
}
