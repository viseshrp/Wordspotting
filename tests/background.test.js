// tests/background.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock Chrome API specifics for background tests
const listeners = {};
global.chrome.runtime.onInstalled.addListener = (fn) => { listeners['onInstalled'] = fn; };
global.chrome.runtime.onMessage.addListener = (fn) => { listeners['onMessage'] = fn; };

// Load utils
const utilsPath = path.join(__dirname, '../js/utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
vm.runInThisContext(utilsCode);

// Load background.js
const bgPath = path.join(__dirname, '../js/background.js');
const bgCode = fs.readFileSync(bgPath, 'utf8');
vm.runInThisContext(bgCode);

test('background registers listeners', () => {
    expect(listeners['onInstalled']).toBeTruthy();
    expect(listeners['onMessage']).toBeTruthy();
});

test('onInstalled initializes storage', () => {
    let storedData = {};
    let tabCreated = false;

    // Override mocks locally
    global.chrome.storage.sync.set = (obj, cb) => {
        Object.assign(storedData, obj);
        if(cb) cb();
    };
    global.chrome.storage.sync.get = (key, cb) => { cb({}); };
    global.chrome.tabs.create = (opts) => {
        if (opts.url === "options.html") tabCreated = true;
    };

    const promise = listeners['onInstalled']();

    return promise.then(() => {
        expect(storedData['wordspotting_notifications_on']).toBe(true);
        expect(storedData['is_first_start']).toBe(false);
        expect(tabCreated).toBe(true);
    });
});

test('onMessage handles wordfound', () => {
    let badgeText = "";
    let notificationCreated = false;

    // Override mocks locally
    global.chrome.action.setBadgeText = (details) => {
        badgeText = details.text;
    };
    global.chrome.notifications.create = (id, opt) => {
        notificationCreated = true;
    };
    global.chrome.storage.sync.get = (k, cb) => cb({wordspotting_notifications_on: true});

    const msg = { wordfound: true, keyword_count: 5 };
    const sender = { tab: { id: 1, title: "Test Page" } };

    listeners['onMessage'](msg, sender, (response) => {
        expect(response.ack).toBe("gotcha");
    });

    // Wait for async handling
    return new Promise(resolve => {
        setTimeout(() => {
            expect(badgeText).toBe("5");
            expect(notificationCreated).toBe(true);
            resolve();
        }, 10);
    });
});
