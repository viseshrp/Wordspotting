// content.js - Content Script

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
            if (items.wordspotting_extension_on) {
                if ((msg.from === 'popup') && (msg.subject === 'word_list_request')) {
                    const storage = await getFromStorage("wordspotting_word_list");
                    const keyword_list = storage.wordspotting_word_list;

                    if (isValidObj(keyword_list) && keyword_list.length > 0) {
                        const occurring_word_list = getWordList(keyword_list);
                        sendResponse({word_list: occurring_word_list});
                    } else {
                        sendResponse({word_list: []});
                    }
                }
            }
        } catch (e) {
            console.error("Error in onMessage:", e);
        }
    })();
    return true; // Keep channel open
});

/**
 * optimizedGetWordList - Scans text using a single combined Regex with Named Capture Groups.
 * @param {string[]} keyword_list
 * @returns {string[]} List of found keywords
 */
function getWordList(keyword_list) {
    // Filter out empty or invalid strings first
    const validKeywords = keyword_list.filter(k => k && k.trim().length > 0);
    if (validKeywords.length === 0) return [];

    const bodyText = document.body.innerText;
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
    while ((match = regex.exec(bodyText)) !== null) {
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
        const allowed_sites = items.wordspotting_website_list;

        let shouldRun = false;

        if (isValidObj(allowed_sites) && allowed_sites.length > 0) {
            for (const site of allowed_sites) {
                try {
                    let regex;
                    try {
                        regex = new RegExp(site, "ig");
                    } catch (e) {
                        // If invalid regex, assume it's a glob pattern (e.g. *linkedin*)
                        // Escape regex chars but convert wildcard * to .*
                        const escaped = site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const globbed = escaped.replace(/\\\*/g, '.*');
                        regex = new RegExp(globbed, "ig");
                    }

                    if (regex.test(location.href)) {
                        shouldRun = true;
                        break;
                    }
                } catch (e) {
                    console.warn("Invalid regex/glob in site list:", site, e);
                }
            }

            if (shouldRun) {
                // Initial check
                scheduleScan();

                // Set up observer for SPA
                setupObserver();
            }
        } else {
            logit("No allowed sites configured. Idling.");
        }
    } catch (e) {
        console.error("Error in proceedWithSiteListCheck:", e);
    }
}

function scheduleScan() {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            talkToBackgroundScript();
        }, { timeout: 2000 });
    } else {
        // Fallback
        setTimeout(talkToBackgroundScript, 500);
    }
}

async function talkToBackgroundScript() {
    try {
        const items = await getFromStorage("wordspotting_word_list");
        const keyword_list = items.wordspotting_word_list;

        if (isValidObj(keyword_list) && keyword_list.length > 0) {
            const occurring_word_list = getWordList(keyword_list);

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

function setupObserver() {
    // Observer config
    const config = { childList: true, subtree: true, characterData: true };

    // Create an observer instance linked to the callback function
    // Debounce the scan to avoid performance hit on frequent updates
    const observer = new MutationObserver(debounce(() => {
        scheduleScan();
    }, 1000)); // Scan at most once per second on changes

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);
}
