// Jest setup: provide global mocks for Chrome APIs and browser-y globals.

global.chrome = {
  runtime: {
    lastError: null,
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn()
  },
  storage: {
    sync: {
      set: jest.fn((_obj, cb) => cb?.()),
      get: jest.fn((_keys, cb) => cb?.({}))
    }
  },
  permissions: {
    contains: jest.fn((_, cb) => cb?.(true)),
    request: jest.fn((_, cb) => cb?.(true))
  },
  action: {
    setBadgeText: jest.fn()
  },
  notifications: {
    create: jest.fn()
  },
  tabs: {
    create: jest.fn(),
    query: jest.fn()
  },
  scripting: {
    executeScript: jest.fn(),
    insertCSS: jest.fn()
  }
};

global.importScripts = () => {};
global.requestIdleCallback = (cb) => cb();
global.cancelIdleCallback = () => {};
global.MutationObserver = class {
  constructor(callback) { this.cb = callback; }
  observe() {}
  disconnect() {}
};
