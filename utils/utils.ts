import { browser } from 'wxt/browser';

/**
 * Storage area - use sync for cross-device persistence.
 */
const storageArea = browser.storage.sync;

/**
 * Save object to chrome.storage.sync
 */
export function saveToStorage(obj: Record<string, any>): Promise<void> {
    return storageArea.set(obj);
}

/**
 * Get object from chrome.storage.sync
 */
export function getFromStorage(keys: string | string[] | Record<string, any> | null): Promise<Record<string, any>> {
    // browser.storage.sync.get handles all these types
    return storageArea.get(keys);
}

export function showAlert(message: string, title?: string, isSuccess?: boolean): void {
    if (typeof document !== 'undefined') {
        const toast = document.createElement('div');
        toast.className = `ws-toast ${isSuccess ? 'success' : 'error'}`;
        toast.textContent = (title ? `${title}: ` : "") + message;
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

export function isValidObj(obj: any): boolean {
    return obj !== null && typeof obj !== 'undefined' && Object.keys(obj).length > 0;
}

export function trimAndClean(string: string | null | undefined): string {
    if (!string) return '';
    return string.trim().replace(/\s+/g, '');
}

export function logit(message: string): void {
    var dt = new Date();
    var utcDate = dt.toUTCString();

    console.log(`[${utcDate}]\t${message}`);
}

export function getRandomInt(maximum: number, minimum: number): number {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

export function buildSiteRegex(pattern: string): RegExp | null {
    if (!pattern || typeof pattern !== 'string') return null;
    const cleaned = pattern.trim();
    if (!cleaned) return null;

    try {
        return new RegExp(cleaned, 'i');
    } catch (_e) {
        const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const globbed = escaped.replace(/\\\*/g, '.*');
        try {
            return new RegExp(globbed, 'i');
        } catch (_err) {
            return null;
        }
    }
}

export function isUrlAllowed(url: string, allowedSites: string[]): boolean {
    if (!url || !Array.isArray(allowedSites) || allowedSites.length === 0) {
        return false;
    }

    return allowedSites.some((site) => {
        const regex = buildSiteRegex(site);
        return regex ? regex.test(url) : false;
    });
}

export function compileSitePatterns(patterns: string[]): RegExp[] {
    if (!Array.isArray(patterns)) return [];
    return patterns.map((p) => buildSiteRegex(p)).filter((r): r is RegExp => r !== null);
}

export function isUrlAllowedCompiled(url: string, compiled: RegExp[]): boolean {
    if (!url || !Array.isArray(compiled) || compiled.length === 0) return false;
    const candidates = [url];
    try {
        const u = new URL(url);
        candidates.push(`${u.hostname}${u.pathname}`);
    } catch (_e) {
        // ignore
    }
    return compiled.some((regex) => candidates.some((c) => regex.test(c)));
}

export function buildPatternsForTab(urlString: string): { root: string, subdomain: string, path: string, full: string } {
    const url = new URL(urlString);
    const host = url.hostname;
    if (!host) throw new Error("Invalid URL");
    const full = url.href.split('#')[0];
    const subdomain = `*${host}*`;
    const parts = host.split('.').filter(Boolean);
    const rootHost = parts.length <= 2 ? host : parts.slice(-2).join('.');
    const root = `*${rootHost}*`;
    const path = `*${host}${url.pathname}*`;

    return { root, subdomain, path, full };
}

export function partitionKeywordPatterns(list: string[]) {
    const valid: string[] = [];
    const invalid: string[] = [];

    list.forEach((item) => {
        try {
            new RegExp(item);
            valid.push(item);
        } catch (_e) {
            invalid.push(item);
        }
    });

    return { valid, invalid };
}

export function partitionSitePatterns(list: string[]) {
    const valid: string[] = [];
    const invalid: string[] = [];

    list.forEach((item) => {
        const regex = buildSiteRegex(item);
        if (regex) {
            valid.push(item);
        } else {
            invalid.push(item);
        }
    });

    return { valid, invalid };
}

export function mergeUnique(existing: string[], additions: string[]) {
    return Array.from(new Set([...(existing || []), ...(additions || [])]));
}
