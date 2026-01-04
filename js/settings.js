/*
 * Settings defaults and helpers.
 * Central place to manage schema and versioning.
 */

const SETTINGS_VERSION_KEY = 'wordspotting_settings_version';
const SETTINGS_VERSION = 1;

const DEFAULT_SETTINGS = {
    wordspotting_notifications_on: true,
    wordspotting_extension_on: true,
    wordspotting_website_list: [],
    wordspotting_word_list: [],
    wordspotting_theme: 'system', // system | light | dark
    is_first_start: false
};

/**
 * Apply defaults to a partial settings object without overwriting defined values.
 * @param {Object} partial
 * @returns {Object}
 */
function applySettingsDefaults(partial) {
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

/**
 * Get settings with defaults applied.
 * @param {string[]} [keys]
 * @returns {Promise<Object>}
 */
async function getSettings(keys) {
    const lookupKeys = keys && keys.length > 0 ? keys : Object.keys(DEFAULT_SETTINGS);
    const items = await getFromStorage(lookupKeys);
    return applySettingsDefaults(items);
}

/**
 * Ensure defaults and version are present; does not overwrite existing values.
 * @returns {Promise<void>}
 */
async function ensureSettingsInitialized() {
    const keys = [...Object.keys(DEFAULT_SETTINGS), SETTINGS_VERSION_KEY];
    const current = await getFromStorage(keys);

    const toWrite = {};
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

/* istanbul ignore next */
if (typeof module !== 'undefined') {
    module.exports = {
        SETTINGS_VERSION_KEY,
        SETTINGS_VERSION,
        DEFAULT_SETTINGS,
        applySettingsDefaults,
        getSettings,
        ensureSettingsInitialized
    };
}
