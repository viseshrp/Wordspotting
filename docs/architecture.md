# Architecture overview (Wordspotting)

This document explains how Wordspotting is structured, how data flows through it,
and why certain design choices were made. It is intended to be approachable for
junior developers and useful for future maintenance.

## High-level components

1) **Background service worker** (`entrypoints/background.ts`)
- Initializes settings on install and opens the options page on first install.
- Dynamically injects the content script + CSS into allowed sites.
- Receives keyword-count messages from the content script.
- Sets badge state and fires notifications on the rising edge of matches.
- Watches storage changes to refresh allowlist and notify the content script.

2) **Injected content script** (`entrypoints/injected.ts`)
- Runs only on allowlisted sites (injected by background).
- Scans page text for regex keywords and reports counts to background.
- Supports SPA/dynamic content using a MutationObserver and idle scheduling.
- Applies highlight ranges (Chrome 105+) when enabled.

3) **Offscreen scanner host** (`entrypoints/offscreen/`)
- Runs in extension-owned context and owns the scan worker lifecycle.
- Receives scan requests from background and returns results.

4) **Scan worker** (`entrypoints/scan-worker.ts`)
- Runs heavy keyword matching off the main thread.
- Supports chunked scans for large pages and precise range matches for highlights.

5) **Popup UI** (`entrypoints/popup/`)
- Shows keywords found on the current tab.
- Lets users add the current site to the allowlist (with scope options).
- Provides a refresh-on-add toggle and quick access to options.

6) **Options UI** (`entrypoints/options/`)
- Manages keyword list, allowlist, notifications toggle, extension toggle,
  highlight toggle, highlight color, and theme.

7) **Shared utilities** (`entrypoints/shared/`)
- Storage helpers, regex utilities, and scanner primitives.

## Data flow summary

```
Page loads
  -> Background checks tab URL and allowlist
  -> If allowed, background injects CSS + content script
  -> Content script scans text and sends count to background
  -> Background updates badge and (optionally) fires notification

Settings change (options/popup)
  -> Storage updated
  -> Background refreshes allowlist cache and notifies content script
  -> Content script re-scans if needed
```

## Key flows (pseudo-code)

### Injection (background)
```
onTabUpdated(tabId, url):
  if extension disabled: return
  if url not in allowlist: set inactive badge; return
  insert CSS
  execute injected.js if not already present
```

### Scan and notify (content -> background)
```
content script schedules scan on idle or SPA changes
  -> read keyword list + highlight settings
  -> request offscreen scanner run through background
  -> send { wordfound, keyword_count } to background

background receives message
  -> verify allowlist
  -> set badge count
  -> if transition from 0 to >0 and notifications enabled: fire notification
```

### Highlight flow
```
if highlight enabled:
  -> build text node list
  -> worker computes matches per node
  -> create Range objects and apply CSS Highlight
```

### SPA/dynamic content handling
```
MutationObserver triggers -> debounce -> schedule scan on idle
Visibility change -> pause scans when hidden, resume when visible
```

## Why dynamic injection is used
The extension only injects into allowlisted sites. This reduces overhead and
limits the content script’s footprint to user-approved pages. It also supports
regex-based allowlist patterns, including wildcards.

## Performance decisions (and tradeoffs)

- **Idle scheduling:** scanning runs in idle time when possible to reduce UI impact.
- **Chunked worker scans:** large documents are split into chunks with overlap.
- **Debounced SPA scans:** MutationObserver events are debounced to prevent repeated
  scans during rapid DOM updates.
- **Hash-based signature:** avoids repeat scans when the document text hasn’t changed.

## UI behavior reference
- **Popup:** shows currently found keywords and lets users add the current site.
- **Options:** edit allowlist/keywords, toggle extension/notifications/highlighting,
  set highlight color, and choose theme.
- **Badge:** shows count of unique matches on the active tab; inactive sites show "-".

## Storage schema
For the full schema and reasoning, see `docs/storage.md`.

## Where to look when debugging
- **No injection or badge updates:** `entrypoints/background.ts`
- **No keyword results:** `entrypoints/injected.ts`
- **Highlighting issues:** `entrypoints/injected.ts` (Highlight flow)
- **Allowlist validation:** `entrypoints/options/main.ts` + `entrypoints/shared/utils.ts`
- **Regex matching logic:** `entrypoints/shared/core/scanner.ts`

## Troubleshooting matrix
- **Badge stuck at "-":** allowlist doesn’t match or extension is disabled.
- **Badge always 0:** keyword list empty or scan not running; check content script.
- **No notifications:** notifications toggle off or not a rising-edge event.
- **Highlights missing:** highlight toggle off or CSS Highlights API unsupported.
- **SPA pages not updating:** MutationObserver not firing; check DOM changes + debounce.

## Glossary
- **Allowlist:** list of site patterns where Wordspotting runs.
- **Keyword list:** regex patterns used to detect matches.
- **Rising edge:** first transition from zero matches to at least one match.
