import * as utils from '../src/js/utils.js';

describe('content helpers', () => {
    let content;

    beforeEach(async () => {
        global.document = { body: { innerText: '' } };
        global.getFromStorage = jest.fn(async () => ({}));
        global.saveToStorage = jest.fn(async () => ({}));
        global.logit = jest.fn();
        console.warn = jest.fn();
        global.isValidObj = utils.isValidObj;
        global.compileSitePatterns = utils.compileSitePatterns;
        global.isUrlAllowedCompiled = utils.isUrlAllowedCompiled;

        // Mock CSS highlights
        global.CSS = { highlights: { set: jest.fn(), delete: jest.fn() } };
        global.Highlight = jest.fn();
        global.Range = jest.fn(() => ({ setStart: jest.fn(), setEnd: jest.fn() }));
        global.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

        // Mock Worker
        global.Worker = jest.fn(() => ({
            addEventListener: jest.fn(),
            postMessage: jest.fn(),
            terminate: jest.fn(),
        }));

        jest.useFakeTimers();
        global.chrome.runtime.id = 'test-runtime';

        // Use dynamic import to support resetting modules if we fully switch to ESM
        // But content.js is still "legacy" structure in this step.
        // Once we refactor content.js to ESM (Step 5), we should use await import().
        // For now, let's use jest.isolateModules or require.
        // Since I'm writing ESM test file now, I should prepare for the future.
        // If I use require, it works for now.
        jest.resetModules();
        content = require('../src/js/content.js');
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.resetModules();
    });

    test('getWordList finds keywords case-insensitively', () => {
        document.body.innerText = 'This has alpha and beta.';
        const result = content.getWordList(['ALPHA', 'beta']);
        expect(result.sort()).toEqual(['ALPHA', 'beta']);
    });

    test('getWordList skips invalid regex', () => {
        document.body.innerText = 'foo';
        const result = content.getWordList(['[bad']);
        expect(result).toEqual([]);
    });

    test('getWordList uses provided bodyText', () => {
        const result = content.getWordList(['foo'], 'foo bar');
        expect(result).toEqual(['foo']);
    });

    test('debounce only calls once', () => {
        let count = 0;
        const fn = content.debounce(() => {
            count += 1;
        }, 10);
        fn();
        fn();
        fn();
        jest.advanceTimersByTime(20);
        expect(count).toBe(1);
    });

    test('hashString is stable', () => {
        expect(content.hashString('abc')).toBe(content.hashString('abc'));
    });

    test('getBodyTextSnapshot caches within window', async () => {
        document.body.innerText = 'first';
        const signal = { aborted: false };
        const first = await content.getBodyTextSnapshot(signal);
        document.body.innerText = 'second';
        const second = await content.getBodyTextSnapshot(signal);
        expect(first).toBe(second);
    });

    test('getBodyTextSnapshot aborts when signal aborted', async () => {
        const signal = { aborted: true };
        const text = await content.getBodyTextSnapshot(signal);
        expect(text).toBe('');
    });

    test('performScan sends message when keywords match', async () => {
        document.body.innerText = 'sample keyword';
        global.getFromStorage = jest.fn(async (keys) => {
            if (Array.isArray(keys)) {
                return {
                    wordspotting_word_list: ['keyword'],
                    wordspotting_highlight_on: false,
                };
            }
            if (keys === 'wordspotting_word_list') {
                return { wordspotting_word_list: ['keyword'] };
            }
            return {};
        });
        global.chrome.runtime.sendMessage = jest.fn((_msg, cb) => cb?.({ ack: 'ok' }));
        await content.performScan({ aborted: false });
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    test('performScan applies highlights when enabled', async () => {
        document.body.innerText = 'sample keyword';

        // Mock getFromStorage
        global.getFromStorage = jest.fn(async () => ({
            wordspotting_word_list: ['keyword'],
            wordspotting_highlight_on: true,
            wordspotting_highlight_color: '#FFFF00',
        }));

        // Re-require to pick up new Worker mock
        jest.resetModules();
        content = require('../src/js/content.js');

        const results = { '0': [{ keyword: 'keyword', index: 0, length: 7 }] };
        const textNode = document.createTextNode('keyword');
        const textNodes = [textNode];

        content.applyHighlights(results, textNodes, '#FFFF00');
        expect(global.CSS.highlights.set).toHaveBeenCalled();
    });

    test('scheduleScan runs without error', () => {
        global.requestIdleCallback = (cb) => cb();
        expect(() => content.scheduleScan()).not.toThrow();
    });
});
