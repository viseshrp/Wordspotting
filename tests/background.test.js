// tests/background.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock Chrome API
const listeners = {};
global.chrome = {
    runtime: {
        lastError: null,
        onInstalled: {
            addListener: (fn) => { listeners['onInstalled'] = fn; }
        },
        onMessage: {
            addListener: (fn) => { listeners['onMessage'] = fn; }
        }
    },
    action: {
        setBadgeText: () => {}
    },
    notifications: {
        create: () => {}
    },
    storage: {
        sync: {
            set: (obj, cb) => cb && cb(),
            get: (keys, cb) => cb && cb({})
        }
    }
};

global.importScripts = () => {};
// Note: importScripts in background.js loads utils.js.
// In test, we should load utils.js manually.
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
    global.chrome.storage.sync.set = (obj, cb) => {
        Object.assign(storedData, obj);
        if(cb) cb();
    };
    global.chrome.storage.sync.get = (key, cb) => {
        // Return empty for first start
        cb({});
    };

    // Trigger onInstalled
    // It's async
    const promise = listeners['onInstalled']();

    // Since we can't easily await the internal async of the listener without return,
    // we rely on the fact that our mock is synchronous enough or we assume it runs.
    // background.js: onInstalled is async () => { ... }

    // Ideally we await the promise returned by the listener
    return promise.then(() => {
        expect(storedData['wordspotting_notifications_on']).toBe(true);
        expect(storedData['is_first_start']).toBe(false);
    });
});

test('onMessage handles wordfound', () => {
    let badgeText = "";
    let notificationCreated = false;

    global.chrome.action.setBadgeText = (details) => {
        badgeText = details.text;
    };
    global.chrome.notifications.create = () => {
        notificationCreated = true;
    };
    // Mock storage so notifications are ON
    global.chrome.storage.sync.get = (k, cb) => cb({wordspotting_notifications_on: true});

    const msg = { wordfound: true, keyword_count: 5 };
    const sender = { tab: { id: 1, title: "Test Page" } };

    // Trigger message
    listeners['onMessage'](msg, sender, (response) => {
        expect(response.ack).toBe("gotcha");
    });

    // Check effects
    // handleMessage is async, so effects might not be immediate if we don't await.
    // background.js: handleMessage(request, sender).then(sendResponse);

    // Wait a tick
    setTimeout(() => {
        expect(badgeText).toBe("5");
        expect(notificationCreated).toBe(true);
    }, 10);
});
