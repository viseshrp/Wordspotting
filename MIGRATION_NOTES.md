# Wordspotting WXT Migration Notes

## Manifest Parity

Baseline (pre-WXT, `manifest.json`):
- permissions: `notifications`, `storage`, `scripting`
- host_permissions: `<all_urls>`

Final (WXT build output, `.output/chrome-mv3/manifest.json`):
- permissions: `notifications`, `storage`, `scripting`
- host_permissions: `<all_urls>`

Status: **match** (no permission or host-permission changes).

## Entrypoint Mapping

- Background service worker
  - Before: `src/js/background.js`
  - After: `entrypoints/background.ts`

- Content script (dynamically injected)
  - Before: `src/js/content.js` + `src/js/utils.js` + `src/js/settings.js` + `src/js/core/scanner.js`
  - After: `entrypoints/injected.ts` (bundles deps), injected via `scripting.executeScript`

- Scan worker (inline blob)
  - Before: `src/js/scan-worker.js` + `src/js/core/scanner.js`
  - After: `entrypoints/scan-worker.ts` (unlisted script fetched and inlined by content script)

- Popup UI
  - Before: `src/pages/popup.html` + `src/js/popup.js` + `src/js/utils.js`
  - After: `entrypoints/popup/index.html` + `entrypoints/popup/main.ts`

- Options UI
  - Before: `src/pages/options.html` + `src/js/options.js` + `src/js/settings.js` + `src/js/utils.js`
  - After: `entrypoints/options/index.html` + `entrypoints/options/main.ts`

## CI Gate Mapping

Before:
- Lint: ESLint + Biome
- Web-ext validation: `npm run lint:webext`
- Unit tests: `jest --coverage`
- Smoke: filesystem + Playwright
- Size budget: 1 MB
- Artifact upload: `dist/wordspotting-<version>.zip`

After:
- Lint: **Biome only** (ESLint removed)
- Web-ext validation: `npm run lint:webext` (now runs against WXT build output)
- Unit tests: Jest (TypeScript via `ts-jest`)
- Smoke: filesystem + Playwright (Playwright uses WXT build output)
- Size budget: unchanged
- Artifact upload: unchanged (`dist/wordspotting-<version>.zip`)

## Deviations

None. Behavior and permissions remain unchanged.

Notes:
- Manifest is generated from `wxt.config.ts`.
- Dynamic content injection preserved; content entrypoint is unlisted and injected via `scripting.executeScript`.
