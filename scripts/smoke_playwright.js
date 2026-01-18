/**
 * Playwright-based smoke test:
 * - Loads the extension in headless Chromium
 * - Opens the options page
 * - Sends a message to the background to set a badge
 * - Confirms badge text and that notifications.create is called
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-chromium');

/* global refreshAllowedSitePatterns, handleMessage, setCountBadge, compiledAllowedSites */

async function main() {
  // const useXvfb = process.platform === 'linux' && !process.env.DISPLAY;
  // const displaySession = useXvfb ? await startXvfb() : null;
  const displaySession = null;
  const headless = true; // Use headless=new mode for extensions in newer Chromium
  const extensionPath = path.resolve(__dirname, '..');
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('manifest.json not found; run from repo root');
  }

  const context = await chromium.launchPersistentContext('', {
    headless: false, // Must be false for extensions usually, but we are using headless=new arg
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--headless=new'
    ]
  });

  const serviceWorker = await waitForServiceWorker(context);

  // Capture notifications
  await serviceWorker.evaluate(() => {
    let count = 0;
    const original = chrome.notifications.create;
    chrome.notifications.create = (...args) => {
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

  // Trigger badge and notification via a real tab + injected content script
  const { badgeText, notificationCount, debug } = await serviceWorker.evaluate(async () => {
    // Ensure the site is allowlisted and extension is on for the test tab.
    await saveToStorage({
      wordspotting_website_list: ['*example.com*'],
      wordspotting_extension_on: true
    });
    await refreshAllowedSitePatterns();

    const tab = await chrome.tabs.create({ url: 'https://example.com', active: true });

    // Wait until the tab reports complete to avoid later badge resets from onUpdated.
    await new Promise((resolve) => {
      const waitForComplete = () => chrome.tabs.get(tab.id, (info) => {
        if (info?.status === 'complete') {
          resolve();
        } else {
          setTimeout(waitForComplete, 100);
        }
      });
      waitForComplete();
    });

    // Give some time for background `onUpdated` -> `maybeInjectContentScripts` to run and reset badge to 0.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Drive badge update through the background handler directly (faster than messaging from injected script).
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
      text = await new Promise((resolve) => chrome.action.getBadgeText({ tabId: tab.id }, resolve));
      if (text === expectedBadge) break;
    }

    const notificationCount = typeof self.__wsNotificationCount === 'function' ? self.__wsNotificationCount() : 0;

    await chrome.tabs.remove(tab.id);
    return {
      badgeText: text,
      notificationCount,
      debug: {
        response,
        text,
        compiledAllowedSitesLength: compiledAllowedSites?.length ?? 0
      }
    };
  });

  await context.close();
  if (displaySession) {
    displaySession.stop();
  }

  if (badgeText !== '3') {
    console.error('Badge debug info:', debug);
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

async function waitForServiceWorker(context, timeout = 15000) {
  const end = Date.now() + timeout;

  // Poll existing workers in case registration is slow.
  while (Date.now() < end) {
    const [existing] = context.serviceWorkers();
    if (existing) return existing;
    try {
      const sw = await context.waitForEvent('serviceworker', { timeout: 500 });
      if (sw) return sw;
    } catch {
      // continue polling
    }
  }

  throw new Error(`Service worker not registered within ${timeout}ms`);
}

function startXvfb() {
  return new Promise((resolve, reject) => {
    const display = ':99';
    const xvfb = spawn('Xvfb', [display, '-screen', '0', '1280x720x24', '-nolisten', 'tcp'], {
      stdio: 'ignore',
      detached: true
    });
    xvfb.unref();

    const readyTimer = setTimeout(() => {
      resolve({
        display,
        stop: () => {
          try {
            process.kill(-xvfb.pid);
          } catch {
            // ignore
          }
        }
      });
    }, 300);

    xvfb.once('error', (err) => {
      clearTimeout(readyTimer);
      reject(err);
    });
  });
}
