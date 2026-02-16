import { test, expect } from './fixtures';

test('smoke: public runtime APIs are operational', async ({ serviceWorker }) => {
  const result = await serviceWorker.evaluate(async () => {
    const waitForSettingsInit = async () => {
      await new Promise<void>((resolve) => {
        const poll = () => chrome.storage.sync.get('wordspotting_settings_version', (items) => {
          if (typeof items.wordspotting_settings_version === 'number') {
            resolve();
            return;
          }
          setTimeout(poll, 100);
        });
        poll();
      });
    };

    await waitForSettingsInit();

    const testSettings = {
      wordspotting_website_list: ['*example.com*'],
      wordspotting_word_list: ['example'],
      wordspotting_extension_on: true,
      wordspotting_notifications_on: true
    };

    await new Promise<void>((resolve) => {
      chrome.storage.sync.set(testSettings, () => resolve());
    });

    const stored = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.sync.get(Object.keys(testSettings), (items) => {
        resolve(items as Record<string, unknown>);
      });
    });

    const tab = await chrome.tabs.create({ url: 'https://example.com', active: true });
    const tabId = tab.id;
    if (typeof tabId !== 'number') {
      throw new Error('Tab ID is missing');
    }

    await new Promise((resolve) => {
      const waitForComplete = () => chrome.tabs.get(tabId, (info) => {
        if (info?.status === 'complete') {
          resolve(undefined);
        } else {
          setTimeout(waitForComplete, 100);
        }
      });
      waitForComplete();
    });

    const [{ result: title }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.title,
    });

    await chrome.tabs.remove(tabId);

    return {
      storedKeyCount: Object.keys(stored).length,
      hasSettings: Boolean(stored.wordspotting_extension_on) && Boolean(stored.wordspotting_notifications_on),
      pageTitle: typeof title === 'string' ? title : ''
    };
  });

  expect(result.storedKeyCount).toBeGreaterThan(0);
  expect(result.hasSettings).toBe(true);
  expect(result.pageTitle.length).toBeGreaterThan(0);
});

test('keyword detection activates for pre-existing tab after settings update', async ({ serviceWorker }) => {
  const result = await serviceWorker.evaluate(async () => {
    const waitForSettingsInit = async () => {
      await new Promise<void>((resolve) => {
        const poll = () => chrome.storage.sync.get('wordspotting_settings_version', (items) => {
          if (typeof items.wordspotting_settings_version === 'number') {
            resolve();
            return;
          }
          setTimeout(poll, 100);
        });
        poll();
      });
    };

    await waitForSettingsInit();

    // Start from a disabled/unlisted state so the tab loads without injected content.
    await chrome.storage.sync.set({
      wordspotting_website_list: [],
      wordspotting_word_list: [],
      wordspotting_extension_on: true,
      wordspotting_notifications_on: false,
      wordspotting_highlight_on: false
    });

    const tab = await chrome.tabs.create({ url: 'https://example.com', active: true });
    const tabId = tab.id;
    if (typeof tabId !== 'number') {
      throw new Error('Tab ID is missing');
    }

    await new Promise<void>((resolve) => {
      const waitForComplete = () => chrome.tabs.get(tabId, (info) => {
        if (info?.status === 'complete') {
          resolve();
        } else {
          setTimeout(waitForComplete, 100);
        }
      });
      waitForComplete();
    });

    const getWordState = async (id: number) => {
      const messageState = await new Promise<{ err: string | null; hasWords: boolean }>((resolve) => {
        chrome.tabs.sendMessage(id, { from: 'popup', subject: 'word_list_request' }, (resp) => {
          resolve({
            err: chrome.runtime.lastError?.message || null,
            hasWords: Array.isArray(resp?.word_list) && resp.word_list.length > 0
          });
        });
      });

      const badgeText = await chrome.action.getBadgeText({ tabId: id });
      return { ...messageState, badgeText };
    };

    const waitForWordDetection = async (id: number, timeoutMs = 8000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const state = await getWordState(id);
        if (!state.err && state.hasWords) {
          return state;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return getWordState(id);
    };

    const before = await getWordState(tabId);

    // Update settings while tab is already open; background should inject and trigger re-scan.
    await chrome.storage.sync.set({
      wordspotting_website_list: ['*example.com*'],
      wordspotting_word_list: ['example'],
      wordspotting_extension_on: true
    });

    const after = await waitForWordDetection(tabId);

    await chrome.tabs.remove(tabId);
    return { before, after };
  });

  expect(result.before.err).toContain('Receiving end does not exist');
  expect(result.before.hasWords).toBe(false);
  expect(result.after.err).toBeNull();
  expect(result.after.hasWords).toBe(true);
  expect(Number(result.after.badgeText)).toBeGreaterThanOrEqual(1);
});
