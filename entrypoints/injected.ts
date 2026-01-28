import { getFromStorage, isValidObj, logit } from '@/utils/utils';
import { getWordList, proceedWithSiteListCheck, scheduleScan, resetScanSignature } from '@/utils/content-core';
import { browser } from 'wxt/browser';

// Define global types for CSS Highlights API if missing
declare global {
    // var Highlight: any;
    interface CSS {
        highlights: any;
    }
}

export default defineUnlistedScript(async () => {
    // Initialize
    if ((globalThis as any).__WORDSPOTTING_CONTENT_LOADED__) {
        return;
    }
    (globalThis as any).__WORDSPOTTING_CONTENT_LOADED__ = true;

    // Initial check
    try {
        const items = await getFromStorage("wordspotting_extension_on");
        logit("Checking if extension is on...");
        if (items.wordspotting_extension_on) {
            proceedWithSiteListCheck();
        }
    } catch (e) {
        console.error("Error checking extension status:", e);
    }

    // Message Listener
    browser.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
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
                    resetScanSignature();
                    scheduleScan();
                    sendResponse({ ack: true });
                    return;
                }

                sendResponse({});
            } catch (error) {
                console.error("Error in onMessage:", error);
                sendResponse({ word_list: [] });
            }
        })();
        return true;
    });

});
