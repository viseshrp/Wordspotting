// tests/utils.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load utils.js into global context
const utilsPath = path.join(__dirname, '../js/utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
vm.runInThisContext(utilsCode);

test('trimAndClean removes spaces', () => {
    expect(trimAndClean('  hello world  ')).toBe('helloworld');
});

test('trimAndClean handles empty/null', () => {
    expect(trimAndClean('')).toBe('');
    expect(trimAndClean(null)).toBe('');
});

test('isValidObj checks correctly', () => {
    expect(isValidObj({a: 1})).toBeTruthy();
    expect(isValidObj({})).toBeFalsy();
    expect(isValidObj(null)).toBeFalsy();
    expect(isValidObj(undefined)).toBeFalsy();
});
