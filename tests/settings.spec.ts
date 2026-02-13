import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';
import { applySettingsDefaults, ensureSettingsInitialized, getSettings } from '../entrypoints/shared/settings';

type BrowserMock = {
  storage: {
    sync: {
      set: Mock;
      get: Mock;
    };
  };
  runtime: {
    lastError: Error | null;
  };
};

const allSettings = {
  wordspotting_notifications_on: true,
  wordspotting_extension_on: true,
  wordspotting_website_list: [],
  wordspotting_word_list: [],
  wordspotting_highlight_on: false,
  wordspotting_highlight_color: '#FFFF00',
  wordspotting_theme: 'system',
  is_first_start: false,
  wordspotting_settings_version: 1
};

describe('settings defaults', () => {
  beforeEach(() => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.runtime.lastError = null;
    mockBrowser.storage.sync.set = vi.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.());
    mockBrowser.storage.sync.get = vi.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({}));
  });

  test('applySettingsDefaults fills missing keys', () => {
    const partial = { wordspotting_notifications_on: false };
    const result = applySettingsDefaults(partial);
    expect(result.wordspotting_notifications_on).toBe(false);
    expect(result.wordspotting_extension_on).toBe(true); // default
  });

  test('ensureSettingsInitialized writes defaults when missing', async () => {
    await ensureSettingsInitialized();
    expect(browser.storage.sync.set).toHaveBeenCalled();
    const payload = (browser.storage.sync.set as Mock).mock.calls[0][0];
    expect(payload.wordspotting_settings_version).toBe(1);
  });

  test('ensureSettingsInitialized skips write when present', async () => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.get = vi.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.(allSettings));
    mockBrowser.storage.sync.set = vi.fn((_obj: Record<string, unknown>, cb?: () => void) => cb?.());
    await ensureSettingsInitialized();
    expect(mockBrowser.storage.sync.set).not.toHaveBeenCalled();
  });

  test('getSettings returns defaults for missing keys', async () => {
    const mockBrowser = browser as unknown as BrowserMock;
    mockBrowser.storage.sync.get = vi.fn((_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({
      wordspotting_notifications_on: false
    }));
    const settings = await getSettings(['wordspotting_notifications_on']);
    expect(settings.wordspotting_notifications_on).toBe(false);
    expect(settings.wordspotting_extension_on).toBe(true);
  });
});
