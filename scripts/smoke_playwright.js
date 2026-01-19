/**
 * Playwright-based smoke test:
 * - Loads the bundled extension (dist/) in headless Chromium
 * - Opens the options page
 * - Invokes self.runSmokeTestLogic() in the background service worker
 * - Verifies the returned badge text and notification count
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-chromium');

async function main() {
    const displaySession = null; // Headless=new doesn't need Xvfb usually
    const _headless = true;

    // Use the dist folder for the packed extension
    const extensionPath = path.resolve(__dirname, '../dist');
    const manifestPath = path.join(extensionPath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`manifest.json not found in ${extensionPath}; run 'npm run build' first.`);
    }

    const context = await chromium.launchPersistentContext('', {
        headless: false, // Must be false for extensions usually, but we use headless=new arg
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--headless=new'
        ]
    });

    const serviceWorker = await waitForServiceWorker(context);

    // Capture notifications hook (must happen before logic runs if logic triggers notifications immediately)
    // But runSmokeTestLogic calls methods that trigger notification.
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
    // Path updated to match webpack output structure
    const optionsUrl = `chrome-extension://${extensionId}/pages/options.html`;

    const page = await context.newPage();
    await page.goto(optionsUrl);

    // Trigger the smoke test logic defined in background.js
    const { badgeText, notificationCount, debug } = await serviceWorker.evaluate(async () => {
        if (typeof self.runSmokeTestLogic !== 'function') {
            throw new Error('runSmokeTestLogic not found in background script');
        }
        return await self.runSmokeTestLogic();
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

    // Poll existing workers
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

function _startXvfb() {
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
