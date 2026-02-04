// Jest setup: provide global mocks for browser APIs and browser-y globals.

const browserMock = {
  runtime: {
    id: 'test-runtime',
    lastError: null as Error | null,
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn(() => Promise.resolve()),
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    openOptionsPage: jest.fn()
  },
  storage: {
    sync: {
      set: jest.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.()),
      get: jest.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({}))
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  permissions: {
    contains: jest.fn((_perm: unknown, cb?: (result: boolean) => void) => cb?.(true)),
    request: jest.fn((_perm: unknown, cb?: (result: boolean) => void) => cb?.(true))
  },
  action: {
    setBadgeText: jest.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: jest.fn(() => Promise.resolve())
  },
  notifications: {
    create: jest.fn(() => Promise.resolve())
  },
  tabs: {
    create: jest.fn(() => Promise.resolve()),
    query: jest.fn(() => Promise.resolve([])),
    get: jest.fn(() => Promise.resolve({ id: 1, url: 'https://example.com' })),
    reload: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve({ word_list: [] }))
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: false }])),
    insertCSS: jest.fn(() => Promise.resolve())
  }
};

(globalThis as unknown as { browser: typeof browserMock }).browser = browserMock;
(globalThis as unknown as { chrome: typeof browserMock }).chrome = browserMock;

(globalThis as unknown as { defineUnlistedScript: (fn: () => void) => () => void }).defineUnlistedScript = (fn) => fn;
(globalThis as unknown as { defineBackground: (fn: () => void) => () => void }).defineBackground = (fn) => fn;
(globalThis as unknown as { defineContentScript: (cfg: unknown, fn?: () => void) => () => void }).defineContentScript = (_cfg, fn) => fn || (() => {});

(globalThis as unknown as { importScripts: () => void }).importScripts = () => {};
(globalThis as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback = (cb) => {
  cb();
  return 0;
};
(globalThis as unknown as { cancelIdleCallback: () => void }).cancelIdleCallback = () => {};
(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver = class {
  cb: () => void;
  constructor(callback: () => void) { this.cb = callback; }
  observe() {}
  disconnect() {}
} as unknown as typeof MutationObserver;

(globalThis as unknown as { fetch: typeof fetch }).fetch = jest.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve('')
  })
) as unknown as typeof fetch;

if (!global.URL) {
  (globalThis as unknown as { URL: typeof URL }).URL = URL;
}
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn(() => 'blob:wordspotting');
}
