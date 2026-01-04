describe('content helpers', () => {
  let content;

  beforeEach(() => {
    global.document = { body: { innerText: '' } };
    global.getFromStorage = jest.fn(async () => ({}));
    global.saveToStorage = jest.fn(async () => ({}));
    global.logit = jest.fn();
    global.isValidObj = (obj) => obj !== null && typeof obj !== 'undefined' && Object.keys(obj).length > 0;
    const utils = require('../js/utils.js');
    global.compileSitePatterns = utils.compileSitePatterns;
    global.isUrlAllowedCompiled = utils.isUrlAllowedCompiled;
    jest.useFakeTimers();
    content = require('../js/content.js');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.resetModules();
  });

  test('getWordList finds keywords case-insensitively', () => {
    document.body.innerText = 'This has h1b and visa.';
    const result = content.getWordList(['H1B', 'visa']);
    expect(result.sort()).toEqual(['H1B', 'visa']);
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
    document.body.innerText = 'visa only';
    global.getFromStorage = jest.fn(async (key) => {
      if (key === "wordspotting_word_list") {
        return { wordspotting_word_list: ['visa'] };
      }
      return {};
    });
    global.chrome.runtime.sendMessage = jest.fn((msg, cb) => cb && cb({ ack: 'ok' }));
    await content.performScan({ aborted: false });
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
  });

  test('scheduleScan runs without error', () => {
    global.requestIdleCallback = (cb) => cb();
    expect(() => content.scheduleScan()).not.toThrow();
  });
});
