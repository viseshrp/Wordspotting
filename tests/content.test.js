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

// Utils setup
const utilsPath = path.join(__dirname, '../js/utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
vm.runInThisContext(utilsCode);

// Load content.js code
const contentPath = path.join(__dirname, '../js/content.js');
let contentCode = fs.readFileSync(contentPath, 'utf8');

// Storage Mock Helper
let storageData = {
    wordspotting_extension_on: true,
    wordspotting_website_list: ["example.com"],
    wordspotting_word_list: []
};

global.chrome.storage.sync.get = (keys, cb) => {
    if (typeof keys === 'string') {
        cb({ [keys]: storageData[keys] });
    } else {
        cb(storageData);
    }
};

// Setup proceedWithSiteListCheck test environment
// Since proceedWithSiteListCheck is inside the closure, we can't call it directly unless we modify content.js to export it
// OR we use vm to run a script that calls it? No, it's not exported.
// BUT, the IIFE calls it.
// To test proceedWithSiteListCheck logic specifically regarding regex, we might need to expose it or
// rely on spying on 'talkToBackgroundScript' which is called if site matches.

// Let's spy on chrome.runtime.sendMessage to see if it was called.
let messageSent = false;
global.chrome.runtime.sendMessage = (msg, cb) => {
    messageSent = true;
    cb && cb({ack: "gotcha"});
};

// We reload the script for each test case to reset state?
// Or we just modify storage and run the IIFE logic again?
// We can't easily re-run the IIFE without re-evaling.

function runContentScript() {
    messageSent = false;
    vm.runInThisContext(contentCode);
    // We need to wait for promises. proceedWithSiteListCheck is async.
    return new Promise(resolve => setTimeout(resolve, 10));
}

test('getWordList finds simple keywords', () => {
    vm.runInThisContext(contentCode); // Load functions
    document.body.innerText = "This is a H1B visa test.";
    const result = getWordList(["H1B", "visa"]);
    expect(result.sort()).toEqual(["H1B", "visa"]);
});

// ... existing tests ...

test('getWordList ignores case', () => {
    vm.runInThisContext(contentCode);
    document.body.innerText = "h1b VISA";
    const result = getWordList(["H1B", "visa"]);
    expect(result.sort()).toEqual(["H1B", "visa"]);
});

test('getWordList handles user regex with groups correctly', () => {
    vm.runInThisContext(contentCode);
    document.body.innerText = "Check H1B status.";
    const result = getWordList(["(H1|h1)B"]);
    expect(result).toEqual(["(H1|h1)B"]);
});

// New Tests for Site List Logic
// We need to manipulate location.href and storageData

test('Site Check: Matches exact domain', async () => {
    global.location.href = "https://www.linkedin.com/jobs";
    storageData.wordspotting_website_list = ["linkedin.com"];

    await runContentScript();
    expect(messageSent).toBeTruthy();
});

test('Site Check: Matches glob pattern *linkedin*', async () => {
    global.location.href = "https://www.linkedin.com/jobs";
    storageData.wordspotting_website_list = ["*linkedin*"];

    await runContentScript();
    expect(messageSent).toBeTruthy();
});

test('Site Check: Does not match mismatched glob', async () => {
    global.location.href = "https://www.google.com";
    storageData.wordspotting_website_list = ["*linkedin*"];

    await runContentScript();
    expect(messageSent).toBeFalsy();
});

test('Site Check: Handles regex error gracefully and falls back to glob', async () => {
    global.location.href = "https://www.linkedin.com";
    // * at start is invalid regex, triggers fallback
    storageData.wordspotting_website_list = ["*linkedin*"];

    await runContentScript();
    expect(messageSent).toBeTruthy();
});
