/*
 * Utils to abstract API calls and other frequent usages.
 */

type StorageKeys = string | string[] | Record<string, unknown>;

type MaybePromise<T> = Promise<T> | T | undefined;
type LogLevel = 'warn' | 'error';

export type ExtensionErrorOperation =
  | 'tab_query'
  | 'tab_message'
  | 'tab_reload'
  | 'script_injection'
  | 'badge_update'
  | 'notification'
  | 'runtime_context';

type LogExtensionErrorOptions = {
  level?: LogLevel;
  operation?: ExtensionErrorOperation;
};

const IGNORABLE_EXTENSION_ERROR_PATTERNS: Record<ExtensionErrorOperation, RegExp[]> = {
  tab_query: [
    /no tab with id/i,
    /the tab was closed/i,
    /tabs cannot be queried right now/i,
    /extension context invalidated/i
  ],
  tab_message: [
    /receiving end does not exist/i,
    /listener indicated an asynchronous response/i,
    /message (port|channel) closed before a response was received/i,
    /no tab with id/i,
    /the tab was closed/i,
    /extension context invalidated/i
  ],
  tab_reload: [
    /no tab with id/i,
    /the tab was closed/i,
    /extension context invalidated/i
  ],
  script_injection: [
    /no tab with id/i,
    /the tab was closed/i,
    /cannot access contents of (the page|url)/i,
    /extension context invalidated/i
  ],
  badge_update: [
    /no tab with id/i,
    /the tab was closed/i,
    /extension context invalidated/i
  ],
  notification: [
    /extension context invalidated/i
  ],
  runtime_context: [
    /extension context invalidated/i
  ]
};

function isPromise<T>(value: MaybePromise<T>): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === 'function';
}

function getStorageArea() {
  const area = browser?.storage?.sync;
  if (!area) {
    throw new Error('Storage API unavailable');
  }
  return area;
}

/**
 * Save object to chrome.storage.sync
 */
export function saveToStorage(obj: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const storageArea = getStorageArea();
    const maybe = storageArea.set(obj, () => {
      const err = browser.runtime.lastError;
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });

    if (isPromise(maybe)) {
      maybe.then(() => resolve()).catch((err) => reject(err));
    }
  });
}

/**
 * Get object from chrome.storage.sync
 */
export function getFromStorage<T = Record<string, unknown>>(keys: StorageKeys): Promise<T> {
  return new Promise((resolve, reject) => {
    const storageArea = getStorageArea();
    const maybe = storageArea.get(keys as unknown as string | string[] | Record<string, unknown>, (items: Record<string, unknown>) => {
      const err = browser.runtime.lastError;
      if (err) {
        reject(err);
      } else {
        resolve(items as T);
      }
    });

    if (isPromise(maybe)) {
      maybe.then((items) => resolve(items as T)).catch((err) => reject(err));
    }
  });
}

export function showAlert(message: string, title?: string, isSuccess?: boolean): void {
  if (typeof document !== 'undefined') {
    const toast = document.createElement('div');
    toast.className = `ws-toast ${isSuccess ? 'success' : 'error'}`;
    toast.textContent = (title ? `${title}: ` : '') + message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  } else {
    logit(`Alert: ${title} - ${message}`);
  }
}

export function isValidObj(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj !== 'undefined' && Object.keys(obj as Record<string, unknown>).length > 0;
}

export function trimAndClean(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, '');
}

export function logit(message: string): void {
  if (import.meta.env.PROD) return;
  const dt = new Date();
  const utcDate = dt.toUTCString();

  console.log(`[${utcDate}]\t${message}`);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export function isIgnorableExtensionError(error: unknown, operation: ExtensionErrorOperation): boolean {
  const message = getErrorMessage(error);
  return IGNORABLE_EXTENSION_ERROR_PATTERNS[operation].some((pattern) => pattern.test(message));
}

export function logExtensionError(
  context: string,
  error: unknown,
  options: LogLevel | LogExtensionErrorOptions = 'warn'
): void {
  const resolved = typeof options === 'string'
    ? { level: options as LogLevel }
    : { level: options.level ?? 'warn', operation: options.operation };

  if (resolved.operation && isIgnorableExtensionError(error, resolved.operation)) return;
  if (resolved.level === 'warn' && import.meta.env.PROD) return;

  const logger = resolved.level === 'error' ? console.error : console.warn;
  const devLabel = import.meta.env.DEV && resolved.operation ? `[unexpected:${resolved.operation}] ` : '';
  logger(`${devLabel}${context}:`, error);
}

export function getRandomInt(maximum: number, minimum: number): number {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

/**
 * Build a regex from a user-provided site pattern (regex or wildcard with *).
 */
export function buildSiteRegex(pattern: string | null | undefined): RegExp | null {
  if (!pattern || typeof pattern !== 'string') return null;
  // Trim spaces to avoid accidental anchors
  const cleaned = pattern.trim();
  if (!cleaned) return null;

  // If the user explicitly included regex markers, respect as-is.
  try {
    return new RegExp(cleaned, 'i');
  } catch {
    // If invalid regex, treat * as wildcard and escape the rest.
    const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const globbed = escaped.replace(/\\\*/g, '.*');
    try {
      return new RegExp(globbed, 'i');
    } catch {
      return null;
    }
  }
}

/**
 * Check if a URL matches any of the allowed site patterns.
 */
export function isUrlAllowed(url: string | undefined, allowedSites: string[]): boolean {
  if (!url || !Array.isArray(allowedSites) || allowedSites.length === 0) {
    return false;
  }

  return allowedSites.some((site) => {
    const regex = buildSiteRegex(site);
    return regex ? regex.test(url) : false;
  });
}

/**
 * Precompile a list of site patterns to regexes.
 */
export function compileSitePatterns(patterns: string[]): RegExp[] {
  if (!Array.isArray(patterns)) return [];
  return patterns.map((p) => buildSiteRegex(p)).filter(Boolean) as RegExp[];
}

/**
 * Test URL against precompiled regex list.
 */
export function isUrlAllowedCompiled(url: string | undefined, compiled: RegExp[]): boolean {
  if (!url || !Array.isArray(compiled) || compiled.length === 0) return false;
  // Ensure we test against the full href, but also fallback to hostname+path.
  const candidates = [url];
  try {
    const u = new URL(url);
    candidates.push(`${u.hostname}${u.pathname}`);
  } catch {
    // ignore
  }
  return compiled.some((regex) => candidates.some((c) => regex.test(c)));
}

/**
 * Build allowlist patterns (root, subdomain, path, full) from a URL.
 */
export function buildPatternsForTab(urlString: string): { root: string; subdomain: string; path: string; full: string } {
  const url = new URL(urlString);
  const host = url.hostname;
  if (!host) throw new Error('Invalid URL');
  const full = url.href.split('#')[0];
  const subdomain = `*${host}*`;
  const parts = host.split('.').filter(Boolean);
  const rootHost = parts.length <= 2 ? host : parts.slice(-2).join('.');
  const root = `*${rootHost}*`;
  const path = `*${host}${url.pathname}*`;

  return { root, subdomain, path, full };
}
