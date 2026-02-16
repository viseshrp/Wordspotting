import { test, expect } from './fixtures';

test('smoke: public runtime APIs are operational', async ({ serviceWorker }) => {
  const result = await serviceWorker.evaluate(async () => {
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
