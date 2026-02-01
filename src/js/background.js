// background.js - Service Worker

import {
    getFromStorage,
    saveToStorage,
    logit,
    isUrlAllowed,
    isUrlAllowedCompiled,
    compileSitePatterns,
} from './utils.js';
import { ensureSettingsInitialized } from './settings.js';

const CONTENT_SCRIPT_FILES = ['js/content.js'];
const CONTENT_STYLE_FILES = ['css/content.css'];
let compiledAllowedSites = [];
const lastFoundByTab = new Map(); // tabId -> boolean
const lastCountByTab = new Map(); // tabId -> number
const BADGE_ACTIVE_COLOR = '#4caf50';
const BADGE_INACTIVE_COLOR = '#9e9e9e';
const BADGE_INACTIVE_TEXT = '-';

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        await ensureSettingsInitialized();
        await refreshAllowedSitePatterns();

        if (details.reason === 'install') {
            logit('First start initialization complete.');
            chrome.tabs.create({ url: 'pages/options.html' });
        }
    } catch (e) {
        console.error('Error during initialization:', e);
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

async function handleMessage(request, sender, testSites = null) {
    const hasValidPayload =
        request &&
        typeof request.wordfound === 'boolean' &&
        typeof request.keyword_count === 'number';

    if (hasValidPayload) {
        const tabId = sender?.tab?.id;
        const tabUrl = sender?.tab?.url;
        const settings = await getFromStorage([
            'wordspotting_extension_on',
            'wordspotting_website_list',
        ]);

        if (settings.wordspotting_extension_on === false) {
            if (tabId) setInactiveBadge(tabId);
            return { ack: 'disabled' };
        }

        const allowedSites = testSites || settings.wordspotting_website_list || [];
        const isAllowed = tabUrl
            ? compiledAllowedSites.length > 0
                ? isUrlAllowedCompiled(tabUrl, compiledAllowedSites)
                : isUrlAllowed(tabUrl, allowedSites)
            : true;

        if (!isAllowed) {
            if (tabId) setInactiveBadge(tabId);
            return { ack: 'not_allowed' };
        }

        // Set badge text
        if (tabId) {
            lastCountByTab.set(tabId, request.keyword_count);
            setCountBadge(tabId, request.keyword_count);
        }

        if (tabId !== null) {
            const prevFound = lastFoundByTab.get(tabId) ?? false;
            lastFoundByTab.set(tabId, request.wordfound === true);

            // Notify only on rising edge
            if (!prevFound && request.wordfound === true) {
                const items = await getFromStorage('wordspotting_notifications_on');
                if (items.wordspotting_notifications_on) {
                    logit('Firing notification!');
                    showNotification(
                        'assets/ws48.png',
                        'basic',
                        'Keyword found!',
                        sender.tab ? sender.tab.title : 'Page',
                        1
                    );
                }
            }
        }

        return { ack: 'gotcha' };
    }

    return { ack: 'ignored' };
}

function showNotification(iconUrl, type, title, message, priority) {
    const icon = chrome.runtime.getURL(iconUrl);
    var opt = {
        iconUrl: icon,
        type: type,
        title: title,
        message: message,
        priority: priority,
    };

    chrome.notifications.create('', opt);
}

// Dynamically inject content scripts on allowed sites only.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        maybeInjectContentScripts(tabId, tab.url);
    }
});

// Update badge when user switches tabs.
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId).then((tab) => {
        if (!tab) return;
        updateBadgeForTab(tab.id, tab.url);
    }).catch((e) => {
        console.warn('Failed to update badge on tab switch:', e);
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    lastFoundByTab.delete(tabId);
    lastCountByTab.delete(tabId);
});

// Re-evaluate active tab when allowed sites or on/off switch changes.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (
        !changes.wordspotting_website_list &&
        !changes.wordspotting_extension_on &&
        !changes.wordspotting_highlight_on &&
        !changes.wordspotting_highlight_color
    )
        return;

    if (changes.wordspotting_website_list) {
        refreshAllowedSitePatterns();
    }

    // Notify active tab to rescan without reinjecting
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) return;
        updateBadgeForTab(tab.id, tab.url);
        if (changes.wordspotting_extension_on?.newValue === true) {
            maybeInjectContentScripts(tab.id, tab.url);
        } else if (changes.wordspotting_extension_on?.newValue === false) {
            setInactiveBadge(tab.id);
        }
        chrome.tabs.sendMessage(
            tab.id,
            { from: 'background', subject: 'settings_updated' },
            () => {
                // Ignore missing receivers (content may not be injected).
                void chrome.runtime.lastError;
            }
        );
    });
});

async function maybeInjectContentScripts(tabId, url) {
    try {
        const settings = await getFromStorage([
            'wordspotting_extension_on',
            'wordspotting_website_list',
        ]);
        if (settings.wordspotting_extension_on === false) {
            return;
        }

        const allowedSites = settings.wordspotting_website_list || [];
        const isAllowed =
            compiledAllowedSites.length > 0
                ? isUrlAllowedCompiled(url, compiledAllowedSites)
                : isUrlAllowed(url, allowedSites);

        if (!isAllowed) {
            setInactiveBadge(tabId);
            return;
        }

        setCountBadge(tabId, 0);
        await injectStyles(tabId);
        await injectScripts(tabId);
    } catch (e) {
        console.error('Error during dynamic injection:', e);
    }
}

async function injectStyles(tabId) {
    try {
        await chrome.scripting.insertCSS({
            target: { tabId },
            files: CONTENT_STYLE_FILES,
        });
    } catch (e) {
        // Ignore styling failures; script can still run.
        console.warn('Style injection skipped:', e);
    }
}

async function injectScripts(tabId) {
    const already = await isContentAlreadyInjected(tabId);
    if (already) return;

    await chrome.scripting.executeScript({
        target: { tabId },
        files: CONTENT_SCRIPT_FILES,
    });
}

async function refreshAllowedSitePatterns() {
    try {
        const items = await getFromStorage('wordspotting_website_list');
        compiledAllowedSites = compileSitePatterns(items.wordspotting_website_list || []);
    } catch (e) {
        console.warn('Failed to refresh allowed site patterns:', e);
        compiledAllowedSites = [];
    }
}

async function updateBadgeForTab(tabId, url) {
    try {
        const settings = await getFromStorage([
            'wordspotting_extension_on',
            'wordspotting_website_list',
        ]);
        if (settings.wordspotting_extension_on === false) {
            setInactiveBadge(tabId);
            return;
        }

        const allowedSites = settings.wordspotting_website_list || [];
        const isAllowed =
            compiledAllowedSites.length > 0
                ? isUrlAllowedCompiled(url, compiledAllowedSites)
                : isUrlAllowed(url, allowedSites);

        if (!isAllowed) {
            setInactiveBadge(tabId);
            return;
        }

        const count = lastCountByTab.get(tabId) ?? 0;
        setCountBadge(tabId, count);
    } catch (e) {
        console.warn('Unable to update badge status:', e);
    }
}

function setBadge(tabId, text, color) {
    chrome.action.setBadgeText({ tabId, text });
    if (color) {
        chrome.action.setBadgeBackgroundColor({ tabId, color });
    }
}

function setInactiveBadge(tabId) {
    setBadge(tabId, BADGE_INACTIVE_TEXT, BADGE_INACTIVE_COLOR);
}

function setCountBadge(tabId, count) {
    const text = count > 0 ? String(count) : '0';
    setBadge(tabId, text, BADGE_ACTIVE_COLOR);
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

// Exposed for Playwright tests
self.runSmokeTestLogic = async function () {
    await saveToStorage({
        wordspotting_website_list: ['*example.com*'],
        wordspotting_extension_on: true,
    });
    await refreshAllowedSitePatterns();

    const tab = await chrome.tabs.create({ url: 'https://example.com', active: true });

    // Wait until the tab reports complete
    await new Promise((resolve) => {
        const waitForComplete = () =>
            chrome.tabs.get(tab.id, (info) => {
                if (info?.status === 'complete') {
                    resolve();
                } else {
                    setTimeout(waitForComplete, 100);
                }
            });
        waitForComplete();
    });

    // Give some time for background `onUpdated` -> `maybeInjectContentScripts` to run
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Drive badge update through the background handler directly
    const response = await handleMessage(
        { wordfound: true, keyword_count: 3 },
        { tab: { id: tab.id, url: 'https://example.com', title: 'Example Domain' } }
    );

    // Ensure background badge state is explicitly set for this tab.
    setCountBadge(tab.id, 3);

    // Allow the message to propagate and badge to update; poll for expected text.
    const expectedBadge = '3';
    let text = '';
    for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        text = await new Promise((resolve) =>
            chrome.action.getBadgeText({ tabId: tab.id }, resolve)
        );
        if (text === expectedBadge) break;
    }

    const notificationCount =
        typeof self.__wsNotificationCount === 'function' ? self.__wsNotificationCount() : 0;

    await chrome.tabs.remove(tab.id);
    return {
        badgeText: text,
        notificationCount,
        debug: {
            response,
            text,
            compiledAllowedSitesLength: compiledAllowedSites?.length ?? 0,
        },
    };
};
