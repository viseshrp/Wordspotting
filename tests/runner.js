// tests/runner.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Simple color output
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// Global state for tests
let passed = 0;
let failed = 0;

// Setup Global environment
global.chrome = {
    runtime: { lastError: null },
    storage: {
        sync: {
            set: (obj, cb) => cb && cb(),
            get: (keys, cb) => cb && cb({})
        }
    }
};

// Helper to run a test file
function runTestFile(filepath) {
    console.log(`\n${colors.bold('Running ' + filepath)}`);
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        eval(content);
    } catch (e) {
        console.error(colors.red('Error running test file:'), e);
        failed++;
    }
}

// Global 'test' function exposed to test files
global.test = function(name, fn) {
    try {
        fn();
        console.log(`  ${colors.green('✓')} ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ${colors.red('✗')} ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
};

// Global 'expect' function (minimal)
global.expect = function(actual) {
    return {
        toBe: (expected) => assert.strictEqual(actual, expected),
        toEqual: (expected) => assert.deepStrictEqual(actual, expected),
        toBeTruthy: () => assert.ok(actual),
        toBeFalsy: () => assert.ok(!actual),
        toContain: (item) => assert.ok(actual.includes(item))
    };
};

// Run all tests
const testDir = path.join(__dirname);
fs.readdirSync(testDir).forEach(file => {
    if (file.endsWith('.test.js')) {
        runTestFile(path.join(testDir, file));
    }
});

console.log(`\n${colors.bold('Summary:')}`);
console.log(`${colors.green(passed + ' passed')}, ${colors.red(failed + ' failed')}`);

if (failed > 0) process.exit(1);
