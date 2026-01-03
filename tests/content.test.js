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

// Override requestIdleCallback to be synchronous for tests
global.requestIdleCallback = (cb) => cb();

// Utils setup
const utilsPath = path.join(__dirname, '../js/utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
vm.runInThisContext(utilsCode);

// Load content.js code
const contentPath = path.join(__dirname, '../js/content.js');
const contentCode = fs.readFileSync(contentPath, 'utf8');

// Global Test State
let storageData = {
    wordspotting_extension_on: true,
    wordspotting_website_list: ["example.com"],
    wordspotting_word_list: []
};
let messageResolver = null;

// Mock Storage
global.chrome.storage.sync.get = (keys, cb) => {
    // Return via callback immediately
    if (typeof keys === 'string') {
        cb({ [keys]: storageData[keys] });
    } else {
        cb(storageData);
    }
};

// Mock Runtime SendMessage
global.chrome.runtime.sendMessage = (msg, cb) => {
    if (messageResolver) {
        messageResolver(msg);
        messageResolver = null;
    }
    cb && cb({ack: "gotcha"});
};

/**
 * Runs the content script and waits for a sendMessage call.
 * Returns the message if sent, or null if timeout.
 */
function runScriptAndWaitForMessage(timeout = 1000) {
    return new Promise((resolve) => {
        let timer = setTimeout(() => {
            // Check if resolver is still valid (might have been called)
            if (messageResolver) {
                messageResolver = null;
                resolve(null); // Timeout
            }
        }, timeout);

        messageResolver = (msg) => {
            clearTimeout(timer);
            resolve(msg);
        };

        // Execute script
        vm.runInThisContext(contentCode);
    });
}

// Tests for Logic Functions (using vm to expose them globally first)
vm.runInThisContext(contentCode);

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
    const result = getWordList(["(H1|h1)B"]);
    expect(result).toEqual(["(H1|h1)B"]);
});


// Tests for Async Integration (Site Checking)

test('Site Check: Matches exact domain', async () => {
    global.location.href = "https://www.linkedin.com/jobs";
    storageData.wordspotting_website_list = ["linkedin.com"];
    storageData.wordspotting_word_list = ["H1B"];

    const msg = await runScriptAndWaitForMessage();
    expect(msg).toBeTruthy();
    expect(msg.keyword_count).toBe(1);
});

test('Site Check: Matches glob pattern *linkedin*', async () => {
    global.location.href = "https://www.linkedin.com/jobs";
    storageData.wordspotting_website_list = ["*linkedin*"];
    storageData.wordspotting_word_list = ["H1B"];

    const msg = await runScriptAndWaitForMessage();
    expect(msg).toBeTruthy();
});

test('Site Check: Does not match mismatched glob', async () => {
    global.location.href = "https://www.google.com";
    storageData.wordspotting_website_list = ["*linkedin*"];
    storageData.wordspotting_word_list = ["H1B"];

    const msg = await runScriptAndWaitForMessage(200); // Shorter timeout for negative
    expect(msg).toBe(null);
});

test('Site Check: Handles regex error gracefully and falls back to glob', async () => {
    global.location.href = "https://www.linkedin.com";
    storageData.wordspotting_website_list = ["*linkedin*"];
    storageData.wordspotting_word_list = ["H1B"];

    const msg = await runScriptAndWaitForMessage();
    expect(msg).toBeTruthy();
});
