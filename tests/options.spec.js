import * as utils from '../src/js/utils.js';

// Since options.js is not yet ESM in this step (it is Step 6),
// and it exports via module.exports, we can import it.
// However, options.js relies on globals which we must mock first.
// Dynamic import or require is safer here to ensure mocks are applied before module load.

describe('options helpers', () => {
    let options;

    beforeAll(() => {
        // options.js might execute some code on load, so we mock browser env
        global.document = {
            addEventListener: jest.fn(),
            getElementById: jest.fn(() => ({ addEventListener: jest.fn() })),
            body: { addEventListener: jest.fn() }
        };
        // Mock getFromStorage/saveToStorage as they might be used
        global.getFromStorage = jest.fn(async () => ({}));
        global.saveToStorage = jest.fn(async () => {});
        global.buildSiteRegex = utils.buildSiteRegex;

        options = require('../src/js/options.js');
    });

    test('partitionSitePatterns filters invalid', () => {
        const { valid, invalid } = options.partitionSitePatterns(['*good*', ''], utils.buildSiteRegex);
        expect(valid).toContain('*good*');
        expect(invalid).toContain('');
    });

    test('mergeUnique deduplicates', () => {
        const merged = options.mergeUnique(['a', 'b'], ['b', 'c']);
        expect(merged.sort()).toEqual(['a', 'b', 'c']);
    });
});
