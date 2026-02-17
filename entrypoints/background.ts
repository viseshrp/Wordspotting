import {
  compileSitePatterns,
  getErrorMessage,
  getFromStorage,
  isUrlAllowed,
  isUrlAllowedCompiled,
  logExtensionError,
  logit,
  withTimeout
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
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const OFFSCREEN_SCAN_TIMEOUT_MS = 5000;
let creatingOffscreenDocument: Promise<void> | null = null;
const OFFSCREEN_RECEIVER_RETRY_DELAY_MS = 75;

type WordspottingMessage = {
  wordfound: boolean;
  keyword_count: number;
};

type ScanTextRequest = {
  from: 'injected';
  subject: 'scan_text_request';
  keywords: string[];
  text: string;
  chunkSize: number;
  overlap: number;
};
type ScanHighlightsRequest = {
  from: 'injected';
  subject: 'scan_highlights_request';
  keywords: string[];
  chunks: Array<{ id: number; text: string }>;
};
type OffscreenForwardRequest = (ScanTextRequest | ScanHighlightsRequest) & { target: 'offscreen' };

function isWordspottingMessage(request: unknown): request is WordspottingMessage {
  if (!request || typeof request !== 'object') return false;
  const typed = request as WordspottingMessage;
  return typeof typed.wordfound === 'boolean' && typeof typed.keyword_count === 'number';
}

function isScanTextRequest(request: unknown): request is ScanTextRequest {
  if (!request || typeof request !== 'object') return false;
  const typed = request as Partial<ScanTextRequest>;
  return typed.from === 'injected' &&
    typed.subject === 'scan_text_request' &&
    Array.isArray(typed.keywords) &&
    typeof typed.text === 'string' &&
    typeof typed.chunkSize === 'number' &&
    typeof typed.overlap === 'number';
}

function isScanHighlightsRequest(request: unknown): request is ScanHighlightsRequest {
  if (!request || typeof request !== 'object') return false;
  const typed = request as Partial<ScanHighlightsRequest>;
  return typed.from === 'injected' &&
    typed.subject === 'scan_highlights_request' &&
    Array.isArray(typed.keywords) &&
    Array.isArray(typed.chunks);
}

function isOffscreenTargetedRequest(request: unknown): request is OffscreenForwardRequest {
  return Boolean(request && typeof request === 'object' && (request as { target?: string }).target === 'offscreen');
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    try {
      await ensureSettingsInitialized();
      await refreshAllowedSitePatterns();

      if (details.reason === 'install') {
        logit('First start initialization complete.');
        await browser.tabs.create({ url: 'options.html' });
      }
    } catch (e) {
      logExtensionError('Error during initialization', e, 'error');
    }
  });

  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (isOffscreenTargetedRequest(request)) {
      return false;
    }

    if (isScanTextRequest(request) || isScanHighlightsRequest(request)) {
      handleScanRequest(request)
        .then((response) => sendResponse(response))
        .catch((error) => {
          logExtensionError('Failed to handle offscreen scan request', error, { level: 'error', operation: 'runtime_context' });
          sendResponse({ error: getErrorMessage(error) });
        });
      return true;
    }

    handleMessage(request, sender)
      .then((response) => sendResponse(response))
      .catch((err) => {
        logExtensionError('Error handling message', err, { level: 'error', operation: 'runtime_context' });
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
        await maybeInjectContentScripts(tab.id, tab.url || '');
        try {
          await browser.tabs.sendMessage(tab.id, { from: 'background', subject: 'settings_updated' });
        } catch {
          // Ignore missing receivers (content may not be injected yet/restricted).
        }
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
      !changes.wordspotting_word_list &&
      !changes.wordspotting_highlight_on &&
      !changes.wordspotting_highlight_color) return;

    if (changes.wordspotting_website_list) {
      void refreshAllowedSitePatterns();
    }

    void (async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab || typeof tab.id !== 'number') return;

        const extensionState = await getFromStorage<Record<string, unknown>>('wordspotting_extension_on');
        const extensionEnabled = extensionState.wordspotting_extension_on !== false;

        await updateBadgeForTab(tab.id, tab.url);
        if (extensionEnabled) {
          await maybeInjectContentScripts(tab.id, tab.url || '');
        } else {
          setInactiveBadge(tab.id);
        }
        try {
          await browser.tabs.sendMessage(tab.id, { from: 'background', subject: 'settings_updated' });
        } catch {
          // Ignore missing receivers (content may not be injected).
        }
      } catch (error) {
        logExtensionError('Failed to handle storage.onChanged tab sync', error, { operation: 'tab_query' });
      }
    })();
  });
});

async function handleMessage(request: unknown, sender: chrome.runtime.MessageSender) {
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
            chrome.notifications.TemplateType.BASIC,
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

async function handleScanRequest(request: ScanTextRequest | ScanHighlightsRequest) {
  if (!(await ensureOffscreenDocument())) {
    return { error: 'Offscreen scanner unavailable' };
  }

  try {
    const response = await requestOffscreenScan(request);
    if (isScanTextRequest(request)) {
      const words = (response as { words?: unknown }).words;
      if (Array.isArray(words)) return { words };
    } else {
      const results = (response as { results?: unknown }).results;
      if (results && typeof results === 'object') return { results };
    }
    throw new Error('Invalid offscreen scan response');
  } catch (error) {
    logExtensionError('Offscreen scan execution failed', error, { operation: 'runtime_context' });
    return { error: getErrorMessage(error) };
  }
}

async function requestOffscreenScan(request: ScanTextRequest | ScanHighlightsRequest) {
  const responsePromise = Promise.resolve(
    browser.runtime.sendMessage({ target: 'offscreen', ...request }) as Promise<unknown>
  );
  try {
    return await withTimeout(responsePromise, OFFSCREEN_SCAN_TIMEOUT_MS, 'Offscreen scanner timed out');
  } catch (error) {
    if (!isOffscreenReceiverUnavailable(error)) {
      throw error;
    }

    /*
     * Chrome can report an offscreen context as existing while the offscreen
     * script is still booting and has not registered runtime.onMessage yet.
     * In that narrow startup window, sendMessage fails with
     * "Receiving end does not exist". A single short retry closes that race
     * without adding indefinite retries or masking unrelated failures.
     */
    await ensureOffscreenDocument();
    await new Promise((resolve) => setTimeout(resolve, OFFSCREEN_RECEIVER_RETRY_DELAY_MS));
    const retryPromise = Promise.resolve(
      browser.runtime.sendMessage({ target: 'offscreen', ...request }) as Promise<unknown>
    );
    return await withTimeout(retryPromise, OFFSCREEN_SCAN_TIMEOUT_MS, 'Offscreen scanner timed out');
  }
}

function isOffscreenReceiverUnavailable(error: unknown) {
  // Match only the stable substring used by Chrome for missing listeners.
  // Keep this narrow so we do not accidentally retry on unrelated runtime errors.
  return /receiving end does not exist/i.test(getErrorMessage(error));
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== 'function') {
    return false;
  }

  const offscreenDocumentUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  if (await hasOffscreenDocument(offscreenDocumentUrl)) {
    return true;
  }

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return await hasOffscreenDocument(offscreenDocumentUrl);
  }

  const reason = (
    (chrome.offscreen.Reason as Record<string, chrome.offscreen.Reason>).WORKERS ??
    chrome.offscreen.Reason.DOM_SCRAPING
  );
  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [reason],
    justification: 'Run keyword scanning worker in an extension-owned offscreen context.'
  });

  try {
    await creatingOffscreenDocument;
  } catch (error) {
    const message = getErrorMessage(error);
    if (!/single offscreen document|already exists/i.test(message)) {
      logExtensionError('Unable to create offscreen scanner document', error, { level: 'error', operation: 'runtime_context' });
      return false;
    }
  } finally {
    creatingOffscreenDocument = null;
  }

  return await hasOffscreenDocument(offscreenDocumentUrl);
}

async function hasOffscreenDocument(url: string) {
  const runtime = chrome.runtime as typeof chrome.runtime & {
    getContexts?: (filter: { contextTypes?: string[]; documentUrls?: string[] }) => Promise<Array<{ documentUrl?: string }>>;
  };

  if (typeof runtime.getContexts === 'function') {
    const contexts = await runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [url]
    });
    return contexts.length > 0;
  }

  return false;
}
function showNotification(iconUrl: string, type: chrome.notifications.TemplateType, title: string, message: string, priority: number) {
  const icon = browser.runtime.getURL(iconUrl);
  const opt: chrome.notifications.NotificationCreateOptions = {
    iconUrl: icon,
    type,
    title,
    message,
    priority
  };

  void browser.notifications.create(opt).catch((error) => {
    logExtensionError('Unable to create notification', error, { operation: 'notification' });
  });
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
    logExtensionError('Error during dynamic injection', e, { operation: 'script_injection' });
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
    logExtensionError('Style injection skipped', e, { operation: 'script_injection' });
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
    const items = await getFromStorage<Record<string, unknown>>('wordspotting_website_list');
    const allowedSites = Array.isArray(items.wordspotting_website_list)
      ? items.wordspotting_website_list as string[]
      : [];
    compiledAllowedSites = compileSitePatterns(allowedSites);
  } catch (e) {
    logExtensionError('Failed to refresh allowed site patterns', e);
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
    logExtensionError('Unable to update badge status', e, { operation: 'badge_update' });
  }
}

function setBadge(tabId: number, text: string, color?: string) {
  void browser.action.setBadgeText({ tabId, text }).catch((error) => {
    logExtensionError('Unable to set badge text', error, { operation: 'badge_update' });
  });
  if (color) {
    void browser.action.setBadgeBackgroundColor({ tabId, color }).catch((error) => {
      logExtensionError('Unable to set badge color', error, { operation: 'badge_update' });
    });
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
