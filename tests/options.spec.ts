import { describe, test, expect } from 'vitest';
/**
 * Smoke-test options helpers by loading file in JSDOM and using exported utils.
 */
import * as utils from '../entrypoints/shared/utils';
import { partitionSitePatterns, mergeUnique } from '../entrypoints/options/main';

describe('options helpers', () => {
  test('partitionSitePatterns filters invalid', () => {
    const { valid, invalid } = partitionSitePatterns(['*good*', ''], utils.buildSiteRegex);
    expect(valid).toContain('*good*');
    expect(invalid).toContain('');
  });

  test('mergeUnique deduplicates', () => {
    const merged = mergeUnique(['a', 'b'], ['b', 'c']);
    expect(merged.sort()).toEqual(['a', 'b', 'c']);
  });

});
