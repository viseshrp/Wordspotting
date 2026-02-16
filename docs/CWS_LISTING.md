# Chrome Web Store Listing Copy

## Single Purpose Description

Wordspotting scans visible page text on websites you explicitly allow and alerts you when your configured keywords are found.

## Permission Explanations

- `<all_urls>` host permission: users choose allowed sites at runtime, so static host patterns are not sufficient.
- `scripting`: required to inject the scanner and highlight styles only on allowlisted pages.
- `offscreen`: required to host scanner execution in an extension-owned offscreen document.
- `notifications`: required to notify users when keyword matches are detected.
- `storage`: required to save keywords, allowlist entries, and preferences in `chrome.storage.sync`.

## Reviewer Clarifications

- The extension processes page text locally and does not send page content to external servers.
- The scanner worker is loaded from the extension package (`scan-worker.js`) and runs in an extension-owned offscreen document.
- The extension does not collect form inputs or keystrokes.
