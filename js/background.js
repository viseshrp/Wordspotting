// background.js - Service Worker

importScripts('utils.js');

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener(async () => {
    try {
        const item = await getFromStorage("is_first_start");
        const is_first_start = item.is_first_start;

        if (is_first_start === null || typeof is_first_start === 'undefined') {
            logit("First start initialization...");

            await saveToStorage({"wordspotting_notifications_on": true});
            await saveToStorage({"wordspotting_extension_on": true});
            await saveToStorage({"wordspotting_website_list": []});
            await saveToStorage({"wordspotting_word_list": []});
            await saveToStorage({"is_first_start": false});

            logit("First start complete.");

            chrome.tabs.create({url: "options.html"});
        }
    } catch (e) {
        console.error("Error during initialization:", e);
    }
});

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Return true ensures we can send response asynchronously if needed
    // But since we are likely doing async work, we should wrap logic.

    handleMessage(request, sender).then(sendResponse);
    return true;
});

async function handleMessage(request, sender) {
    if (request.wordfound !== null && request.keyword_count !== null) {

        // Set badge text
        if (sender.tab) {
            chrome.action.setBadgeText({
                text: request.keyword_count.toString(),
                tabId: sender.tab.id
            });
        }

        if (request.wordfound === true) {
            const items = await getFromStorage("wordspotting_notifications_on");
            if (items.wordspotting_notifications_on) {
                logit("Firing notification!");
                showNotification(
                    "img/ws48.png",
                    'basic',
                    'Keyword found!',
                    sender.tab ? sender.tab.title : "Page",
                    1
                );
            }
        }

        return { ack: "gotcha" };
    }
}

function showNotification(iconUrl, type, title, message, priority) {
    var opt = {
        iconUrl: iconUrl,
        type: type,
        title: title,
        message: message,
        priority: priority
    };

    chrome.notifications.create('', opt);
}
