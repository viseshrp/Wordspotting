# Wordspotting

[![Codecov](https://codecov.io/gh/viseshrp/Wordspotting/branch/main/graph/badge.svg)](https://codecov.io/gh/viseshrp/Wordspotting)

Wordspotting is a Chrome extension that scans pages for user-defined keywords and alerts you when matches appear. It is designed for configurable monitoring of specific sites, with local-first settings and optional in-page highlighting.

## Core features

- Scan page content for custom keywords (plain text or regex patterns).
- Restrict scanning to an allowlist of sites you control.
- Show match counts on the extension badge.
- Fire notifications when matches appear (rising-edge behavior to reduce noise).
- Highlight matched text on-page (Chrome 105+ CSS Highlights support).
- Support dynamic pages and SPAs via observer-driven re-scan.
- Keep settings in browser sync storage for profile-level persistence.
- Theme support (`system`, `light`, `dark`).

## How it works

### Background service worker (`entrypoints/background.ts`)

- Initializes default settings on install.
- Opens options on first install.
- Watches tab updates and injects scanner code only on allowed URLs.
- Receives scan results, updates badge text/color, and triggers notifications.
- Reacts to storage changes and refreshes allowlist behavior.

### Injected content script (`entrypoints/injected.ts`)

- Runs on allowed tabs only.
- Extracts page text, scans for keyword matches, and reports counts.
- Re-scans for SPA/dynamic DOM updates.
- Applies/removes highlight ranges when highlighting is enabled.

### Scan worker (`entrypoints/scan-worker.ts`)

- Offloads matching work from the main thread.
- Helps keep scanning responsive on larger pages.

### Popup and options UIs

- `entrypoints/popup/`: current-tab status, quick add of the current site, shortcut to options.
- `entrypoints/options/`: manage keyword list, allowlist, toggles, highlight color, and theme.

## Allowlist and matching behavior

- The extension only scans pages that match at least one allowlist pattern.
- Patterns can be regex-like entries or wildcard-style entries (`*` supported).
- Common examples:
  - `*example.com*`
  - `*news.ycombinator.com*`
  - `https://docs.example.com/path`

## Notifications and badge behavior

- Badge shows:
  - `-` for inactive/not-allowed tabs.
  - `0` when allowed but no matches.
  - Positive count when matches are found.
- Notifications trigger only when a tab transitions from no match to match, not repeatedly on every scan.

## Privacy

- No external server dependency for scanning or settings.
- Settings and lists are stored in `browser.storage.sync`.
- Scanning runs in the browser extension context.

## Development setup

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install

```bash
pnpm install
```

### Dev mode

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

## Commands

```bash
pnpm quality      # TypeScript compile + Biome lint
pnpm test         # Vitest with coverage
pnpm smoke        # repository smoke checks
pnpm smoke:e2e    # Playwright-based extension smoke flow
pnpm package      # build zip artifact via WXT
```

## Load unpacked in Chrome

1. Run `pnpm dev` (or `pnpm build`).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select:
   - Dev output: `.output/chrome-mv3-dev/`
   - Build output: `.output/chrome-mv3/`

## CI and release

- CI runs quality checks, smoke checks, unit tests, and uploads coverage to Codecov.
- On `main`, CI also packages and uploads a zip artifact.
- Tagged releases run a release workflow that validates tag/version consistency and uploads the release asset.

## Permissions

- `notifications`: show browser notifications for new match events.
- `storage`: persist settings and lists.
- `scripting`: inject content script/CSS at runtime.
- `host_permissions: <all_urls>`: required for runtime injection across user-allowlisted sites.

## Project structure

- `entrypoints/background.ts`: lifecycle, injection, badge, notifications.
- `entrypoints/injected.ts`: page scanning and highlighting.
- `entrypoints/scan-worker.ts`: worker-based scanning.
- `entrypoints/popup/`: popup UI.
- `entrypoints/options/`: options UI.
- `entrypoints/shared/`: shared settings, storage, scanner utilities.
- `tests/`: unit and e2e tests.
- `docs/`: architecture, storage model, and Chrome Web Store support docs.

## Troubleshooting

- Badge stuck at `-`: verify the extension is enabled and the current site matches your allowlist.
- Badge always `0`: verify keywords are configured and valid.
- No notifications: check `wordspotting_notifications_on` setting.
- Highlights not visible: ensure highlighting is enabled and the page/browser supports CSS Highlights.
- Dynamic pages not updating: refresh once, then confirm site is allowlisted and extension is enabled.

## License

MIT.
