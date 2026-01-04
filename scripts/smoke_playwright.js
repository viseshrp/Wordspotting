/**
 * Playwright-based smoke test:
 * - Loads the extension in headless Chromium
 * - Opens the options page
 * - Sends a message to the background to set a badge
 * - Confirms badge text and that notifications.create is called
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-chromium');

async function main() {
  const extensionPath = path.resolve(__dirname, '..');
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('manifest.json not found; run from repo root');
  }

  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--headless=new'
    ]
  });

  const [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    throw new Error('Service worker not registered');
  }

  // Capture notifications
  await serviceWorker.evaluate(() => {
    let count = 0;
    const original = chrome.notifications.create;
    chrome.notifications.create = function (...args) {
      count += 1;
      return original.apply(chrome.notifications, args);
    };
    self.__wsNotificationCount = () => count;
  });

  const workerUrl = serviceWorker.url();
  const extensionId = workerUrl.split('/')[2];
  const optionsUrl = `chrome-extension://${extensionId}/src/pages/options.html`;

  const page = await context.newPage();
  await page.goto(optionsUrl);

  // Trigger badge and notification via runtime message
  const badgeText = await page.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ wordfound: true, keyword_count: 3 });
    return await new Promise((resolve) => chrome.action.getBadgeText({ tabId: tab.id }, resolve));
  });

  const notificationCount = await serviceWorker.evaluate(() => {
    return typeof self.__wsNotificationCount === 'function' ? self.__wsNotificationCount() : 0;
  });

  await context.close();

  if (badgeText !== '3') {
    throw new Error(`Badge text mismatch: expected "3" got "${badgeText}"`);
  }
  if (notificationCount < 1) {
    throw new Error('Notification was not fired');
  }

  console.log('Playwright smoke passed: badge and notification paths exercised.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
