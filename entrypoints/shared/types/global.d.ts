export {};

declare global {
  var __WORDSPOTTING_CONTENT_LOADED__: boolean | undefined;
  const browser: typeof chrome;

  interface Highlight {}

  var Highlight: {
    new (...ranges: Range[]): Highlight;
  };

  interface HighlightRegistry {
    set(name: string, highlight: Highlight): void;
    delete(name: string): void;
  }

  interface CSS {
    highlights: HighlightRegistry;
  }

  var handleMessage: ((request: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>) | undefined;
  var setCountBadge: ((tabId: number, count: number) => void) | undefined;
  var refreshAllowedSitePatterns: (() => Promise<void>) | undefined;
  var compiledAllowedSites: RegExp[] | undefined;
  var saveToStorage: ((obj: Record<string, unknown>) => Promise<void>) | undefined;

  function defineBackground(main: () => void): void;
  function defineContentScript(config: unknown, main?: () => void): void;
  function defineUnlistedScript(main: () => void): void;
}
