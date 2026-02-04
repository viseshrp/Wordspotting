let content: typeof import('../entrypoints/injected');

type BrowserMock = {
  storage: {
    sync: {
      set: jest.Mock;
      get: jest.Mock;
    };
  };
  runtime: {
    id: string;
    sendMessage: jest.Mock;
    getURL: jest.Mock;
  };
};

describe('content helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as unknown as { __WORDSPOTTING_CONTENT_LOADED__: boolean }).__WORDSPOTTING_CONTENT_LOADED__ = false;
    (globalThis as unknown as { document: Document }).document = document;
    document.body.innerHTML = '<div></div>';

    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.get = jest.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({}));
    mockBrowser.storage.sync.set = jest.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.());

    console.warn = jest.fn();

    // Mock CSS highlights
    (globalThis as unknown as { CSS: unknown }).CSS = { highlights: { set: jest.fn(), delete: jest.fn() } };
    (globalThis as unknown as { Highlight: unknown }).Highlight = jest.fn();
    (globalThis as unknown as { Range: unknown }).Range = jest.fn(() => ({ setStart: jest.fn(), setEnd: jest.fn() }));
    (globalThis as unknown as { NodeFilter: unknown }).NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

    // Mock Worker
    (globalThis as unknown as { Worker: unknown }).Worker = jest.fn(() => ({
      addEventListener: jest.fn(),
      postMessage: jest.fn(),
      terminate: jest.fn()
    }));

    jest.useFakeTimers();
    mockBrowser.runtime.id = 'test-runtime';
    mockBrowser.runtime.sendMessage = jest.fn(() => Promise.resolve({ ack: 'ok' }));

    mockBrowser.runtime.getURL = jest.fn((path: string) => `chrome-extension://test/${path}`);
    (globalThis as unknown as { fetch: typeof fetch }).fetch = jest.fn(() =>
      Promise.reject(new Error('fetch blocked'))
    ) as unknown as typeof fetch;

    (globalThis as unknown as { URL: typeof URL }).URL.createObjectURL = jest.fn(() => 'blob:wordspotting');

    content = require('../entrypoints/injected');
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('getWordList finds keywords case-insensitively', () => {
    document.body.innerText = 'This has alpha and beta.';
    const result = content.getWordList(['ALPHA', 'beta']);
    expect(result.sort()).toEqual(['ALPHA', 'beta']);
  });

  test('getWordList skips invalid regex', () => {
    document.body.innerText = 'foo';
    const result = content.getWordList(['[bad']);
    expect(result).toEqual([]);
  });

  test('getWordList uses provided bodyText', () => {
    const result = content.getWordList(['foo'], 'foo bar');
    expect(result).toEqual(['foo']);
  });

  test('debounce only calls once', () => {
    let count = 0;
    const fn = content.debounce(() => { count += 1; }, 10);
    fn(); fn(); fn();
    jest.advanceTimersByTime(20);
    expect(count).toBe(1);
  });

  test('hashString is stable', () => {
    expect(content.hashString('abc')).toBe(content.hashString('abc'));
  });

  test('getBodyTextSnapshot caches within window', async () => {
    document.body.innerText = 'first';
    const signal = { aborted: false } as AbortSignal;
    const first = await content.getBodyTextSnapshot(signal);
    document.body.innerText = 'second';
    const second = await content.getBodyTextSnapshot(signal);
    expect(first).toBe(second);
  });

  test('getBodyTextSnapshot aborts when signal aborted', async () => {
    const signal = { aborted: true } as AbortSignal;
    const text = await content.getBodyTextSnapshot(signal);
    expect(text).toBe('');
  });

  test('performScan sends message when keywords match', async () => {
    document.body.innerText = 'sample keyword';
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.get = jest.fn((keys: unknown, cb?: (items: Record<string, unknown>) => void) => {
      if (Array.isArray(keys)) {
        cb?.({ wordspotting_word_list: ['keyword'], wordspotting_highlight_on: false });
        return;
      }
      if (keys === 'wordspotting_word_list') {
        cb?.({ wordspotting_word_list: ['keyword'] });
        return;
      }
      cb?.({});
    });
    await content.performScan({ aborted: false } as AbortSignal);
    expect(browser.runtime.sendMessage).toHaveBeenCalled();
  });

  test('performScan applies highlights when enabled', async () => {
    document.body.innerText = 'sample keyword';

    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.get = jest.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({
      wordspotting_word_list: ['keyword'],
      wordspotting_highlight_on: true,
      wordspotting_highlight_color: '#FFFF00'
    }));

    const results = { '0': [{ keyword: 'keyword', index: 0, length: 7 }] };
    const textNode = document.createTextNode('keyword');
    const textNodes = [textNode];

    content.applyHighlights(results, textNodes, '#FFFF00');
    expect((globalThis as unknown as { CSS: { highlights: { set: jest.Mock } } }).CSS.highlights.set).toHaveBeenCalled();
  });

  test('scheduleScan runs without error', () => {
    (globalThis as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback = (cb) => {
      cb();
      return 0;
    };
    expect(() => content.scheduleScan()).not.toThrow();
  });
});
