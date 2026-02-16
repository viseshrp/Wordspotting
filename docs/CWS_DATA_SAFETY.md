# Chrome Web Store Data Safety Answers

## Sensitive Data Handling

- Does the extension handle personal or sensitive user data? **Yes**
- Data categories accessed during operation:
  - **Website content**: visible page text (`document.body.innerText`) on user-allowlisted sites
  - **User activity**: current tab URL/title for allowlist checks and local notifications

## Storage and Transmission

- Is collected data sold to third parties? **No**
- Is collected data used for unrelated purposes? **No**
- Is collected data used for creditworthiness/lending? **No**
- Is data transmitted off-device? **No**
- Is data persisted by the extension?
  - **Yes** for user settings only: keyword list, allowlist, and preferences in `chrome.storage.sync`
  - **No** for page text, URL, and title (processed in-memory only)

## User Disclosure Text (for listing)

"Wordspotting reads visible page text on websites you explicitly allow so it can match your configured keywords. It stores your keyword list, allowlist, and settings in Chrome storage sync. No browsing content is sent to external servers."
