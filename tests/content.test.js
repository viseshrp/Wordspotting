// tests/content.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock DOM
global.document = {
    body: {
        innerText: "Hello H1B World"
    }
};

global.window = {};
global.requestIdleCallback = (cb) => cb();
global.location = { href: "http://example.com" };

// Mock Chrome API completely for content.js
global.chrome = {
    runtime: {
        lastError: null,
        onMessage: {
            addListener: () => {}
        },
        sendMessage: (msg, cb) => cb && cb({ack: "gotcha"})
    },
    storage: {
        sync: {
            set: (obj, cb) => cb && cb(),
            get: (keys, cb) => cb && cb({})
        }
    }
};

// Setup utils first (as content.js relies on them)
// We need to implement dummy versions of utils used in content.js if we don't load utils.js
// OR we load utils.js first.
// Let's implement dummies for isolation or load utils.js.
// Loading utils.js is better integration.
const utilsPath = path.join(__dirname, '../js/utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
vm.runInThisContext(utilsCode);


// Load content.js code
const contentPath = path.join(__dirname, '../js/content.js');
let contentCode = fs.readFileSync(contentPath, 'utf8');

// content.js has an IIFE that runs immediately: (async function() { ... })();
// This will try to run getFromStorage etc.
// We mocked chrome.storage so it should be fine, but it might log errors if we don't set expected storage values.
// We can silence console.error/log for the loading phase or just let it run.

// Helper to update storage mock
let storageData = {
    wordspotting_extension_on: true,
    wordspotting_website_list: ["example.com"],
    wordspotting_word_list: []
};

// Override chrome.storage.sync.get for tests
global.chrome.storage.sync.get = (keys, cb) => {
    // Return all or specific
    if (typeof keys === 'string') {
        cb({ [keys]: storageData[keys] });
    } else {
        cb(storageData);
    }
};

vm.runInThisContext(contentCode);

// Tests
test('getWordList finds simple keywords', () => {
    document.body.innerText = "This is a H1B visa test.";
    const result = getWordList(["H1B", "visa"]);
    expect(result.sort()).toEqual(["H1B", "visa"]);
});

test('getWordList ignores case', () => {
    document.body.innerText = "h1b VISA";
    const result = getWordList(["H1B", "visa"]);
    expect(result.sort()).toEqual(["H1B", "visa"]);
});

test('getWordList handles user regex with groups correctly', () => {
    document.body.innerText = "Check H1B status.";
    // User provides regex with capturing group
    const result = getWordList(["(H1|h1)B"]);
    expect(result).toEqual(["(H1|h1)B"]);
});

test('getWordList handles multiple complex regexes', () => {
    document.body.innerText = "We need US Citizen and Java skills.";
    const result = getWordList(["US (Citizen|citizen)", "Java(script)?"]);
    expect(result.sort()).toEqual(["Java(script)?", "US (Citizen|citizen)"]);
});

test('getWordList returns empty if no matches', () => {
    document.body.innerText = "Nothing here.";
    const result = getWordList(["foobar"]);
    expect(result).toEqual([]);
});
