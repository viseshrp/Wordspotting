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

function getWordList(keyword_list) {
    let keywords_found = [];

    // Get all text content from body
    // Using a more efficient approach than scanning entire body text repeatedly
    // But for simplicity and migration parity, we will scan text content.
    // Modern approach: maybe TreeWalker or just body.innerText

    const bodyText = document.body.innerText;

    for (const word of keyword_list) {
        // Escape special regex characters in word if user input is literal?
        // The original extension seemingly treated them as Regex ("new RegExp(word, 'ig')")
        // We will stick to that behavior.
        try {
            const regex = new RegExp(word, "ig");
            if (regex.test(bodyText)) {
                keywords_found.push(word);
            }
        } catch (e) {
            console.warn("Invalid regex in word list:", word);
        }
    }

    return keywords_found;
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
                talkToBackgroundScript();

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
        talkToBackgroundScript();
    }, 1000)); // Scan at most once per second on changes

    // Start observing the target node for configured mutations
    observer.observe(document.body, config);
}
