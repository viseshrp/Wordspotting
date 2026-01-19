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

## Development

Built with [Plasmo](https://docs.plasmo.com/) and Vanilla JavaScript (MV3).

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Dev Server

```bash
npm run dev
```

### Build

```bash
make package
```
Outputs `dist/wordspotting-<version>.zip`.

### Tests

```bash
make test         # Unit tests (Jest)
npm run smoke:e2e # E2E tests (Playwright)
```

## Permissions

- `notifications`, `storage`, `scripting`, and `host_permissions: <all_urls>`. Adding a site to your allowed list is considered opt-in; there are no runtime permission prompts.

## License

MIT
