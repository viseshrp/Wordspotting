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

/* global refreshAllowedSitePatterns */

async function main() {
  const useXvfb = process.platform === 'linux' && !process.env.DISPLAY;
  const displaySession = useXvfb ? await startXvfb() : null;
  const headless = false; // Extensions require headful; Xvfb handles CI.
  const extensionPath = path.resolve(__dirname, '..');
  if (!fs.existsSync(path.join(extensionPath, 'manifest.json'))) {
    throw new Error('manifest.json not found; run from repo root');
  }

  const context = await chromium.launchPersistentContext('', {
    headless,
    env: {
      ...process.env,
      ...(displaySession ? { DISPLAY: displaySession.display } : {})
    },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      ...(headless ? ['--headless=new'] : [])
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
  const { badgeText, notificationCount } = await serviceWorker.evaluate(async () => {
    // Ensure the site is allowlisted and extension is on for the test tab.
    await saveToStorage({
      wordspotting_website_list: ['*example.com*'],
      wordspotting_extension_on: true
    });
    await refreshAllowedSitePatterns();

    const tab = await chrome.tabs.create({ url: 'https://example.com', active: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => new Promise((resolve) => {
        chrome.runtime.sendMessage({ wordfound: true, keyword_count: 3 }, () => resolve(true));
        setTimeout(resolve, 300);
      })
    });

    // Allow the message to propagate and badge to update.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const text = await new Promise((resolve) => chrome.action.getBadgeText({ tabId: tab.id }, resolve));
    const notificationCount = typeof self.__wsNotificationCount === 'function' ? self.__wsNotificationCount() : 0;

    await chrome.tabs.remove(tab.id);
    return { badgeText: text, notificationCount };
  });

  await context.close();
  if (displaySession) {
    displaySession.stop();
  }

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
