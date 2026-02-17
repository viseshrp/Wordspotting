# Privacy Policy

**Effective Date:** 2026-01-01

**Wordspotting** ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how our Chrome Extension handles your data.

## 1. Data Collection and Usage

**We do not collect, store, or transmit any personal data.**

*   **Local Storage**: All your preferences, including your list of keywords and allowed websites, are stored using the Chrome Storage API (`chrome.storage.sync`). If Chrome Sync is enabled on your account, these settings may sync across your signed-in Chrome devices.
*   **No Analytics**: We do not use any third-party analytics or tracking tools.
*   **No External Servers**: The extension operates entirely client-side. No data is sent to any external servers.

## 2. Permissions

The extension requests the following permissions to function:

*   **Host Permissions (`<all_urls>`)**: Required because users configure allowed sites at runtime. The extension still only scans pages that match domains you explicitly add to your "Allowed Websites" list.
*   **Notifications**: Used to display system notifications when a keyword is found.
*   **Storage**: Used to save your settings locally.
*   **Scripting**: Used to inject the scanner and highlighting styles only on user-allowlisted pages.
*   **Offscreen**: Used to run scanner processing in an extension-owned offscreen document.

## 3. Changes to This Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 4. Contact Us

If you have any questions about this Privacy Policy, please contact us via the Chrome Web Store support page.
