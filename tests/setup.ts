import { vi } from 'vitest';

const browserMock = {
  runtime: {
    id: 'test-runtime',
    lastError: null as Error | null,
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn(() => Promise.resolve()),
    getURL: vi.fn((targetPath: string) => `chrome-extension://test/${targetPath}`),
    openOptionsPage: vi.fn(),
  },
  storage: {
    sync: {
      set: vi.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.()),
      get: vi.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({})),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  permissions: {
    contains: vi.fn((_perm: unknown, cb?: (result: boolean) => void) => cb?.(true)),
    request: vi.fn((_perm: unknown, cb?: (result: boolean) => void) => cb?.(true)),
  },
  action: {
    setBadgeText: vi.fn(() => Promise.resolve()),
    setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  },
  notifications: {
    create: vi.fn(() => Promise.resolve()),
  },
  tabs: {
    create: vi.fn(() => Promise.resolve()),
    query: vi.fn(() => Promise.resolve([])),
    get: vi.fn(() => Promise.resolve({ id: 1, url: 'https://example.com' })),
    reload: vi.fn(() => Promise.resolve()),
    sendMessage: vi.fn(() => Promise.resolve({ word_list: [] })),
  },
  scripting: {
    executeScript: vi.fn(() => Promise.resolve([{ result: false }])),
    insertCSS: vi.fn(() => Promise.resolve()),
  },
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
  constructor(callback: () => void) {
    this.cb = callback;
  }
  observe() {}
  disconnect() {}
} as unknown as typeof MutationObserver;

(globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve(''),
  }),
) as unknown as typeof fetch;

if (!global.URL) {
  (globalThis as unknown as { URL: typeof URL }).URL = URL;
}
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = vi.fn(() => 'blob:wordspotting');
}
