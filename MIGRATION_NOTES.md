# Migration Inventory

## Current State (Legacy)

### Entrypoints
- **Background:** `src/js/background.js` (Service Worker) - Handled via `background` key in manifest.
- **Content:** `src/js/content.js` (and `src/css/index.css`) - **Programmatically injected** via `chrome.scripting` in background script. Not in `content_scripts` manifest key.
- **Popup:** `src/pages/popup.html` - Defined in `action.default_popup`.
- **Options:** `src/pages/options.html` - Defined in `options_ui`.

### Permissions
- `notifications`
- `storage`
- `scripting`
- `host_permissions`: `["<all_urls>"]`

### Web Accessible Resources
- `src/assets/*.png`
- `src/css/*.css`
- `src/js/scan-worker.js`
- `src/js/core/scanner.js`

### Build & Release
- **Build:** Custom `scripts/build.js` using `archiver`.
- **Output:** `dist/` containing the unpacked extension and a zip file.
- **Zip Limit:** Enforced 1MB limit.

### Tests
- **Unit:** Jest (`npm test`) with JSDOM.
- **E2E:** Playwright (`npm run smoke:e2e`).
- **Lint:** ESLint + Biome.

## Migration Plan

- **Framework:** Plasmo (MV3, Vanilla JS).
- **Injection:** Maintain programmatic injection.
- **CI/CD:** Move to Makefile-based commands.
