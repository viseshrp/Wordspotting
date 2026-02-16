export {};

declare global {
  interface ImportMetaEnv {
    readonly MODE: string;
    readonly PROD: boolean;
    readonly DEV: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

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

  function defineBackground(main: () => void): void;
  function defineContentScript(config: unknown, main?: () => void): void;
  function defineUnlistedScript(main: () => void): void;
}
