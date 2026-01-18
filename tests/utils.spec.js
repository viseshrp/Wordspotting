describe('utils', () => {
  let utils;

  beforeEach(() => {
    global.chrome.storage.sync.set = jest.fn((_obj, cb) => cb?.());
    global.chrome.storage.sync.get = jest.fn((_keys, cb) => cb?.({ example: 1 }));
    utils = require('../src/js/utils.js');
  });

  test('trimAndClean removes whitespace', () => {
    expect(utils.trimAndClean('  hello world  ')).toBe('helloworld');
  });

  test('isValidObj', () => {
    expect(utils.isValidObj({ a: 1 })).toBe(true);
    expect(utils.isValidObj({})).toBe(false);
    expect(utils.isValidObj(null)).toBe(false);
  });

  test('buildSiteRegex handles regex and glob', () => {
    expect(utils.buildSiteRegex('example')).toBeInstanceOf(RegExp);
    expect(utils.buildSiteRegex('*example*').test('https://www.example.com')).toBe(true);
  });

  test('isUrlAllowed matches with compiled patterns', () => {
    const compiled = utils.compileSitePatterns(['*example*', 'test\\.com']);
    expect(utils.isUrlAllowedCompiled('https://foo.example.org', compiled)).toBe(true);
    expect(utils.isUrlAllowedCompiled('https://bar.com', compiled)).toBe(false);
  });

  test('saveToStorage and getFromStorage delegate to chrome.storage.sync', async () => {
    await utils.saveToStorage({ foo: 'bar' });
    expect(global.chrome.storage.sync.set).toHaveBeenCalled();
    const res = await utils.getFromStorage('example');
    expect(res.example).toBe(1);
  });

  test('saveToStorage rejects on lastError', async () => {
    global.chrome.runtime.lastError = new Error('fail');
    await expect(utils.saveToStorage({})).rejects.toBeInstanceOf(Error);
    global.chrome.runtime.lastError = null;
  });

  test('getFromStorage rejects on lastError', async () => {
    global.chrome.runtime.lastError = new Error('fail');
    await expect(utils.getFromStorage('x')).rejects.toBeInstanceOf(Error);
    global.chrome.runtime.lastError = null;
  });

  test('getRandomInt stays within bounds', () => {
    for (let i = 0; i < 5; i++) {
      const n = utils.getRandomInt(5, 1);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  test('showAlert appends a toast', () => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
    utils.showAlert('msg', 'title', true);
    const toast = document.querySelector('.ws-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('msg');
    jest.runAllTimers(); // trigger fade/remove
  });

  test('logit writes to console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    utils.logit('hi');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('buildSiteRegex returns null for invalid input', () => {
    expect(utils.buildSiteRegex(null)).toBeNull();
  });

  test('isUrlAllowed handles empty list', () => {
    expect(utils.isUrlAllowed('https://x.com', [])).toBe(false);
  });

  test('compileSitePatterns handles non-array', () => {
    expect(utils.compileSitePatterns(null)).toEqual([]);
  });

  test('buildPatternsForTab generates correct patterns', () => {
    const url = "https://www.linkedin.com/jobs/view/123";
    const patterns = utils.buildPatternsForTab(url);
    expect(patterns.root).toBe("*linkedin.com*");
    expect(patterns.subdomain).toBe("*www.linkedin.com*");
    expect(patterns.path).toBe("*www.linkedin.com/jobs/view/123*");
    expect(patterns.full).toBe("https://www.linkedin.com/jobs/view/123");
  });

  test('buildPatternsForTab handles path with query', () => {
    const url = "https://example.com/search?q=test";
    const patterns = utils.buildPatternsForTab(url);
    expect(patterns.path).toBe("*example.com/search*");
    expect(patterns.full).toBe("https://example.com/search?q=test");
  });
});
