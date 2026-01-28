import * as utils from '@/utils/utils';
import { browser } from 'wxt/browser';

// Mock document for showAlert
document.body.innerHTML = '';

describe('utils', () => {

  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(utils.buildSiteRegex('*example*')?.test('https://www.example.com')).toBe(true);
  });

  test('isUrlAllowed matches with compiled patterns', () => {
    const compiled = utils.compileSitePatterns(['*example*', 'test\\.com']);
    expect(utils.isUrlAllowedCompiled('https://foo.example.org', compiled)).toBe(true);
    expect(utils.isUrlAllowedCompiled('https://bar.com', compiled)).toBe(false);
  });

  test('saveToStorage and getFromStorage delegate to browser.storage.sync', async () => {
    await utils.saveToStorage({ foo: 'bar' });
    expect(browser.storage.sync.set).toHaveBeenCalled();
    await utils.getFromStorage('example');
    expect(browser.storage.sync.get).toHaveBeenCalled();
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
    expect(toast?.textContent).toContain('msg');
    jest.runAllTimers();
  });

  test('logit writes to console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    utils.logit('hi');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('buildSiteRegex returns null for invalid input', () => {
    expect(utils.buildSiteRegex(null as any)).toBeNull();
  });

  test('isUrlAllowed handles empty list', () => {
    expect(utils.isUrlAllowed('https://x.com', [])).toBe(false);
  });

  test('compileSitePatterns handles non-array', () => {
    expect(utils.compileSitePatterns(null as any)).toEqual([]);
  });

  test('buildPatternsForTab generates correct patterns', () => {
    const url = "https://www.linkedin.com/jobs/view/123";
    const patterns = utils.buildPatternsForTab(url);
    expect(patterns.root).toBe("*linkedin.com*");
    expect(patterns.subdomain).toBe("*www.linkedin.com*");
    expect(patterns.path).toBe("*www.linkedin.com/jobs/view/123*");
    expect(patterns.full).toBe("https://www.linkedin.com/jobs/view/123");
  });

  // From options.spec.js
  test('partitionSitePatterns filters invalid', () => {
    const { valid, invalid } = utils.partitionSitePatterns(['*good*', '']);
    expect(valid).toContain('*good*');
    expect(invalid).toContain('');
  });

  test('mergeUnique deduplicates', () => {
    const merged = utils.mergeUnique(['a', 'b'], ['b', 'c']);
    expect(merged.sort()).toEqual(['a', 'b', 'c']);
  });
});
