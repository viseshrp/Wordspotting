# Storage design (Wordspotting)

This document explains how Wordspotting stores data, why the layout looks the way it does,
and how to safely read/write it. It is written for a junior developer who wants to
understand the decisions and avoid common pitfalls.

## Goals and constraints
- **Simple and predictable:** a small set of keys with defaults.
- **Browser-managed persistence:** storage is handled via `browser.storage.sync`, which can
  sync across signed-in browser profiles.
- **Minimal schema drift:** defaults are applied without overwriting existing values.

## Storage area
All data lives in `browser.storage.sync` (see `entrypoints/shared/utils.ts`).

## Storage keys

### 1) Settings version
```
wordspotting_settings_version: number
```
Used to gate future migrations. Currently set to `1`.

### 2) Extension toggles and preferences
```
wordspotting_extension_on: boolean
wordspotting_notifications_on: boolean
wordspotting_highlight_on: boolean
wordspotting_highlight_color: string
wordspotting_theme: "system" | "light" | "dark"
wordspotting_refresh_on_add: boolean
```
- `wordspotting_extension_on` controls whether the extension runs at all.
- `wordspotting_notifications_on` gates notification delivery.
- `wordspotting_highlight_on` toggles CSS Highlights on matching pages.
- `wordspotting_highlight_color` sets the highlight background color.
- `wordspotting_theme` controls popup/options theme.
- `wordspotting_refresh_on_add` is set from the popup toggle and determines whether
  to refresh the current tab after adding a site. This key is optional and defaults
  to `true` in popup behavior when missing.

### 3) User lists
```
wordspotting_website_list: string[]
wordspotting_word_list: string[]
```
- `wordspotting_website_list` is the allowlist of site patterns (regex or wildcard with `*`).
- `wordspotting_word_list` is the keyword list (regex strings).

## Example storage snapshot
```
wordspotting_settings_version: 1
wordspotting_extension_on: true
wordspotting_notifications_on: true
wordspotting_highlight_on: false
wordspotting_highlight_color: "#FFFF00"
wordspotting_theme: "system"
wordspotting_refresh_on_add: true
wordspotting_website_list: ["*example.com*", "*news.ycombinator.com*"]
wordspotting_word_list: ["openai", "\\bLLM\\b"]
```

## Defaults and initialization
Defaults for core settings are defined in `entrypoints/shared/settings.ts` and applied by
`ensureSettingsInitialized()` without overwriting user-set values.

## Read flow
1. Call `getFromStorage` with the relevant keys.
2. Apply defaults (via `getSettings()` or `applySettingsDefaults`).
3. Validate list values before use.

## Write flow
- Use `saveToStorage({ key: value })` to update a single setting or list.
- UI code performs validation before writing (e.g., regex validation in options).

## Validation / normalization
- Website patterns are compiled to regex with `buildSiteRegex` and invalid patterns
  are rejected by the UI.
- Keyword entries are validated as regex strings before being added.

## Important gotchas
- **Regex validation:** invalid regex patterns are rejected and not stored.
- **Allowlist matching:** matching uses either full URL or hostname+path fallback.
- **Sync storage limits:** large lists may hit sync quotas; keep lists reasonable.

## Adding fields later
If you add new fields:
1. Update `WordspottingSettings` and `DEFAULT_SETTINGS` in `entrypoints/shared/settings.ts`.
2. Update any UI that should display or toggle the new field.
3. Add storage migration logic if a breaking change is required.

## Useful file references
- `entrypoints/shared/settings.ts` - defaults and settings helpers.
- `entrypoints/shared/utils.ts` - storage helpers and allowlist regex logic.
- `entrypoints/options/main.ts` - settings UI and validation.
- `entrypoints/popup/main.ts` - allowlist quick-add and refresh toggle.
