const utils = require('../assets/js/utils.js');

describe('utils', () => {
  beforeEach(() => {
    global.chrome.storage.sync.set = jest.fn((_obj, cb) => cb?.());
    global.chrome.storage.sync.get = jest.fn((_keys, cb) => cb?.({ example: 1 }));
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
});
