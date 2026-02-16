import { describe, test, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as utils from '../entrypoints/shared/utils';
import { scanTextForMatches } from '../entrypoints/shared/core/scanner';

type BrowserMock = {
  storage: {
    sync: {
      set: Mock;
      get: Mock;
    };
  };
  runtime: {
    lastError: Error | null;
  };
};

describe('utils', () => {
  beforeEach(() => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.set = vi.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.());
    mockBrowser.storage.sync.get = vi.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({ example: 1 }));
    mockBrowser.runtime.lastError = null;
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test('trimAndClean removes whitespace', () => {
    expect(utils.trimAndClean('  hello world  ')).toBe('helloworld');
  });
  
  test('trimAndClean handles empty-like values', () => {
    expect(utils.trimAndClean('')).toBe('');
    expect(utils.trimAndClean(null)).toBe('');
    expect(utils.trimAndClean(undefined)).toBe('');
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
    const res = await utils.getFromStorage<{ example: number }>('example');
    expect(res.example).toBe(1);
  });

  test('saveToStorage and getFromStorage handle promise-returning storage', async () => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.set = vi.fn(() => Promise.resolve());
    mockBrowser.storage.sync.get = vi.fn(() => Promise.resolve({ foo: 'bar' }));

    await expect(utils.saveToStorage({ foo: 'bar' })).resolves.toBeUndefined();
    const res = await utils.getFromStorage<{ foo: string }>('foo');
    expect(res.foo).toBe('bar');
  });

  test('saveToStorage rejects on lastError', async () => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.runtime.lastError = new Error('fail');
    await expect(utils.saveToStorage({})).rejects.toBeInstanceOf(Error);
    mockBrowser.runtime.lastError = null;
  });

  test('getFromStorage rejects on lastError', async () => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.runtime.lastError = new Error('fail');
    await expect(utils.getFromStorage('x')).rejects.toBeInstanceOf(Error);
    mockBrowser.runtime.lastError = null;
  });

  test('getRandomInt stays within bounds', () => {
    for (let i = 0; i < 5; i += 1) {
      const n = utils.getRandomInt(5, 1);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  test('showAlert appends a toast', () => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    utils.showAlert('msg', 'title', true);
    const toast = document.querySelector('.ws-toast');
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toContain('msg');
    vi.runAllTimers(); // trigger fade/remove
  });
  
  test('showAlert defaults to error toast and message-only text', () => {
    document.body.innerHTML = '';
    utils.showAlert('plain message');
    const toast = document.querySelector('.ws-toast');
    expect(toast?.className).toContain('error');
    expect(toast?.textContent).toBe('plain message');
  });
  
  test('showAlert logs when document is unavailable', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('document', undefined);
    utils.showAlert('msg', 'title', false);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]?.[0]).toContain('Alert: title - msg');
    spy.mockRestore();
  });


  test('logit writes to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    utils.logit('hi');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  
  test('logit is silent in production mode', () => {
    vi.stubEnv('PROD', true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    utils.logit('hi');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('isIgnorableExtensionError detects transient extension runtime errors', () => {
    expect(utils.isIgnorableExtensionError(new Error('No tab with id: 42'))).toBe(true);
    expect(utils.isIgnorableExtensionError(new Error('Unexpected fatal error'))).toBe(false);
  });
  
  test('isIgnorableExtensionError handles non-Error values', () => {
    expect(utils.isIgnorableExtensionError('Invalid tab ID: 9')).toBe(true);
    expect(utils.isIgnorableExtensionError({ message: 'some object error' })).toBe(false);
  });

  test('logExtensionError suppresses ignorable errors and logs unexpected ones', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    utils.logExtensionError('context', new Error('No tab with id: 42'));
    utils.logExtensionError('context', new Error('Storage failed'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
  
  test('logExtensionError uses error logger for error level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    utils.logExtensionError('context', new Error('Storage failed'), 'error');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
  
  test('logExtensionError suppresses warn logs in production mode', () => {
    vi.stubEnv('PROD', true);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    utils.logExtensionError('context', new Error('Storage failed'), 'warn');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    vi.unstubAllEnvs();
  });

  test('buildSiteRegex returns null for invalid input', () => {
    expect(utils.buildSiteRegex(null)).toBeNull();
    expect(utils.buildSiteRegex('   ')).toBeNull();
  });
  
  test('buildSiteRegex returns null if both direct and wildcard compilation fail', () => {
    const ThrowingRegExp = vi.fn(() => {
      throw new Error('boom');
    });
    vi.stubGlobal('RegExp', ThrowingRegExp as unknown as RegExpConstructor);
    expect(utils.buildSiteRegex('example')).toBeNull();
  });

  test('buildSiteRegex converts wildcard patterns to usable regex', () => {
    const wildcard = utils.buildSiteRegex('*jobs/*');
    expect(wildcard).toBeInstanceOf(RegExp);
    expect(wildcard?.test('www.linkedin.com/jobs/view/123')).toBe(true);
  });

  test('isUrlAllowed handles empty list', () => {
    expect(utils.isUrlAllowed('https://x.com', [])).toBe(false);
  });
  
  test('isUrlAllowed returns false for invalid list entries', () => {
    expect(utils.isUrlAllowed('https://example.com', ['   '])).toBe(false);
  });
  
  test('isUrlAllowedCompiled returns false for missing inputs', () => {
    expect(utils.isUrlAllowedCompiled(undefined, [/example/i])).toBe(false);
    expect(utils.isUrlAllowedCompiled('https://example.com', [])).toBe(false);
  });
  
  test('isUrlAllowedCompiled handles invalid url input without throwing', () => {
    const compiled = utils.compileSitePatterns(['*example*']);
    expect(utils.isUrlAllowedCompiled('%%%not-a-url%%%', compiled)).toBe(false);
  });

  test('isUrlAllowed supports wildcard list entries', () => {
    expect(utils.isUrlAllowed('https://example.com/path', ['*example*'])).toBe(true);
    expect(utils.isUrlAllowed('https://bar.com/path', ['*example*'])).toBe(false);
  });

  test('compileSitePatterns handles non-array', () => {
    expect(utils.compileSitePatterns(null as unknown as string[])).toEqual([]);
  });

  test('buildPatternsForTab generates correct patterns', () => {
    const url = 'https://www.linkedin.com/jobs/view/123';
    const patterns = utils.buildPatternsForTab(url);
    expect(patterns.root).toBe('*linkedin.com*');
    expect(patterns.subdomain).toBe('*www.linkedin.com*');
    expect(patterns.path).toBe('*www.linkedin.com/jobs/view/123*');
    expect(patterns.full).toBe('https://www.linkedin.com/jobs/view/123');
  });

  test('buildPatternsForTab handles path with query', () => {
    const url = 'https://example.com/search?q=test';
    const patterns = utils.buildPatternsForTab(url);
    expect(patterns.path).toBe('*example.com/search*');
    expect(patterns.full).toBe('https://example.com/search?q=test');
  });
  
  test('buildPatternsForTab throws for invalid url', () => {
    expect(() => utils.buildPatternsForTab('not a url')).toThrow();
  });
  
  test('buildPatternsForTab throws for urls with empty hostname', () => {
    expect(() => utils.buildPatternsForTab('file:///tmp/test.txt')).toThrow('Invalid URL');
  });

  test('scanTextForMatches finds all occurrences', () => {
    const matches = scanTextForMatches(['foo'], 'foo bar foo');
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({ keyword: 'foo', index: 0, length: 3 });
    expect(matches[1]).toEqual({ keyword: 'foo', index: 8, length: 3 });
  });
});
