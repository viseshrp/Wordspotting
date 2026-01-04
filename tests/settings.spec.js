const settings = require('../js/settings.js');

describe('settings defaults', () => {
  test('applySettingsDefaults fills missing keys', () => {
    const partial = { wordspotting_notifications_on: false };
    const result = settings.applySettingsDefaults(partial);
    expect(result.wordspotting_notifications_on).toBe(false);
    expect(result.wordspotting_extension_on).toBe(true); // default
  });
});
