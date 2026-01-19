import * as settings from '../src/js/settings.js';
import { getFromStorage, saveToStorage } from '../src/js/utils.js';

jest.mock('../src/js/utils.js', () => ({
    getFromStorage: jest.fn(),
    saveToStorage: jest.fn()
}));

describe('settings defaults', () => {
    beforeEach(() => {
        getFromStorage.mockReset();
        saveToStorage.mockReset();
        getFromStorage.mockResolvedValue({});
        saveToStorage.mockResolvedValue();
    });

    test('applySettingsDefaults fills missing keys', () => {
        const partial = { wordspotting_notifications_on: false };
        const result = settings.applySettingsDefaults(partial);
        expect(result.wordspotting_notifications_on).toBe(false);
        expect(result.wordspotting_extension_on).toBe(true); // default
    });

    test('ensureSettingsInitialized writes defaults when missing', async () => {
        getFromStorage.mockResolvedValue({}); // Empty storage
        await settings.ensureSettingsInitialized();
        expect(saveToStorage).toHaveBeenCalled();
        const payload = saveToStorage.mock.calls[0][0];
        expect(payload.wordspotting_settings_version).toBe(1);
    });

    test('ensureSettingsInitialized skips write when present', async () => {
        getFromStorage.mockResolvedValue({
            wordspotting_notifications_on: true,
            wordspotting_extension_on: true,
            wordspotting_website_list: [],
            wordspotting_word_list: [],
            wordspotting_highlight_on: false,
            wordspotting_highlight_color: '#FFFF00',
            wordspotting_theme: 'system',
            is_first_start: false,
            wordspotting_settings_version: 1,
        });

        await settings.ensureSettingsInitialized();
        expect(saveToStorage).not.toHaveBeenCalled();
    });
});
