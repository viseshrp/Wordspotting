/**
 * Smoke-test options helpers by loading file in JSDOM and using exported utils.
 */
const fs = require('fs');
const path = require('path');
const utils = require('../js/utils.js');

describe('options helpers', () => {
  test('partitionSitePatterns filters invalid', () => {
    const code = fs.readFileSync(path.join(__dirname, '../js/options.js'), 'utf8');
    // Execute code to define functions in global
    eval(code);
    const { valid, invalid } = partitionSitePatterns(['*good*', '[bad']);
    expect(valid).toContain('*good*');
    expect(invalid).toContain('[bad');
  });

  test('mergeUnique deduplicates', () => {
    const code = fs.readFileSync(path.join(__dirname, '../js/options.js'), 'utf8');
    eval(code);
    const merged = mergeUnique(['a', 'b'], ['b', 'c']);
    expect(merged.sort()).toEqual(['a', 'b', 'c']);
  });
});
