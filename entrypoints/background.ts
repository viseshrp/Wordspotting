import {
  compileSitePatterns,
  getFromStorage,
  isUrlAllowed,
  isUrlAllowedCompiled,
  logit,
  saveToStorage
} from './shared/utils';
import { ensureSettingsInitialized } from './shared/settings';

const CONTENT_SCRIPT_FILES = ['injected.js'];
const CONTENT_STYLE_FILES = ['css/index.css'];
let compiledAllowedSites: RegExp[] = [];
const lastFoundByTab = new Map<number, boolean>();
const lastCountByTab = new Map<number, number>();
const BADGE_ACTIVE_COLOR = '#4caf50';
const BADGE_INACTIVE_COLOR = '#9e9e9e';
const BADGE_INACTIVE_TEXT = '-';

type WordspottingMessage = {
  wordfound: boolean;
  keyword_count: number;
};

function isWordspottingMessage(request: unknown): request is WordspottingMessage {
  if (!request || typeof request !== 'object') return false;
  const typed = request as WordspottingMessage;
  return typeof typed.wordfound === 'boolean' && typeof typed.keyword_count === 'number';
}

export default defineBackground(() => {
  exposeGlobalsForTests();

  browser.runtime.onInstalled.addListener(async (details) => {
    try {
      await ensureSettingsInitialized();
      await refreshAllowedSitePatterns();

      if (details.reason === 'install') {
        logit('First start initialization complete.');
        await browser.tabs.create({ url: 'options.html' });
      }
    } catch (e) {
      console.error('Error during initialization:', e);
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender)
      .then((response) => sendResponse(response))
      .catch((err) => {
        console.error('Error handling message:', err);
        sendResponse({ ack: 'error' });
      });
    return true;
  });

  // Dynamically inject content scripts on allowed sites only.
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      void maybeInjectContentScripts(tabId, tab.url);
    }
  });

  // Update badge when user switches tabs.
  browser.tabs.onActivated.addListener((activeInfo) => {
    void (async () => {
      try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        if (!tab || typeof tab.id !== 'number') return;
        await updateBadgeForTab(tab.id, tab.url);
      } catch {
        // ignore
      }
    })();
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    lastFoundByTab.delete(tabId);
    lastCountByTab.delete(tabId);
  });

  // Re-evaluate active tab when allowed sites or on/off switch changes.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes.wordspotting_website_list &&
      !changes.wordspotting_extension_on &&
      !changes.wordspotting_highlight_on &&
      !changes.wordspotting_highlight_color) return;

    if (changes.wordspotting_website_list) {
      void refreshAllowedSitePatterns();
    }

    void (async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || typeof tab.id !== 'number') return;
      await updateBadgeForTab(tab.id, tab.url);
      if (changes.wordspotting_extension_on?.newValue === true) {
        await maybeInjectContentScripts(tab.id, tab.url || '');
      } else if (changes.wordspotting_extension_on?.newValue === false) {
        setInactiveBadge(tab.id);
      }
      try {
        await browser.tabs.sendMessage(tab.id, { from: 'background', subject: 'settings_updated' });
      } catch {
        // Ignore missing receivers (content may not be injected).
      }
    })();
  });
});

export async function handleMessage(request: unknown, sender: chrome.runtime.MessageSender) {
  if (isWordspottingMessage(request)) {
    const tabId = sender?.tab?.id;
    const tabUrl = sender?.tab?.url;
    const settings = await getFromStorage<Record<string, unknown>>([
      'wordspotting_extension_on',
      'wordspotting_website_list'
    ]);

    if (settings.wordspotting_extension_on === false) {
      if (typeof tabId === 'number') setInactiveBadge(tabId);
      return { ack: 'disabled' };
    }

    const allowedSites = Array.isArray(settings.wordspotting_website_list)
      ? settings.wordspotting_website_list as string[]
      : [];
    const isAllowed = tabUrl
      ? (compiledAllowedSites.length > 0
        ? isUrlAllowedCompiled(tabUrl, compiledAllowedSites)
        : isUrlAllowed(tabUrl, allowedSites))
      : true;

    if (!isAllowed) {
      if (typeof tabId === 'number') setInactiveBadge(tabId);
      return { ack: 'not_allowed' };
    }

    // Set badge text
    if (typeof tabId === 'number') {
      lastCountByTab.set(tabId, request.keyword_count);
      setCountBadge(tabId, request.keyword_count);
    }

    if (tabId !== null && typeof tabId === 'number') {
      const prevFound = lastFoundByTab.get(tabId) ?? false;
      lastFoundByTab.set(tabId, request.wordfound === true);

      // Notify only on rising edge
      if (!prevFound && request.wordfound === true) {
        const items = await getFromStorage<Record<string, unknown>>('wordspotting_notifications_on');
        if (items.wordspotting_notifications_on) {
          logit('Firing notification!');
          showNotification(
            'assets/ws48.png',
            'basic',
            'Keyword found!',
            sender.tab ? sender.tab.title || 'Page' : 'Page',
            1
          );
        }
      }
    }

    return { ack: 'gotcha' };
  }

  return { ack: 'ignored' };
}

function showNotification(iconUrl: string, type: chrome.notifications.TemplateType, title: string, message: string, priority: number) {
  const icon = browser.runtime.getURL(iconUrl);
  const opt: chrome.notifications.NotificationOptions<true> = {
    iconUrl: icon,
    type,
    title,
    message,
    priority
  };

  void browser.notifications.create('', opt);
}

async function maybeInjectContentScripts(tabId: number, url: string) {
  try {
    const settings = await getFromStorage<Record<string, unknown>>([
      'wordspotting_extension_on',
      'wordspotting_website_list'
    ]);
    if (settings.wordspotting_extension_on === false) {
      return;
    }

    const allowedSites = Array.isArray(settings.wordspotting_website_list)
      ? settings.wordspotting_website_list as string[]
      : [];
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
    console.error('Error during dynamic injection:', e);
  }
}

async function injectStyles(tabId: number) {
  try {
    await browser.scripting.insertCSS({
      target: { tabId },
      files: CONTENT_STYLE_FILES
    });
  } catch (e) {
    // Ignore styling failures; script can still run.
    console.warn('Style injection skipped:', e);
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

export async function refreshAllowedSitePatterns() {
  try {
    const items = await getFromStorage<Record<string, unknown>>('wordspotting_website_list');
    compiledAllowedSites = compileSitePatterns((items.wordspotting_website_list as string[]) || []);
  } catch (e) {
    console.warn('Failed to refresh allowed site patterns:', e);
    compiledAllowedSites = [];
  }
}

async function updateBadgeForTab(tabId: number, url?: string) {
  try {
    const settings = await getFromStorage<Record<string, unknown>>([
      'wordspotting_extension_on',
      'wordspotting_website_list'
    ]);
    if (settings.wordspotting_extension_on === false) {
      setInactiveBadge(tabId);
      return;
    }

    const allowedSites = Array.isArray(settings.wordspotting_website_list)
      ? settings.wordspotting_website_list as string[]
      : [];
    const isAllowed = compiledAllowedSites.length > 0
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

function setBadge(tabId: number, text: string, color?: string) {
  void browser.action.setBadgeText({ tabId, text });
  if (color) {
    void browser.action.setBadgeBackgroundColor({ tabId, color });
  }
}

function setInactiveBadge(tabId: number) {
  setBadge(tabId, BADGE_INACTIVE_TEXT, BADGE_INACTIVE_COLOR);
}

export function setCountBadge(tabId: number, count: number) {
  const text = count > 0 ? String(count) : '0';
  setBadge(tabId, text, BADGE_ACTIVE_COLOR);
}

async function isContentAlreadyInjected(tabId: number) {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(globalThis.__WORDSPOTTING_CONTENT_LOADED__)
    });
    return Boolean(result?.result);
  } catch {
    // If we can't check (navigation/restricted), assume not injected.
    return false;
  }
}

function exposeGlobalsForTests() {
  const g = globalThis as typeof globalThis & {
    handleMessage?: typeof handleMessage;
    setCountBadge?: typeof setCountBadge;
    refreshAllowedSitePatterns?: typeof refreshAllowedSitePatterns;
    saveToStorage?: typeof saveToStorage;
    __name?: (target: unknown, value?: string) => unknown;
  };

  g.handleMessage = handleMessage;
  g.setCountBadge = setCountBadge;
  g.refreshAllowedSitePatterns = refreshAllowedSitePatterns;
  g.saveToStorage = saveToStorage;
  if (!g.__name) {
    g.__name = (target) => target;
  }

  Object.defineProperty(globalThis, 'compiledAllowedSites', {
    get: () => compiledAllowedSites,
    set: (value) => { compiledAllowedSites = value; }
  });
}
