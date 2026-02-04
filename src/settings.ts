/*
 * Settings defaults and helpers.
 * Central place to manage schema and versioning.
 */

import { getFromStorage, saveToStorage } from './utils';

export const SETTINGS_VERSION_KEY = 'wordspotting_settings_version';
export const SETTINGS_VERSION = 1;

export type WordspottingSettings = {
  wordspotting_notifications_on: boolean;
  wordspotting_extension_on: boolean;
  wordspotting_highlight_on: boolean;
  wordspotting_highlight_color: string;
  wordspotting_website_list: string[];
  wordspotting_word_list: string[];
  wordspotting_theme: 'system' | 'light' | 'dark';
  is_first_start: boolean;
};

export const DEFAULT_SETTINGS: WordspottingSettings = {
  wordspotting_notifications_on: true,
  wordspotting_extension_on: true,
  wordspotting_highlight_on: false,
  wordspotting_highlight_color: '#FFFF00',
  wordspotting_website_list: [],
  wordspotting_word_list: [],
  wordspotting_theme: 'system',
  is_first_start: false
};

/**
 * Apply defaults to a partial settings object without overwriting defined values.
 */
export function applySettingsDefaults(partial: Partial<WordspottingSettings> | null | undefined): WordspottingSettings {
  const merged: WordspottingSettings = { ...DEFAULT_SETTINGS };
  if (partial && typeof partial === 'object') {
    Object.entries(partial).forEach(([key, value]) => {
      if (typeof value !== 'undefined') {
        (merged as Record<string, unknown>)[key] = value;
      }
    });
  }
  return merged;
}

/**
 * Get settings with defaults applied.
 */
export async function getSettings(keys?: Array<keyof WordspottingSettings>): Promise<WordspottingSettings> {
  const lookupKeys = keys && keys.length > 0 ? (keys as string[]) : Object.keys(DEFAULT_SETTINGS);
  const items = await getFromStorage<Record<string, unknown>>(lookupKeys);
  return applySettingsDefaults(items as Partial<WordspottingSettings>);
}

/**
 * Ensure defaults and version are present; does not overwrite existing values.
 */
export async function ensureSettingsInitialized(): Promise<void> {
  const keys = [...Object.keys(DEFAULT_SETTINGS), SETTINGS_VERSION_KEY];
  const current = await getFromStorage<Record<string, unknown>>(keys);

  const toWrite: Record<string, unknown> = {};
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    if (typeof current[key] === 'undefined') {
      toWrite[key] = DEFAULT_SETTINGS[key as keyof WordspottingSettings];
    }
  });

  if (typeof current[SETTINGS_VERSION_KEY] === 'undefined') {
    toWrite[SETTINGS_VERSION_KEY] = SETTINGS_VERSION;
  }

  if (Object.keys(toWrite).length > 0) {
    await saveToStorage(toWrite);
  }
}
