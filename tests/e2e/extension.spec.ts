import { test, expect } from './fixtures';

test('smoke: badge and notification paths are exercised', async ({ context, serviceWorker, extensionId }) => {
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
});
