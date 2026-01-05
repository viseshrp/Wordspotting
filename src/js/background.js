// background.js - Service Worker

importScripts('./utils.js');
importScripts('./settings.js');

const CONTENT_SCRIPT_FILES = ['src/js/utils.js', 'src/js/settings.js', 'src/js/content.js'];
const CONTENT_STYLE_FILES = ['src/css/index.css'];
let compiledAllowedSites = [];
const lastFoundByTab = new Map(); // tabId -> boolean

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        await ensureSettingsInitialized();
        await refreshAllowedSitePatterns();

        if (details.reason === 'install') {
            logit("First start initialization complete.");
            chrome.tabs.create({url: "src/pages/options.html"});
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
    const hasValidPayload = request &&
        typeof request.wordfound === 'boolean' &&
        typeof request.keyword_count === 'number';

    if (hasValidPayload) {

        // Set badge text
        if (sender.tab) {
            chrome.action.setBadgeText({
                text: request.keyword_count > 0 ? String(request.keyword_count) : "0",
                tabId: sender.tab.id
            });
        }

        const tabId = sender?.tab?.id;

        if (tabId !== null) {
            const prevFound = lastFoundByTab.get(tabId) ?? false;
            lastFoundByTab.set(tabId, request.wordfound === true);

            // Notify only on rising edge
            if (!prevFound && request.wordfound === true) {
                const items = await getFromStorage("wordspotting_notifications_on");
                if (items.wordspotting_notifications_on) {
                    logit("Firing notification!");
                    showNotification(
                        "src/assets/ws48.png",
                        'basic',
                        'Keyword found!',
                        sender.tab ? sender.tab.title : "Page",
                        1
                    );
                }
            }
        }

        return { ack: "gotcha" };
    }

    return { ack: "ignored" };
}

function showNotification(iconUrl, type, title, message, priority) {
    const icon = chrome.runtime.getURL(iconUrl);
    var opt = {
        iconUrl: icon,
        type: type,
        title: title,
        message: message,
        priority: priority
    };

    chrome.notifications.create('', opt);
}

// Dynamically inject content scripts on allowed sites only.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        maybeInjectContentScripts(tabId, tab.url);
    }
});

// Re-evaluate active tab when allowed sites or on/off switch changes.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const settingsChanged = changes.wordspotting_website_list ||
        changes.wordspotting_extension_on ||
        changes.wordspotting_highlight_enabled ||
        changes.wordspotting_highlight_color;

    if (!settingsChanged) return;

    if (changes.wordspotting_website_list) {
        refreshAllowedSitePatterns();
    }

    // Notify active tab to rescan without reinjecting
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) return;
        try {
            chrome.tabs.sendMessage(tab.id, { from: 'background', subject: 'settings_updated' });
        } catch (_e) {
            // ignore send errors; content may not be injected
        }
    });
});

async function maybeInjectContentScripts(tabId, url) {
    try {
        const settings = await getFromStorage(["wordspotting_extension_on", "wordspotting_website_list"]);
        if (settings.wordspotting_extension_on === false) {
            return;
        }

        const allowedSites = settings.wordspotting_website_list || [];
        const isAllowed = compiledAllowedSites.length > 0
            ? isUrlAllowedCompiled(url, compiledAllowedSites)
            : isUrlAllowed(url, allowedSites);

        if (!isAllowed) {
            return;
        }

        await injectStyles(tabId);
        await injectScripts(tabId);
    } catch (e) {
        console.error("Error during dynamic injection:", e);
    }
}

async function injectStyles(tabId) {
    try {
        await chrome.scripting.insertCSS({
            target: { tabId },
            files: CONTENT_STYLE_FILES
        });
    } catch (e) {
        // Ignore styling failures; script can still run.
        console.warn("Style injection skipped:", e);
    }
}

async function injectScripts(tabId) {
    const already = await isContentAlreadyInjected(tabId);
    if (already) return;

    await chrome.scripting.executeScript({
        target: { tabId },
        files: CONTENT_SCRIPT_FILES
    });
}

async function refreshAllowedSitePatterns() {
    try {
        const items = await getFromStorage("wordspotting_website_list");
        compiledAllowedSites = compileSitePatterns(items.wordspotting_website_list || []);
    } catch (e) {
        console.warn("Failed to refresh allowed site patterns:", e);
        compiledAllowedSites = [];
    }
}

async function isContentAlreadyInjected(tabId) {
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => Boolean(globalThis.__WORDSPOTTING_CONTENT_LOADED__),
        });
        return Boolean(result?.result);
    } catch (_e) {
        // If we can't check (navigation/restricted), assume not injected.
        return false;
    }
}
