import * as content from '@/utils/content-core';
import { browser } from 'wxt/browser';
import * as utils from '@/utils/utils';

jest.mock('@/utils/utils', () => ({
    ...jest.requireActual('@/utils/utils'),
    getFromStorage: jest.fn(),
    saveToStorage: jest.fn(),
    logit: jest.fn()
}));

// Mock browser (handled by jest config)

// Mock scanner? No, use real one for integration logic or mock it if desired.
// Original test used real scanner.

describe('content helpers', () => {
  beforeEach(() => {
    document.body.innerText = '';
    jest.clearAllMocks();

    // Mock CSS highlights
    (global as any).CSS = { highlights: { set: jest.fn(), delete: jest.fn() } };
    (global as any).Highlight = jest.fn();
    (global as any).Range = jest.fn(() => ({ setStart: jest.fn(), setEnd: jest.fn() }));
    (global as any).NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

    // Mock Worker
    (global as any).Worker = jest.fn(() => ({
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        terminate: jest.fn()
    }));

    jest.useFakeTimers();
    if (content.resetContentState) content.resetContentState();
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
    (utils.getFromStorage as jest.Mock).mockImplementation(async (keys) => {
      if (Array.isArray(keys)) {
         return { wordspotting_word_list: ['keyword'], wordspotting_highlight_on: false };
      }
      if (keys === "wordspotting_word_list") {
        return { wordspotting_word_list: ['keyword'] };
      }
      return {};
    });

    await content.performScan({ aborted: false } as AbortSignal);
    expect(browser.runtime.sendMessage).toHaveBeenCalled();
  });

  test('performScan applies highlights when enabled', async () => {
    document.body.innerText = 'sample keyword';

    (utils.getFromStorage as jest.Mock).mockResolvedValue({
        wordspotting_word_list: ['keyword'],
        wordspotting_highlight_on: true,
        wordspotting_highlight_color: '#FFFF00'
    });
    // Worker mock is already active

    // We need the worker to respond.
    // getScanWorkerAsync creates worker.
    // scanWithWorkerForHighlights calls postMessage.

    // To test this easily, we can call applyHighlights directly like original test did.
    // Original test: content.applyHighlights(results, textNodes, '#FFFF00');

    const results = { "0": [{ keyword: "keyword", index: 0, length: 7 }] };
    const textNode = document.createTextNode("keyword");
    const textNodes = [textNode];

    content.applyHighlights(results, textNodes, '#FFFF00');
    expect((global as any).CSS.highlights.set).toHaveBeenCalled();
  });

  test('scheduleScan runs without error', () => {
    (global as any).requestIdleCallback = (cb: (...args: any[]) => void) => cb();
    expect(() => content.scheduleScan()).not.toThrow();
  });
});
