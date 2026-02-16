import { describe, expect, test } from 'vitest';
import {
  buildCombinedRegex,
  hashString,
  normalizeKeywords,
  scanChunksForMatches,
  scanTextForKeywords,
  scanTextForMatches
} from '../entrypoints/shared/core/scanner';

describe('scanner helpers', () => {
  test('normalizeKeywords returns only non-empty strings', () => {
    expect(normalizeKeywords(['alpha', '', '  ', null, 1, 'beta'])).toEqual(['alpha', 'beta']);
    expect(normalizeKeywords('alpha')).toEqual([]);
  });
  
  test('buildCombinedRegex returns null when no valid regex patterns exist', () => {
    expect(buildCombinedRegex(['[invalid'])).toBeNull();
  });

  test('buildCombinedRegex keeps valid patterns and maps them', () => {
    const combined = buildCombinedRegex(['foo', '[invalid', 'bar']);
    expect(combined).not.toBeNull();
    const matched = scanTextForKeywords(['foo', '[invalid', 'bar'], 'foo ... bar');
    expect(matched.sort()).toEqual(['bar', 'foo']);
  });
  
  test('scanTextForKeywords handles invalid inputs', () => {
    expect(scanTextForKeywords([], 'text')).toEqual([]);
    expect(scanTextForKeywords(['[invalid'], 'text')).toEqual([]);
    expect(scanTextForKeywords(['text'], null)).toEqual([]);
  });
  
  test('scanTextForKeywords returns unique found keywords', () => {
    const found = scanTextForKeywords(['foo', 'bar'], 'foo and bar and foo');
    expect(found.sort()).toEqual(['bar', 'foo']);
  });
  
  test('scanTextForMatches returns all match ranges', () => {
    const matches = scanTextForMatches(['foo', 'bar'], 'foo x bar x foo');
    expect(matches).toEqual([
      { keyword: 'foo', index: 0, length: 3 },
      { keyword: 'bar', index: 6, length: 3 },
      { keyword: 'foo', index: 12, length: 3 }
    ]);
  });
  
  test('scanTextForMatches returns empty for invalid keyword regex', () => {
    expect(scanTextForMatches(['[invalid'], 'text')).toEqual([]);
  });

  test('scanChunksForMatches returns chunk-indexed matches', () => {
    const results = scanChunksForMatches(['foo', 'bar'], [
      { id: 0, text: 'foo x' },
      { id: 1, text: 'no hits' },
      { id: 2, text: 'bar x foo' }
    ]);

    expect(results).toEqual({
      0: [{ keyword: 'foo', index: 0, length: 3 }],
      2: [
        { keyword: 'bar', index: 0, length: 3 },
        { keyword: 'foo', index: 6, length: 3 }
      ]
    });
  });

  test('scanChunksForMatches ignores invalid chunks', () => {
    expect(scanChunksForMatches(['foo'], [null, { id: 'x', text: 'foo' }, { id: 1, text: 1 }, { id: 2, text: 'foo' }])).toEqual({
      2: [{ keyword: 'foo', index: 0, length: 3 }]
    });
  });
  
  test('hashString is deterministic and input-sensitive', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abcd'));
  });
});
