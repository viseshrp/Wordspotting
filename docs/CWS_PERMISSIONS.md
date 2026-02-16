# Chrome Web Store Permission Justifications

## Requested permissions

- `storage`
  - Stores user-provided keywords, allowed site patterns, and feature preferences in `chrome.storage.sync`.
- `scripting`
  - Injects scanner and stylesheet only into tabs that match the user's allowlist.
- `notifications`
  - Shows local system notifications when configured keywords are found.

## Host permission

- `host_permissions: ["<all_urls>"]`
  - Required because users define allowed domains at runtime.
  - The extension does not inject or scan all pages by default.
  - Injection and scanning are restricted by the user-maintained allowlist (`wordspotting_website_list`).
  - No page text, URLs, or titles are transmitted to external servers.
