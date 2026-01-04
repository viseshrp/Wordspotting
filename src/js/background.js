// background.js - Service Worker

importScripts('./utils.js');
importScripts('./settings.js');

const CONTENT_SCRIPT_FILES = ['src/js/utils.js', 'src/js/settings.js', 'src/js/content.js'];
const CONTENT_STYLE_FILES = ['src/css/index.css'];
let compiledAllowedSites = [];

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
                    "src/assets/ws48.png",
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

// Dynamically inject content scripts on allowed sites only.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        maybeInjectContentScripts(tabId, tab.url);
    }
});

// Re-evaluate active tab when allowed sites or on/off switch changes.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes.wordspotting_website_list && !changes.wordspotting_extension_on) return;

    if (changes.wordspotting_website_list) {
        refreshAllowedSitePatterns();
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url) {
            maybeInjectContentScripts(tab.id, tab.url);
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

        const originPattern = getOriginPattern(url);
        if (!originPattern) return;

        const hasPermission = await containsOriginPermission(originPattern);
        if (!hasPermission) {
            const granted = await requestOriginPermission(originPattern);
            if (!granted) return;
        }

        await injectStyles(tabId);
        await injectScripts(tabId);
    } catch (e) {
        console.error("Error during dynamic injection:", e);
    }
}

function getOriginPattern(url) {
    try {
        const parsed = new URL(url);
        if (!/^https?:/i.test(parsed.protocol)) return null;
        return `${parsed.protocol}//${parsed.host}/*`;
    } catch (e) {
        return null;
    }
}

function containsOriginPermission(originPattern) {
    return new Promise((resolve) => {
        chrome.permissions.contains({ origins: [originPattern] }, (result) => {
            resolve(!!result);
        });
    });
}

function requestOriginPermission(originPattern) {
    return new Promise((resolve) => {
        chrome.permissions.request({ origins: [originPattern] }, (granted) => {
            resolve(granted);
        });
    });
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
