/**
 * Tests for content helpers via module exports.
 */
const { getWordList, debounce, hashString, getBodyTextSnapshot } = require('../js/content.js');

describe('getWordList', () => {
  beforeEach(() => {
    document.body.innerText = '';
  });

  test('finds simple keywords case-insensitively', () => {
    document.body.innerText = 'This has h1b and visa.';
    const result = getWordList(['H1B', 'visa']);
    expect(result.sort()).toEqual(['H1B', 'visa']);
  });

  test('skips invalid regex', () => {
    document.body.innerText = 'foo';
    const result = getWordList(['[bad']);
    expect(result).toEqual([]);
  });

  test('uses provided bodyText', () => {
    const result = getWordList(['foo'], 'foo bar');
    expect(result).toEqual(['foo']);
  });
});

describe('debounce', () => {
  test('debounce only calls once', (done) => {
    let count = 0;
    const fn = debounce(() => { count += 1; }, 10);
    fn(); fn(); fn();
    setTimeout(() => {
      expect(count).toBe(1);
      done();
    }, 30);
  });
});

describe('hashString', () => {
  test('produces stable hash', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abcd'));
  });
});

describe('getBodyTextSnapshot', () => {
  test('caches within window', async () => {
    document.body.innerText = 'first';
    const signal = { aborted: false };
    const first = await getBodyTextSnapshot(signal);
    document.body.innerText = 'second';
    const second = await getBodyTextSnapshot(signal);
    expect(first).toBe(second);
  });
});
