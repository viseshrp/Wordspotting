/*
* Utils to abstract API calls and other frequent usages.
* */

/**
 * Storage area - use sync for cross-device persistence.
 */
const storageArea = chrome.storage.sync;

/**
 * Save object to chrome.storage.sync
 * @param {Object} obj
 * @returns {Promise<void>}
 */
function saveToStorage(obj) {
    return new Promise((resolve, reject) => {
        storageArea.set(obj, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get object from chrome.storage.sync
 * @param {string|string[]|Object} keys
 * @returns {Promise<Object>}
 */
function getFromStorage(keys) {
    return new Promise((resolve, reject) => {
        storageArea.get(keys, (items) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(items);
            }
        });
    });
}

function showAlert(message, title, isSuccess) {
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
    } /* istanbul ignore else */ else {
        /* istanbul ignore next */
        logit(`Alert: ${title} - ${message}`);
    }
}

function isValidObj(obj) {
    return obj !== null && typeof obj !== 'undefined' && Object.keys(obj).length > 0;
}

function trimAndClean(string) {
    if (!string) return '';
    return string.trim().replace(/\s+/g, '');
}

function logit(message) {
    var dt = new Date();
    var utcDate = dt.toUTCString();

    console.log(`[${utcDate}]\t${message}`);
}

function getRandomInt(maximum, minimum) {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

/**
 * Build a regex from a user-provided site pattern (regex or wildcard with *).
 * @param {string} pattern
 * @returns {RegExp|null}
 */
function buildSiteRegex(pattern) {
    if (!pattern || typeof pattern !== 'string') return null;
    // Trim spaces to avoid accidental anchors
    const cleaned = pattern.trim();
    if (!cleaned) return null;

    // If the user explicitly included regex markers, respect as-is.
    try {
        return new RegExp(cleaned, 'i');
    } catch (_e) {
        // If invalid regex, treat * as wildcard and escape the rest.
        const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const globbed = escaped.replace(/\\\*/g, '.*');
        try {
            return new RegExp(globbed, 'i');
        } catch (_err) {
            return null;
        }
    }
}

/**
 * Check if a URL matches any of the allowed site patterns.
 * @param {string} url
 * @param {string[]} allowedSites
 * @returns {boolean}
 */
function isUrlAllowed(url, allowedSites) {
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
 * @param {string[]} patterns
 * @returns {RegExp[]}
 */
function compileSitePatterns(patterns) {
    if (!Array.isArray(patterns)) return [];
    return patterns.map((p) => buildSiteRegex(p)).filter(Boolean);
}

/**
 * Test URL against precompiled regex list.
 * @param {string} url
 * @param {RegExp[]} compiled
 * @returns {boolean}
 */
function isUrlAllowedCompiled(url, compiled) {
    if (!url || !Array.isArray(compiled) || compiled.length === 0) return false;
    // Ensure we test against the full href, but also fallback to hostname+path.
    const candidates = [url];
    try {
        const u = new URL(url);
        candidates.push(`${u.hostname}${u.pathname}`);
    } catch (_e) {
        // ignore
    }
    return compiled.some((regex) => candidates.some((c) => regex.test(c)));
}

/**
 * Build allowlist patterns (root, subdomain, path, full) from a URL.
 * @param {string} urlString
 * @returns {{root: string, subdomain: string, path: string, full: string}}
 */
function buildPatternsForTab(urlString) {
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

// --- Chrome match pattern helpers (for optional host permissions) ---

/**
 * Validate a Chrome match pattern like "*://*.example.com/*".
 * This is intentionally strict (only supports patterns that Chrome permissions accept).
 * @param {string} pattern
 * @returns {boolean}
 */
function isValidMatchPattern(pattern) {
    if (!pattern || typeof pattern !== 'string') return false;
    const p = pattern.trim();
    // scheme://host/path
    const m = /^([*]|http|https):\/\/([^/]+)(\/.*)$/.exec(p);
    if (!m) return false;
    const scheme = m[1];
    const host = m[2];
    const path = m[3];
    if (!path.startsWith('/')) return false;

    // Host can be *, *.example.com, or example.com
    if (host === '*') return true;
    if (host.startsWith('*.')) {
        const base = host.substring(2);
        return base.length > 0 && !base.includes('*') && /^[A-Za-z0-9.-]+$/.test(base);
    }
    return !host.includes('*') && /^[A-Za-z0-9.-]+$/.test(host);
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a Chrome match pattern to a RegExp for testing a URL.
 * @param {string} pattern
 * @returns {RegExp|null}
 */
function matchPatternToRegExp(pattern) {
    if (!isValidMatchPattern(pattern)) return null;
    const p = pattern.trim();
    const m = /^([*]|http|https):\/\/([^/]+)(\/.*)$/.exec(p);
    if (!m) return null;
    const scheme = m[1];
    const host = m[2];
    const path = m[3];

    const schemeRe = scheme === '*' ? '(http|https)' : escapeRegex(scheme);

    let hostRe;
    if (host === '*') {
        hostRe = '[^/]*';
    } else if (host.startsWith('*.')) {
        const base = escapeRegex(host.substring(2));
        // Chrome treats *.example.com as matching example.com and subdomains.
        hostRe = `(?:[^/]*\\.)?${base}`;
    } else {
        hostRe = escapeRegex(host);
    }

    const pathRe = escapeRegex(path).replace(/\\\*/g, '.*');
    return new RegExp(`^${schemeRe}:\\/\\/${hostRe}${pathRe}$`, 'i');
}

/**
 * Check URL against a list of Chrome match patterns.
 * @param {string} url
 * @param {string[]} patterns
 * @returns {boolean}
 */
function isUrlAllowedByMatchPatterns(url, patterns) {
    if (!url || !Array.isArray(patterns) || patterns.length === 0) return false;
    return patterns.some((p) => {
        const re = matchPatternToRegExp(p);
        return re ? re.test(url) : false;
    });
}

/**
 * Normalize user input to one or more Chrome match patterns.
 * Accepts:
 * - match patterns ("*://*.example.com/*")
 * - full URLs ("https://example.com/foo")
 * - hostnames/domains ("example.com" or "www.example.com")
 * @param {string} input
 * @returns {string[]} match patterns
 */
function normalizeToMatchPatterns(input) {
    if (!input || typeof input !== 'string') return [];
    const raw = input.trim();
    if (!raw) return [];

    // Already a match pattern
    if (raw.includes('://') && raw.includes('/*') && isValidMatchPattern(raw)) {
        const scheme = raw.split('://')[0];
        if (scheme === '*') {
            const rest = raw.substring(raw.indexOf('://') + 3);
            return [`http://${rest}`, `https://${rest}`];
        }
        if (scheme === 'http' || scheme === 'https') {
            return [raw];
        }
        return [];
    }

    // Full URL
    try {
        const u = new URL(raw);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
            return [`${u.protocol.replace(':', '')}://${u.hostname}/*`];
        }
    } catch (_e) {
        // Not a URL
    }

    // Hostname/domain
    const host = raw.replace(/^\.+/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9.-]+$/.test(host) || !host.includes('.')) {
        return [];
    }

    // If user entered a bare domain (no scheme), default to both http/https via *://
    // If they entered a subdomain, keep it exact; if they entered a root domain, include subdomains.
    const parts = host.split('.').filter(Boolean);
    const isLikelyRoot = parts.length <= 2;
    const hostPattern = isLikelyRoot ? `*.${host}` : host;
    return [`http://${hostPattern}/*`, `https://${hostPattern}/*`];
}

/**
 * Build match patterns for a tab URL, for different scopes.
 * Note: "full" cannot exactly match query/fragment via match patterns.
 * @param {string} urlString
 * @returns {{root: string, subdomain: string, path: string, full: string}}
 */
function buildMatchPatternsForTab(urlString) {
    const url = new URL(urlString);
    const host = url.hostname;
    if (!host) throw new Error('Invalid URL');
    const scheme = url.protocol.replace(':', '');
    const parts = host.split('.').filter(Boolean);
    const rootHost = parts.length <= 2 ? host : parts.slice(-2).join('.');

    const root = `${scheme}://*.${rootHost}/*`;
    const subdomain = `${scheme}://${host}/*`;
    const path = `${scheme}://${host}${url.pathname}*`;
    const full = `${scheme}://${host}${url.pathname}*`;

    return { root, subdomain, path, full };
}

/**
 * Convert a concrete URL to a specific origin pattern for permissions.contains.
 * @param {string} urlString
 * @returns {string|null}
 */
function originPatternForUrl(urlString) {
    try {
        const u = new URL(urlString);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        const scheme = u.protocol.replace(':', '');
        return `${scheme}://${u.hostname}/*`;
    } catch (_e) {
        return null;
    }
}

// Export for tests
/* istanbul ignore next */
if (typeof module !== 'undefined') {
    module.exports = {
        saveToStorage,
        getFromStorage,
        showAlert,
        isValidObj,
        trimAndClean,
        logit,
        getRandomInt,
        buildSiteRegex,
        isUrlAllowed,
        compileSitePatterns,
        isUrlAllowedCompiled,
        buildPatternsForTab,
        isValidMatchPattern,
        matchPatternToRegExp,
        isUrlAllowedByMatchPatterns,
        normalizeToMatchPatterns,
        buildMatchPatternsForTab,
        originPatternForUrl
    };
}
