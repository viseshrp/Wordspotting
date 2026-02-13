import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

test('smoke: badge and notification paths are exercised', async () => {
  const extensionPath = path.resolve(process.cwd(), '.output', 'chrome-mv3-e2e');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--headless=new',
    ],
  });

  try {
    const serviceWorker = await waitForServiceWorker(context);

    await serviceWorker.evaluate(() => {
      let count = 0;
      const original = chrome.notifications.create;
      type NotificationsCreate = typeof chrome.notifications.create;
      type WSExtendedGlobal = typeof self & { __wsNotificationCount?: () => number };
      const selfWithCounter = self as WSExtendedGlobal;

      chrome.notifications.create = (...args: Parameters<NotificationsCreate>) => {
        count += 1;
        return (original as unknown as (...params: Parameters<NotificationsCreate>) => unknown)(...args);
      };
      selfWithCounter.__wsNotificationCount = () => count;
    });

    const workerUrl = serviceWorker.url();
    const extensionId = workerUrl.split('/')[2];
    const optionsUrl = `chrome-extension://${extensionId}/options.html`;

    const page = await context.newPage();
    await page.goto(optionsUrl);

    const result = await serviceWorker.evaluate(async () => {
      await saveToStorage({
        wordspotting_website_list: ['*example.com*'],
        wordspotting_extension_on: true,
      });
      await refreshAllowedSitePatterns();

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

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await handleMessage(
        { wordfound: true, keyword_count: 3 },
        { tab: { id: tabId, url: 'https://example.com', title: 'Example Domain' } },
      );

      setCountBadge(tabId, 3);

      const expectedBadge = '3';
      let text = '';
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        text = await new Promise((resolve) => chrome.action.getBadgeText({ tabId }, resolve));
        if (text === expectedBadge) break;
      }

      type WSExtendedGlobal = typeof self & { __wsNotificationCount?: () => number };
      const selfWithCounter = self as WSExtendedGlobal;
      const notificationCount = typeof selfWithCounter.__wsNotificationCount === 'function'
        ? selfWithCounter.__wsNotificationCount()
        : 0;

      await chrome.tabs.remove(tabId);

      return {
        badgeText: text,
        notificationCount,
        response,
      };
    });

    expect(result.badgeText).toBe('3');
    expect(result.notificationCount).toBeGreaterThanOrEqual(1);
  } finally {
    await context.close();
  }
});

async function waitForServiceWorker(context: BrowserContext, timeout = 15000) {
  const end = Date.now() + timeout;

  while (Date.now() < end) {
    const [existing] = context.serviceWorkers();
    if (existing) return existing;
    try {
      const worker = await context.waitForEvent('serviceworker', { timeout: 500 });
      if (worker) return worker;
    } catch {
      // Continue polling.
    }
  }

  throw new Error(`Service worker not registered within ${timeout}ms`);
}
