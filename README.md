# Wordspotting

**Wordspotting** is a Chrome extension that notifies you when specific keywords are found on a webpage. It's a general-purpose page scanner you configure with your own keywords and allowed sites.

## Features

- **Keyword Scanning**: Automatically scans webpages for your configured keywords.
- **Site Allowlist**: Only runs on websites you explicitly allow (e.g., `example.com`, `news.example`).
- **Notifications**: Get a system notification and a browser badge count when keywords are found.
- **Highlighting**: Visually highlight found keywords on the page (requires Chrome 105+).
- **SPA Support**: Works with single page applications and dynamic content.
- **Regex Support**: Advanced users can use regular expressions for matching (e.g., `error|fail`).
- **Privacy First**: All data is stored locally on your device. No data is sent to external servers.
- **Dark Mode**: Native support for dark mode.

## Installation

1. Download the latest release zip.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (top right).
4. Unzip the downloaded file, then click **Load unpacked** and select the extension folder.

## Usage

1. Click the extension icon and select **Options**.
2. **Add Websites**: Enter the domains you want to scan (e.g., `example.com`, `*.docs.example`).
3. **Add Keywords**: Enter the words or phrases you are looking for (e.g., `error`, `TODO`, `promo`).
4. **Highlighting**: Toggle "Highlight Matches" in the settings to see keywords highlighted on the page. You can also customize the highlight color.
5. Navigate to an allowed site. If a keyword is found, the extension icon will show a badge count, and you will receive a notification.

## Permissions & Development

- Permissions: `notifications`, `storage`, `scripting`, and `host_permissions: <all_urls>`. Adding a site to your allowed list is considered opt-in; there are no runtime permission prompts.
- Built with vanilla JavaScript, CSS, and HTML (Manifest V3). Source lives under `src/` (`src/js`, `src/css`, `src/pages`, `src/assets`).
- CI: GitHub Actions runs lint (ESLint + Biome), unit tests (Jest), smoke checks (filesystem + Playwright), enforces a 1 MB package size, and uploads versioned build artifacts.

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint        # ESLint
npm run biome       # Biome
npm run lint:webext # WebExtension manifest/content validation (web-ext)
```

### Smoke Tests

```bash
npm run smoke        # filesystem checks
npm run smoke:e2e    # extension check (requires Playwright; install via `npx playwright install chromium`)
```

### Building for Release

```bash
npm run build    # outputs dist/wordspotting-<version>.zip
# ./build.sh     # optional wrapper for CI parity
```

### Chrome Web Store Submission Checklist

- `npm ci`
- `npm run biome`
- `npm test -- --runInBand`
- `npm run smoke:e2e` (requires `npx playwright install chromium`)
- `npm run build` to produce `dist/wordspotting-<version>.zip`, then upload that zip to the Chrome Web Store.
- `npm version <x.y.z>` to bump versions and keep `manifest.json` in sync with tags and package metadata.

## License

MIT
