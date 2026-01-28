import { saveToStorage, getFromStorage } from './utils';

export const SETTINGS_VERSION_KEY = 'wordspotting_settings_version';
export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: Record<string, any> = {
    wordspotting_notifications_on: true,
    wordspotting_extension_on: true,
    wordspotting_highlight_on: false,
    wordspotting_highlight_color: '#FFFF00',
    wordspotting_website_list: [],
    wordspotting_word_list: [],
    wordspotting_theme: 'system', // system | light | dark
    is_first_start: false
};

export function applySettingsDefaults(partial: any): Record<string, any> {
    const merged = { ...DEFAULT_SETTINGS };
    if (partial && typeof partial === 'object') {
        Object.keys(partial).forEach((key) => {
            if (typeof partial[key] !== 'undefined') {
                merged[key] = partial[key];
            }
        });
    }
    return merged;
}

export async function getSettings(keys?: string[]): Promise<Record<string, any>> {
    const lookupKeys = keys && keys.length > 0 ? keys : Object.keys(DEFAULT_SETTINGS);
    const items = await getFromStorage(lookupKeys);
    return applySettingsDefaults(items);
}

export async function ensureSettingsInitialized(): Promise<void> {
    const keys = [...Object.keys(DEFAULT_SETTINGS), SETTINGS_VERSION_KEY];
    const current = await getFromStorage(keys);

    const toWrite: Record<string, any> = {};
    Object.keys(DEFAULT_SETTINGS).forEach((key) => {
        if (typeof current[key] === 'undefined') {
            toWrite[key] = DEFAULT_SETTINGS[key];
        }
    });

    if (typeof current[SETTINGS_VERSION_KEY] === 'undefined') {
        toWrite[SETTINGS_VERSION_KEY] = SETTINGS_VERSION;
    }

    if (Object.keys(toWrite).length > 0) {
        await saveToStorage(toWrite);
    }
}
