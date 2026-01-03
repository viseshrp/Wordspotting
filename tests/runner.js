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
let testQueue = [];

// --- Global Mocks (Available to all tests) ---

// Mock Chrome API
global.chrome = {
    runtime: {
        lastError: null,
        onInstalled: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        sendMessage: (msg, cb) => cb && cb({ack: "gotcha"})
    },
    storage: {
        sync: {
            set: (obj, cb) => cb && cb(),
            get: (keys, cb) => cb && cb({})
        }
    },
    action: {
        setBadgeText: () => {}
    },
    notifications: {
        create: () => {}
    },
    tabs: {
        create: () => {}
    }
};

// Mock DOM/Window APIs
global.window = {};
global.requestIdleCallback = (cb) => setTimeout(cb, 0); // Polyfill with timeout
global.location = { href: "http://example.com" };

global.MutationObserver = class {
    constructor(callback) {}
    observe(element, options) {}
    disconnect() {}
};

// Global 'test' function exposed to test files
// Now registers test for sequential execution
global.test = function(name, fn) {
    testQueue.push({ name, fn });
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

// Helper for 'importScripts' in service workers
global.importScripts = () => {};

async function runTestFile(filepath) {
    console.log(`\n${colors.bold('Running ' + filepath)}`);
    testQueue = []; // Clear queue for this file

    try {
        const content = fs.readFileSync(filepath, 'utf8');
        eval(content); // Executes describe/test calls, filling testQueue

        // Run tests sequentially
        for (const t of testQueue) {
            try {
                const result = t.fn();
                if (result && typeof result.then === 'function') {
                    await result;
                }
                console.log(`  ${colors.green('✓')} ${t.name}`);
                passed++;
            } catch (e) {
                console.log(`  ${colors.red('✗')} ${t.name}`);
                console.error(`    ${e.message}`);
                failed++;
            }
        }

    } catch (e) {
        console.error(colors.red('Error running test file:'), e);
        failed++;
    }
}

// Run all tests
const testDir = path.join(__dirname);

async function main() {
    const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
    for (const file of files) {
        await runTestFile(path.join(testDir, file));
    }

    console.log(`\n${colors.bold('Summary:')}`);
    console.log(`${colors.green(passed + ' passed')}, ${colors.red(failed + ' failed')}`);

    if (failed > 0) process.exit(1);
}

main();
