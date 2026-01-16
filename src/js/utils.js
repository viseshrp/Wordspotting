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
export function saveToStorage(obj) {
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
export function getFromStorage(keys) {
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

export function showAlert(message, title, isSuccess) {
    if (typeof document !== "undefined") {
        const toast = document.createElement("div");
        toast.className = `ws-toast ${isSuccess ? "success" : "error"}`;
        toast.textContent = (title ? `${title}: ` : "") + message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.5s";
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    } /* istanbul ignore else */ else {
        /* istanbul ignore next */
        logit(`Alert: ${title} - ${message}`);
    }
}

export function isValidObj(obj) {
    return obj !== null && typeof obj !== "undefined" && Object.keys(obj).length > 0;
}

export function trimAndClean(string) {
    if (!string) return "";
    return string.trim().replace(/\s+/g, "");
}

export function logit(message) {
    var dt = new Date();
    var utcDate = dt.toUTCString();

    console.log(`[${utcDate}]\t${message}`);
}

export function getRandomInt(maximum, minimum) {
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

/**
 * Build a regex from a user-provided site pattern (regex or wildcard with *).
 * @param {string} pattern
 * @returns {RegExp|null}
 */
export function buildSiteRegex(pattern) {
    if (!pattern || typeof pattern !== "string") return null;
    const cleaned = pattern.trim();
    if (!cleaned) return null;

    try {
        // First, check if the pattern is already a valid regex.
        new RegExp(cleaned);
        return new RegExp(cleaned, "i");
    } catch (_e) {
        // If it's not a valid regex, treat it as a wildcard pattern.
        // Escape all special regex characters except for '*'.
        const escaped = cleaned.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
        // Then, convert the '*' into '.*'.
        const globbed = escaped.replace(/\*/g, ".*");
        try {
            return new RegExp(globbed, "i");
        } catch (_err) {
            // This should not happen if the logic is correct.
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
export function isUrlAllowed(url, allowedSites) {
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
export function compileSitePatterns(patterns) {
    if (!Array.isArray(patterns)) return [];
    return patterns.map((p) => buildSiteRegex(p)).filter(Boolean);
}

/**
 * Test URL against precompiled regex list.
 * @param {string} url
 * @param {RegExp[]} compiled
 * @returns {boolean}
 */
export function isUrlAllowedCompiled(url, compiled) {
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

export function applyTheme(value) {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (value === "light") {
        root.setAttribute("data-theme", "light");
    } else if (value === "dark") {
        root.setAttribute("data-theme", "dark");
    } else {
        root.removeAttribute("data-theme");
    }
}

export function mergeUnique(existing, additions) {
    return Array.from(new Set([...(existing || []), ...(additions || [])]));
}
