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
        toast.textContent = (title ? title + ": " : "") + message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    } else {
        /* istanbul ignore next */
        logit("Alert: " + title + " - " + message);
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

    console.log("[" + utcDate + "]" + "\t" + message);
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
    try {
        return new RegExp(pattern, 'i');
    } catch (e) {
        try {
            const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const globbed = escaped.replace(/\\\*/g, '.*');
            return new RegExp(globbed, 'i');
        } catch (err) {
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
    return compiled.some((regex) => regex.test(url));
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
        isUrlAllowedCompiled
    };
}
