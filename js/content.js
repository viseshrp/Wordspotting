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
                        // For popup request, we might want immediate result,
                        // but getWordList is now potentially async if we use idleCallback?
                        // Actually, getWordList is pure logic. The scheduling happens in talkToBackgroundScript.
                        // However, scanning huge text is synchronous.
                        // For the popup, the user is waiting, so we run it synchronously.
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
 * optimizedGetWordList - Scans text using a single combined Regex.
 * @param {string[]} keyword_list
 * @returns {string[]} List of found keywords
 */
function getWordList(keyword_list) {
    // Filter out empty or invalid strings first
    const validKeywords = keyword_list.filter(k => k && k.trim().length > 0);
    if (validKeywords.length === 0) return [];

    const bodyText = document.body.innerText;
    const foundKeywords = new Set();

    // Valid patterns and their mapping
    const patterns = [];
    const patternMap = []; // index -> original keyword

    for (const word of validKeywords) {
        try {
            // Test validity of regex
            new RegExp(word);
            patterns.push(`(${word})`);
            patternMap.push(word);
        } catch (e) {
            console.warn("Skipping invalid regex:", word);
        }
    }

    if (patterns.length === 0) return [];

    // Join with OR
    const combinedPattern = patterns.join('|');
    const regex = new RegExp(combinedPattern, 'ig');

    let match;
    // Execute regex.
    // Optimization: If we just need to know *what* was found, we can iterate.
    // Ideally we want unique keywords.

    while ((match = regex.exec(bodyText)) !== null) {
        // match[0] is the full match.
        // match[1]..match[N] are the capturing groups.
        // There are patternMap.length groups.

        for (let i = 1; i < match.length; i++) {
            if (match[i] !== undefined) {
                foundKeywords.add(patternMap[i-1]);
                // Optimization: If we found all keywords, we can stop?
                // No, because we don't know if we found all until we find all.
                // But we could stop scanning if foundKeywords.size === patternMap.length.
                if (foundKeywords.size === patternMap.length) {
                    return Array.from(foundKeywords);
                }
            }
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
                    const regex = new RegExp(site, "ig");
                    if (regex.test(location.href)) {
                        shouldRun = true;
                        break;
                    }
                } catch (e) {
                    console.warn("Invalid regex in site list:", site);
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
