import { test as base, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

type ExtensionFixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({ browserName }, use, testInfo) => {
    if (browserName !== 'chromium') {
      throw new Error(`Unsupported browser for extension tests: ${browserName}`);
    }

    const extensionPath = path.resolve(process.cwd(), '.output', 'chrome-mv3-e2e');
    const headlessSetting = testInfo.project.use.headless;
    const headless = typeof headlessSetting === 'boolean' ? headlessSetting : true;

    const context = await base.chromium.launchPersistentContext('', {
      headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const worker = await waitForServiceWorker(context);
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const workerUrl = serviceWorker.url();
    const extensionId = workerUrl.split('/')[2];
    if (!extensionId) {
      throw new Error('Failed to derive extension id from service worker URL');
    }
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';

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
