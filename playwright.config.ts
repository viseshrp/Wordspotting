import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    // Extension service worker is not reliably available in headless mode.
    // CI runs this under xvfb-run, so headed is supported there.
    headless: false,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
