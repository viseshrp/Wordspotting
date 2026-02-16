/* global Highlight */

import {
  compileSitePatterns,
  getFromStorage,
  isUrlAllowedCompiled,
  isValidObj,
  logExtensionError,
  logit,
  withTimeout
} from './shared/utils';
import { hashString, scanTextForKeywords, scanTextForMatches, type HighlightMatch } from './shared/core/scanner';

const DEFAULT_CHUNK_SIZE = 150000;
const DEFAULT_CHUNK_OVERLAP = 200;
const OFFSCREEN_SCAN_TIMEOUT_MS = 5000;

let lastScanSignature: string | null = null;
type TimeoutHandle = ReturnType<typeof setTimeout>;
type IdleHandle = number | TimeoutHandle;
let idleHandle: IdleHandle | null = null;
let currentScanController: AbortController | null = null;
let observer: MutationObserver | null = null;
let observerDebounce: ((...args: unknown[]) => void) & { cancel?: () => void } | null = null;
let lastSnapshot = { text: '', timestamp: 0 };

function init() {
  // Main execution
  (async () => {
    try {
      const items = await getFromStorage<Record<string, unknown>>('wordspotting_extension_on');
      logit('Checking if extension is on...');
      if (items.wordspotting_extension_on) {
        await proceedWithSiteListCheck();
      }
    } catch (e) {
      logExtensionError('Error checking extension status', e, { operation: 'runtime_context' });
    }
  })();

  // Listen for messages from popup/background
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        const items = await getFromStorage<Record<string, unknown>>('wordspotting_extension_on');
        const extensionOn = items.wordspotting_extension_on;

        if (msg?.from === 'popup' && msg?.subject === 'word_list_request') {
          if (!extensionOn) {
            sendResponse({ word_list: [], disabled: true });
            return;
          }

          const storage = await getFromStorage<Record<string, unknown>>('wordspotting_word_list');
          const keywordList = storage.wordspotting_word_list as string[] | undefined;

          if (isValidObj(keywordList) && keywordList.length > 0) {
            const occurringWordList = getWordList(keywordList);
            sendResponse({ word_list: occurringWordList });
          } else {
            sendResponse({ word_list: [] });
          }
          return;
        }

        if (msg?.from === 'background' && msg?.subject === 'settings_updated') {
          lastScanSignature = null; // force a fresh scan on settings change
          scheduleScan();
          sendResponse({ ack: true });
          return;
        }

        if (msg?.target === 'offscreen') {
          return;
        }

        sendResponse({}); // Always respond to avoid leaving the channel open
      } catch (error) {
        logExtensionError('Error in onMessage', error, { operation: 'runtime_context' });
        sendResponse({ word_list: [] });
      }
    })();
    return true;
  });
}

/**
 * Wrapper around core scanner to keep existing interface.
 */
export function getWordList(keywordList: string[], bodyText?: string) {
  const textToScan = typeof bodyText === 'string' ? bodyText : (document.body ? document.body.innerText : '');
  return scanTextForKeywords(keywordList, textToScan);
}

export async function proceedWithSiteListCheck() {
  try {
    const items = await getFromStorage<Record<string, unknown>>('wordspotting_website_list');
    const allowedSites = (items.wordspotting_website_list as string[]) || [];
    const compiled = compileSitePatterns(allowedSites);

    if (isUrlAllowedCompiled(location.href, compiled)) {
      // Initial check after load/idle
      deferUntilPageIdle();

      // Set up observer for SPA
      setupObserver();
    } else {
      logit('No matching allowed site. Idling.');
    }
  } catch (e) {
    logExtensionError('Error in proceedWithSiteListCheck', e, { operation: 'runtime_context' });
  }
}

function cancelScheduledScan() {
  if (idleHandle && 'cancelIdleCallback' in window && typeof idleHandle === 'number') {
    window.cancelIdleCallback(idleHandle);
  } else if (idleHandle) {
    clearTimeout(idleHandle);
  }
  idleHandle = null;
  if (currentScanController) {
    currentScanController.abort();
    currentScanController = null;
  }
}

export function scheduleScan() {
  cancelScheduledScan();

  currentScanController = new AbortController();
  const run = () => void performScan(currentScanController?.signal);

  if ('requestIdleCallback' in window) {
    idleHandle = window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    idleHandle = setTimeout(run, 300);
  }
}

export function deferUntilPageIdle() {
  if (document.readyState === 'complete') {
    scheduleScan();
  } else {
    window.addEventListener('load', () => scheduleScan(), { once: true });
  }
}

export async function performScan(signal?: AbortSignal) {
  try {
    if (signal?.aborted) return;
    if (!browser.runtime || !browser.runtime.id) return;

    const items = await getFromStorage<Record<string, unknown>>([
      'wordspotting_word_list',
      'wordspotting_highlight_on',
      'wordspotting_highlight_color'
    ]);
    const keywordList = items.wordspotting_word_list as string[] | undefined;
    const highlightOn = items.wordspotting_highlight_on === true;
    const highlightColor = (items.wordspotting_highlight_color as string) || '#FFFF00';

    if (!isValidObj(keywordList) || keywordList.length === 0) {
      sendKeywordCount(0);
      if (highlightOn) clearHighlights();
      return;
    }

    // Check if content changed significantly
    const bodyText = await getBodyTextSnapshot(signal);
    if (signal?.aborted) return;

    // Include highlight setting in signature to force re-scan if user toggles switch
    const signature = `${highlightOn}:${bodyText.length}:${hashString(bodyText)}`;
    if (signature === lastScanSignature) {
      return;
    }

    lastScanSignature = signature;

    let foundCount = 0;

    if (highlightOn) {
      foundCount = await performHighlightScan(keywordList, highlightColor, signal);
    } else {
      clearHighlights();
      foundCount = await performStandardScan(keywordList, bodyText);
    }

    sendKeywordCount(foundCount);
  } catch (e) {
    logExtensionError('Error in performScan', e, { operation: 'runtime_context' });
  }
}

async function performStandardScan(keywordList: string[], bodyText: string) {
  let occurringWordList: string[] = [];
  try {
    occurringWordList = await scanWithWorker(keywordList, bodyText);
  } catch (e) {
    logExtensionError('Offscreen worker scan failed, falling back', e, { operation: 'runtime_context' });
    occurringWordList = getWordList(keywordList, bodyText);
  }
  return occurringWordList.length;
}

async function performHighlightScan(keywordList: string[], color: string, signal?: AbortSignal) {
  const textNodes = getTextNodes(document.body);
  if (signal?.aborted) return 0;

  try {
    // Prepare chunks for worker
    const chunks = textNodes.map((node, index) => ({
      id: index,
      text: node.nodeValue || ''
    }));

    const results = await scanWithWorkerForHighlights(keywordList, chunks);
    if (signal?.aborted) return 0;

    return applyHighlights(results as Record<string, Array<{ keyword: string; index: number; length: number }>>, textNodes, color);
  } catch (e) {
    logExtensionError('Highlight worker scan failed; using local fallback', e, { operation: 'runtime_context' });
    try {
      const localResults = await scanHighlightsLocally(keywordList, textNodes, signal);
      if (signal?.aborted) return 0;
      return applyHighlights(localResults as Record<string, Array<{ keyword: string; index: number; length: number }>>, textNodes, color);
    } catch (fallbackError) {
      logExtensionError('Highlight local fallback failed', fallbackError, { operation: 'runtime_context' });
      // Final fallback to standard scan if highlighting fails entirely, but don't highlight.
      return performStandardScan(keywordList, document.body.innerText);
    }
  }
}

async function scanHighlightsLocally(keywordList: string[], textNodes: Text[], signal?: AbortSignal) {
  const results: Record<number, HighlightMatch[]> = {};
  for (let index = 0; index < textNodes.length; index += 1) {
    if (signal?.aborted) break;

    const text = textNodes[index]?.nodeValue || '';
    if (!text) continue;

    const matches = scanTextForMatches(keywordList, text);
    if (matches.length > 0) {
      results[index] = matches;
    }

    // Yield periodically to avoid long main-thread stalls on large documents.
    if (index > 0 && index % 200 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return results;
}

async function scanWithWorkerForHighlights(keywordList: string[], chunks: Array<{ id: number; text: string }>) {
  const response = await sendOffscreenScanRequest<{
    results?: Record<string, Array<{ keyword: string; index: number; length: number }>>;
    error?: string;
  }>({
    from: 'injected',
    subject: 'scan_highlights_request',
    keywords: keywordList,
    chunks
  });

  if (response && typeof response === 'object' && typeof response.error === 'string') {
    throw new Error(response.error);
  }

  const results = response && typeof response === 'object' ? response.results : undefined;
  if (!results || typeof results !== 'object') {
    throw new Error('Invalid offscreen highlight response');
  }

  return results;
}

export function getTextNodes(root: Node | null) {
  const nodes: Text[] = [];
  if (!root) return nodes;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Filter out empty or whitespace-only nodes to save processing
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      // Filter out script/style/etc
      if (node.parentNode && ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes((node.parentNode as Element).tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

export function applyHighlights(
  results: Record<string, Array<{ keyword: string; index: number; length: number }>>,
  textNodes: Text[],
  color: string
) {
  if (!('highlights' in CSS)) return 0;

  const ranges: Range[] = [];
  const foundKeywords = new Set<string>();

  for (const [idStr, matches] of Object.entries(results)) {
    const id = parseInt(idStr, 10);
    const node = textNodes[id];
    if (!node) continue;

    for (const match of matches) {
      try {
        const range = new Range();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match.length);
        ranges.push(range);
        foundKeywords.add(match.keyword);
      } catch {
        // Ignore range errors (e.g. node changed)
      }
    }
  }

  const highlight = new Highlight(...ranges);
  CSS.highlights.set('wordspotting-match', highlight);

  updateHighlightStyle(color);

  return foundKeywords.size;
}

function clearHighlights() {
  if ('highlights' in CSS) {
    CSS.highlights.delete('wordspotting-match');
  }
}

let highlightStyleElement: HTMLStyleElement | null = null;
const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00';
function updateHighlightStyle(color: string) {
  if (!highlightStyleElement) {
    highlightStyleElement = document.createElement('style');
    document.head.appendChild(highlightStyleElement);
  }
  const safeColor = sanitizeHighlightColor(color);
  highlightStyleElement.textContent = `
        ::highlight(wordspotting-match) {
            background-color: ${safeColor};
            color: black;
        }
    `;
}

function sanitizeHighlightColor(value: string) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  return DEFAULT_HIGHLIGHT_COLOR;
}

// Debounce function to limit how often we scan
export function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number) {
  let timeout: TimeoutHandle | null = null;
  function debounced(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };
  return debounced as T & { cancel: () => void };
}

// Throttled body text snapshot to avoid hammering innerText on chatty pages.
export async function getBodyTextSnapshot(signal?: AbortSignal) {
  const now = Date.now();
  const cacheWindow = 500; // ms
  if (now - lastSnapshot.timestamp < cacheWindow) {
    return lastSnapshot.text;
  }

  if (signal?.aborted) return '';

  const text = document.body ? document.body.innerText || '' : '';
  lastSnapshot = { text, timestamp: now };
  return text;
}

async function scanWithWorker(keywordList: string[], text: string) {
  const { chunkSize, overlap } = getChunkingConfig(text, keywordList);
  const response = await sendOffscreenScanRequest<{ words?: string[]; error?: string }>({
    from: 'injected',
    subject: 'scan_text_request',
    keywords: keywordList,
    text,
    chunkSize,
    overlap
  });

  if (response && typeof response === 'object' && typeof response.error === 'string') {
    throw new Error(response.error);
  }

  const words = response && typeof response === 'object' ? response.words : undefined;
  if (!Array.isArray(words)) {
    throw new Error('Invalid offscreen scan response');
  }

  return words;
}

async function sendOffscreenScanRequest<T>(request: Record<string, unknown>) {
  const maybePromise = browser.runtime.sendMessage(request);
  if (!maybePromise || typeof maybePromise.then !== 'function') {
    throw new Error('Offscreen scan request did not return a promise');
  }

  return await withTimeout(Promise.resolve(maybePromise as Promise<T>), OFFSCREEN_SCAN_TIMEOUT_MS, 'Offscreen scan timed out');
}

function getChunkingConfig(text: string, keywordList: string[]) {
  const length = typeof text === 'string' ? text.length : 0;
  let chunkSize = DEFAULT_CHUNK_SIZE;
  let overlap = DEFAULT_CHUNK_OVERLAP;

  if (length > 800000) {
    chunkSize = 300000;
    overlap = 400;
  } else if (length > 300000) {
    chunkSize = 200000;
    overlap = 300;
  } else if (length > 120000) {
    chunkSize = 160000;
    overlap = 240;
  }

  const longestKeyword = Array.isArray(keywordList)
    ? keywordList.reduce((max, k) => (typeof k === 'string' && k.length > max ? k.length : max), 0)
    : 0;
  overlap = Math.max(overlap, Math.min(longestKeyword, 800));

  return { chunkSize, overlap };
}

export function sendKeywordCount(count: number) {
  try {
    const maybe = browser.runtime.sendMessage({
      wordfound: count > 0,
      keyword_count: count
    });
    if (maybe && typeof maybe.catch === 'function') {
      void maybe.catch(() => undefined);
    }
  } catch {
    // Context gone; ignore.
  }
}

function setupObserver() {
  // Observer config
  const config = { childList: true, subtree: true, characterData: true };

  // Debounce the scan to avoid performance hit on frequent updates
  observerDebounce = debounce(() => {
    scheduleScan();
  }, 500);

  observer = new MutationObserver(observerDebounce);

  // Start observing the target node for configured mutations
  observer.observe(document.body, config);

  // Pause scans when tab is hidden; resume when visible.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (observer) observer.disconnect();
      cancelScheduledScan();
    } else {
      if (document.body) {
        observer?.observe(document.body, config);
      }
      scheduleScan();
    }
  });

  window.addEventListener('pagehide', () => {
    if (observer) observer.disconnect();
    cancelScheduledScan();
    if (observerDebounce?.cancel) {
      observerDebounce.cancel();
    }
  });
}

export default defineUnlistedScript(() => {
  if (globalThis.__WORDSPOTTING_CONTENT_LOADED__) return;
  globalThis.__WORDSPOTTING_CONTENT_LOADED__ = true;
  init();
});

export { hashString };
