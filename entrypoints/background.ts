import { ensureSettingsInitialized } from '@/utils/settings';
import { getFromStorage, isUrlAllowed, isUrlAllowedCompiled, compileSitePatterns, logit, saveToStorage } from '@/utils/utils';
import { browser } from 'wxt/browser';

// Point to the bundled content script (WXT unlisted script output)
const CONTENT_SCRIPT_FILES = ['/injected.js'];
const CONTENT_STYLE_FILES = ['/css/index.css'];

let compiledAllowedSites: RegExp[] = [];
const lastFoundByTab = new Map<number, boolean>(); // tabId -> boolean
const lastCountByTab = new Map<number, number>(); // tabId -> number
const BADGE_ACTIVE_COLOR = '#4caf50';
const BADGE_INACTIVE_COLOR = '#9e9e9e';
const BADGE_INACTIVE_TEXT = '-';

export default defineBackground(() => {
    // Chrome listeners
    browser.runtime.onInstalled.addListener(async (details) => {
        try {
            await ensureSettingsInitialized();
            await refreshAllowedSitePatterns();

            if (details.reason === 'install') {
                logit("First start initialization complete.");
                browser.tabs.create({url: browser.runtime.getURL("/options.html")});
            }
        } catch (e) {
            console.error("Error during initialization:", e);
        }
    });

    browser.runtime.onMessage.addListener((request, sender) => {
        // Return promise for async response
        return handleMessage(request, sender);
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            maybeInjectContentScripts(tabId, tab.url);
        }
    });

    browser.tabs.onActivated.addListener((activeInfo) => {
        browser.tabs.get(activeInfo.tabId).then((tab) => {
             // tab might be undefined if closed quickly
             if (!tab) return;
             updateBadgeForTab(tab.id!, tab.url);
        }).catch(() => {});
    });

    browser.tabs.onRemoved.addListener((tabId) => {
        lastFoundByTab.delete(tabId);
        lastCountByTab.delete(tabId);
    });

    browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        const c = changes as any;
        if (!c.wordspotting_website_list &&
            !c.wordspotting_extension_on &&
            !c.wordspotting_highlight_on &&
            !c.wordspotting_highlight_color) return;

        if (c.wordspotting_website_list) {
            refreshAllowedSitePatterns();
        }

        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.id) return;
            updateBadgeForTab(tab.id, tab.url);
            if (c.wordspotting_extension_on?.newValue === true) {
                maybeInjectContentScripts(tab.id, tab.url);
            } else if (c.wordspotting_extension_on?.newValue === false) {
                setInactiveBadge(tab.id);
            }
            browser.tabs.sendMessage(tab.id, { from: 'background', subject: 'settings_updated' }).catch(() => {
                // Ignore
            });
        });
    });

    // Expose for e2e testing
    Object.assign(globalThis, {
        handleMessage,
        setCountBadge,
        refreshAllowedSitePatterns,
        saveToStorage
    });
    Object.defineProperty(globalThis, 'compiledAllowedSites', {
        get: () => compiledAllowedSites
    });
});

async function handleMessage(request: any, sender: any) {
    const hasValidPayload = request &&
        typeof request.wordfound === 'boolean' &&
        typeof request.keyword_count === 'number';

    if (hasValidPayload) {
        const tabId = sender?.tab?.id;
        const tabUrl = sender?.tab?.url;
        const settings = await getFromStorage(["wordspotting_extension_on", "wordspotting_website_list"]);

        if (settings.wordspotting_extension_on === false) {
            if (tabId) setInactiveBadge(tabId);
            return { ack: "disabled" };
        }

        const allowedSites = settings.wordspotting_website_list || [];
        const isAllowed = tabUrl
            ? (compiledAllowedSites.length > 0
                ? isUrlAllowedCompiled(tabUrl, compiledAllowedSites)
                : isUrlAllowed(tabUrl, allowedSites))
            : true;

        if (!isAllowed) {
            if (tabId) setInactiveBadge(tabId);
            return { ack: "not_allowed" };
        }

        if (tabId) {
            lastCountByTab.set(tabId, request.keyword_count);
            setCountBadge(tabId, request.keyword_count);
        }

        if (tabId !== null && tabId !== undefined) {
            const prevFound = lastFoundByTab.get(tabId) ?? false;
            lastFoundByTab.set(tabId, request.wordfound === true);

            if (!prevFound && request.wordfound === true) {
                const items = await getFromStorage("wordspotting_notifications_on");
                if (items.wordspotting_notifications_on) {
                    logit("Firing notification!");
                    showNotification(
                        "/assets/ws48.png",
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

function showNotification(iconUrl: string, type: any, title: string, message: string, priority: number) {
    const icon = browser.runtime.getURL(iconUrl as any);
    var opt = {
        iconUrl: icon,
        type: type as any,
        title: title,
        message: message,
        priority: priority
    };

    browser.notifications.create('', opt);
}

async function maybeInjectContentScripts(tabId: number, url?: string) {
    if (!url) return;
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
            setInactiveBadge(tabId);
            return;
        }

        setCountBadge(tabId, 0);
        await injectStyles(tabId);
        await injectScripts(tabId);
    } catch (e) {
        console.error("Error during dynamic injection:", e);
    }
}

async function injectStyles(tabId: number) {
    try {
        await browser.scripting.insertCSS({
            target: { tabId },
            files: CONTENT_STYLE_FILES
        });
    } catch (e) {
        console.warn("Style injection skipped:", e);
    }
}

async function injectScripts(tabId: number) {
    const already = await isContentAlreadyInjected(tabId);
    if (already) return;

    await browser.scripting.executeScript({
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

async function updateBadgeForTab(tabId: number, url?: string) {
    try {
        const settings = await getFromStorage(["wordspotting_extension_on", "wordspotting_website_list"]);
        if (settings.wordspotting_extension_on === false) {
            setInactiveBadge(tabId);
            return;
        }

        if (url) {
            const allowedSites = settings.wordspotting_website_list || [];
            const isAllowed = compiledAllowedSites.length > 0
                ? isUrlAllowedCompiled(url, compiledAllowedSites)
                : isUrlAllowed(url, allowedSites);

            if (!isAllowed) {
                setInactiveBadge(tabId);
                return;
            }
        }

        const count = lastCountByTab.get(tabId) ?? 0;
        setCountBadge(tabId, count);
    } catch (e) {
        console.warn('Unable to update badge status:', e);
    }
}

function setBadge(tabId: number, text: string, color?: string) {
    browser.action.setBadgeText({ tabId, text });
    if (color) {
        browser.action.setBadgeBackgroundColor({ tabId, color });
    }
}

function setInactiveBadge(tabId: number) {
    setBadge(tabId, BADGE_INACTIVE_TEXT, BADGE_INACTIVE_COLOR);
}

function setCountBadge(tabId: number, count: number) {
    const text = count > 0 ? String(count) : '0';
    setBadge(tabId, text, BADGE_ACTIVE_COLOR);
}

async function isContentAlreadyInjected(tabId: number) {
    try {
        const results = await browser.scripting.executeScript({
            target: { tabId },
            func: () => Boolean((globalThis as any).__WORDSPOTTING_CONTENT_LOADED__),
        });
        const [result] = results;
        return Boolean(result?.result);
    } catch (_e) {
        return false;
    }
}
