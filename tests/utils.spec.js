const utils = require('../js/utils.js');

describe('utils', () => {
  test('trimAndClean removes whitespace', () => {
    expect(utils.trimAndClean('  hello world  ')).toBe('helloworld');
  });

  test('isValidObj', () => {
    expect(utils.isValidObj({ a: 1 })).toBe(true);
    expect(utils.isValidObj({})).toBe(false);
    expect(utils.isValidObj(null)).toBe(false);
  });

  test('buildSiteRegex handles regex and glob', () => {
    expect(utils.buildSiteRegex('linkedin')).toBeInstanceOf(RegExp);
    expect(utils.buildSiteRegex('*linkedin*').test('https://www.linkedin.com')).toBe(true);
  });

  test('isUrlAllowed matches with compiled patterns', () => {
    const compiled = utils.compileSitePatterns(['*example*', 'test\\.com']);
    expect(utils.isUrlAllowedCompiled('https://foo.example.org', compiled)).toBe(true);
    expect(utils.isUrlAllowedCompiled('https://bar.com', compiled)).toBe(false);
  });
});
