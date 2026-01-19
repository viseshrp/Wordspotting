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
        buildPatternsForTab
    };
}
