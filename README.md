# Wordspotting

**Wordspotting** is a Chrome Extension that notifies you when specific keywords are found on a webpage. Originally designed to help filter job postings, it can be used for any text-scanning purpose.

## Features

*   **Keyword Scanning**: Automatically scans webpages for your configured keywords.
*   **Site Whitelist**: Only runs on websites you explicitly allow (e.g., `linkedin.com`, `glassdoor.com`).
*   **Notifications**: Get a system notification and a browser badge count when keywords are found.
*   **SPA Support**: Works seamlessly with Single Page Applications and dynamic content.
*   **Regex Support**: Advanced users can use Regular Expressions for powerful matching (e.g., `(H1|h1)b`).
*   **Privacy First**: All data is stored locally on your device. No data is sent to external servers.
*   **Dark Mode**: Native support for dark mode.

## Installation

1.  Download the latest release zip.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right).
4.  Unzip the downloaded file, then click **Load unpacked** and select the extension folder.

## Usage

1.  Click the extension icon and select **Options**.
2.  **Add Websites**: Enter the domains you want to scan (e.g., `linkedin.com`).
3.  **Add Keywords**: Enter the words or phrases you are looking for (e.g., `H1B`, `Remote`).
4.  Navigate to a whitelisted site. If a keyword is found, the extension icon will show a badge count, and you will receive a notification.

## Permissions & Development

- Permissions: `notifications`, `storage`, `scripting`, and `host_permissions: <all_urls>`. Adding a site to your allowed list is considered opt-in; there are no runtime permission prompts.
- Built with vanilla JavaScript, CSS, and HTML (Manifest V3).

### Running Tests

```bash
npm test
```

### Smoke Tests

```bash
npm run smoke        # filesystem checks
npm run smoke:e2e    # headless extension check (requires Playwright)
```

### Building for Release

```bash
./build.sh
```

## License

MIT
