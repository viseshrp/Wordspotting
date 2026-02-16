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
- Built with TypeScript using WXT (Manifest V3). Source lives under `entrypoints/` (including `entrypoints/shared/`) and `public/`.
- CI: GitHub Actions runs TypeScript + Biome checks, unit tests (Vitest + coverage upload), smoke checks (repository + Playwright), enforces a 1 MB package size, and uploads build artifacts.
- Branch behavior: CI runs on pull requests and pushes to `main` / `release/*`; package artifact upload is `main` only.
- Release behavior: publishing a GitHub release tag runs a separate workflow that builds the zip, verifies manifest version matches the tag, checks size budget, and uploads the zip to that release.

### Running Tests

```bash
pnpm test
```

### Quality Gate

```bash
pnpm quality         # TypeScript compile check + Biome lint
```

### Linting

```bash
pnpm lint            # Biome
```

### Smoke Tests

```bash
pnpm smoke        # repository smoke checks
pnpm smoke:e2e    # extension check (requires Playwright; install via `pnpm exec playwright install --with-deps chromium`)
```

### Building for Release

```bash
pnpm package     # outputs .output/wordspotting-<version>-chrome.zip
```

### Chrome Web Store Submission Checklist

- `pnpm install`
- `pnpm quality`
- `pnpm test`
- `pnpm smoke:e2e` (requires `pnpm exec playwright install --with-deps chromium`)
- `pnpm package` to produce `.output/wordspotting-<version>-chrome.zip`, then upload that zip to the Chrome Web Store.
- `pnpm version <x.y.z>` to bump versions and keep `wxt.config.ts` output in sync with tags and package metadata.

## License

MIT
