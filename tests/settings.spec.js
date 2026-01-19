describe('settings defaults', () => {
  beforeAll(() => {
    global.getFromStorage = jest.fn(async () => ({}));
    global.saveToStorage = jest.fn(async () => {});
  });

  const settings = require('../src/js/settings.js');

  test('applySettingsDefaults fills missing keys', () => {
    const partial = { wordspotting_notifications_on: false };
    const result = settings.applySettingsDefaults(partial);
    expect(result.wordspotting_notifications_on).toBe(false);
    expect(result.wordspotting_extension_on).toBe(true); // default
  });

  test('ensureSettingsInitialized writes defaults when missing', async () => {
    global.saveToStorage.mockClear();
    await settings.ensureSettingsInitialized();
    expect(global.saveToStorage).toHaveBeenCalled();
    const payload = global.saveToStorage.mock.calls[0][0];
    expect(payload.wordspotting_settings_version).toBe(1);
  });

  test('ensureSettingsInitialized skips write when present', async () => {
    global.getFromStorage = jest.fn(async () => ({
      wordspotting_notifications_on: true,
      wordspotting_extension_on: true,
      wordspotting_website_list: [],
      wordspotting_word_list: [],
      wordspotting_highlight_on: false,
      wordspotting_highlight_color: '#FFFF00',
      wordspotting_theme: 'system',
      is_first_start: false,
      wordspotting_settings_version: 1
    }));
    global.saveToStorage = jest.fn(async () => {});
    await settings.ensureSettingsInitialized();
    expect(global.saveToStorage).not.toHaveBeenCalled();
  });
});
