// Mock document for options
const utils = require('../assets/js/utils.js');
const { partitionSitePatterns } = require('../assets/options/options.js');

describe('options helpers', () => {
  test('partitionSitePatterns filters invalid', () => {
    // Need to bind buildSiteRegex as it might be missing in context if not required properly
    const { valid, invalid } = partitionSitePatterns(['*good*', ''], utils.buildSiteRegex);
    expect(valid).toContain('*good*');
    expect(invalid).toContain('');
  });
});
