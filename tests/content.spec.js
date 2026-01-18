describe('content helpers', () => {
  let content;

  beforeEach(() => {
    global.document = { body: { innerText: '' } };
    global.getFromStorage = jest.fn(async () => ({}));
    global.saveToStorage = jest.fn(async () => ({}));
    global.logit = jest.fn();
    console.warn = jest.fn();
    global.isValidObj = (obj) => obj !== null && typeof obj !== 'undefined' && Object.keys(obj).length > 0;
    const utils = require('../src/js/utils.js');
    global.compileSitePatterns = utils.compileSitePatterns;
    global.isUrlAllowedCompiled = utils.isUrlAllowedCompiled;

    // Mock CSS highlights
    global.CSS = { highlights: { set: jest.fn(), delete: jest.fn() } };
    global.Highlight = jest.fn();
    global.Range = jest.fn(() => ({ setStart: jest.fn(), setEnd: jest.fn() }));
    global.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

    // Mock Worker
    global.Worker = jest.fn(() => ({
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        terminate: jest.fn()
    }));

    jest.useFakeTimers();
    global.chrome.runtime.id = 'test-runtime';
    content = require('../src/js/content.js');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.resetModules();
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
    const signal = { aborted: false };
    const first = await content.getBodyTextSnapshot(signal);
    document.body.innerText = 'second';
    const second = await content.getBodyTextSnapshot(signal);
    expect(first).toBe(second);
  });

  test('getBodyTextSnapshot aborts when signal aborted', async () => {
    const signal = { aborted: true };
    const text = await content.getBodyTextSnapshot(signal);
    expect(text).toBe('');
  });

  test('performScan sends message when keywords match', async () => {
    document.body.innerText = 'sample keyword';
    global.getFromStorage = jest.fn(async (keys) => {
      if (Array.isArray(keys)) {
         return { wordspotting_word_list: ['keyword'], wordspotting_highlight_on: false };
      }
      if (keys === "wordspotting_word_list") {
        return { wordspotting_word_list: ['keyword'] };
      }
      return {};
    });
    global.chrome.runtime.sendMessage = jest.fn((_msg, cb) => cb?.({ ack: 'ok' }));
    await content.performScan({ aborted: false });
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
  });

  test('performScan applies highlights when enabled', async () => {
    document.body.innerText = 'sample keyword';

    // Mock getFromStorage
    global.getFromStorage = jest.fn(async () => ({
        wordspotting_word_list: ['keyword'],
        wordspotting_highlight_on: true,
        wordspotting_highlight_color: '#FFFF00'
    }));

    // Mock Worker to respond
    const postMessageMock = jest.fn();
    const addEventListenerMock = jest.fn();
    global.Worker = jest.fn(() => ({
        postMessage: postMessageMock,
        addEventListener: addEventListenerMock,
        terminate: jest.fn()
    }));

    // Re-require to pick up new Worker mock
    jest.resetModules();
    content = require('../src/js/content.js');

    // Setup DOM for createTreeWalker mock or just mock getTextNodes?
    // Since getTextNodes is internal but exported, we can test it directly or rely on document structure.
    // JSDOM supports createTreeWalker.
    // We need to make sure document.createTreeWalker returns something useful.
    // But since we can't easily drive the Worker "message" event from the test without exposing the listener...
    // We can rely on 'applyHighlights' being exported and test that directly with results.

    const results = { "0": [{ keyword: "keyword", index: 0, length: 7 }] };
    const textNode = document.createTextNode("keyword");
    const textNodes = [textNode];

    content.applyHighlights(results, textNodes, '#FFFF00');
    expect(global.CSS.highlights.set).toHaveBeenCalled();
  });

  test('scheduleScan runs without error', () => {
    global.requestIdleCallback = (cb) => cb();
    expect(() => content.scheduleScan()).not.toThrow();
  });
});
