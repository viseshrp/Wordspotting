/*
 * Central tunable constants for the extension.
 * Keep only values that are likely to be tweaked over time.
 */

if (!globalThis.WORDSPOTTING_CONSTANTS) {
    /**
     * The maximum duration (in milliseconds) to keep toast notifications
     * visible before they start fading out.
     */
    const TOAST_VISIBLE_MS = 3000;

    /**
     * The duration (in milliseconds) of the fade-out animation applied
     * to toast notifications.
     */
    const TOAST_FADE_MS = 500;

    /**
     * The CSS duration string for the toast fade-out transition to keep
     * style timing in sync with the JS timeout that removes the element.
     */
    const TOAST_FADE_CSS = '0.5s';

    /**
     * Delay (in milliseconds) to keep a red border on invalid inputs
     * before restoring the normal border color.
     */
    const INPUT_SHAKE_RESET_MS = 500;

    /**
     * Maximum time (in milliseconds) to wait for requestIdleCallback
     * before forcing a scan.
     */
    const REQUEST_IDLE_TIMEOUT_MS = 2000;

    /**
     * Fallback delay (in milliseconds) used when requestIdleCallback
     * is unavailable in the content script environment.
     */
    const SCAN_FALLBACK_DELAY_MS = 300;

    /**
     * Debounce window (in milliseconds) for mutation-driven scans to
     * avoid scanning too frequently on chatty pages.
     */
    const MUTATION_SCAN_DEBOUNCE_MS = 500;

    /**
     * Cache window (in milliseconds) for reusing the last body text
     * snapshot to avoid excessive DOM reads.
     */
    const BODY_TEXT_CACHE_WINDOW_MS = 500;

    /**
     * Default chunk size (in characters) sent to the worker for scanning
     * a page in manageable segments.
     */
    const SCAN_CHUNK_SIZE_DEFAULT = 150000;

    /**
     * Default chunk overlap (in characters) to avoid missing keywords
     * that span chunk boundaries.
     */
    const SCAN_CHUNK_OVERLAP_DEFAULT = 200;

    /**
     * Threshold (in characters) after which chunk sizes are increased to
     * reduce total worker iterations on large pages.
     */
    const SCAN_CHUNK_THRESHOLD_MEDIUM = 120000;

    /**
     * Threshold (in characters) after which chunk sizes are increased again
     * for very large pages.
     */
    const SCAN_CHUNK_THRESHOLD_LARGE = 300000;

    /**
     * Threshold (in characters) after which the largest chunk size is used
     * for extremely large pages.
     */
    const SCAN_CHUNK_THRESHOLD_XL = 800000;

    /**
     * Chunk size (in characters) used when the page is above the medium
     * threshold but below the large threshold.
     */
    const SCAN_CHUNK_SIZE_MEDIUM = 160000;

    /**
     * Chunk size (in characters) used when the page is above the large
     * threshold but below the extra-large threshold.
     */
    const SCAN_CHUNK_SIZE_LARGE = 200000;

    /**
     * Chunk size (in characters) used for extra-large pages to minimize
     * the number of worker passes.
     */
    const SCAN_CHUNK_SIZE_XL = 300000;

    /**
     * Chunk overlap (in characters) paired with the medium chunk size to
     * keep boundary matches reliable.
     */
    const SCAN_CHUNK_OVERLAP_MEDIUM = 240;

    /**
     * Chunk overlap (in characters) paired with the large chunk size to
     * keep boundary matches reliable.
     */
    const SCAN_CHUNK_OVERLAP_LARGE = 300;

    /**
     * Chunk overlap (in characters) paired with the extra-large chunk size
     * to keep boundary matches reliable.
     */
    const SCAN_CHUNK_OVERLAP_XL = 400;

    /**
     * Upper bound for chunk overlap (in characters) to prevent excessive
     * re-scanning on very large keyword patterns.
     */
    const SCAN_CHUNK_OVERLAP_MAX = 800;

    globalThis.WORDSPOTTING_CONSTANTS = {
        TOAST_VISIBLE_MS,
        TOAST_FADE_MS,
        TOAST_FADE_CSS,
        INPUT_SHAKE_RESET_MS,
        REQUEST_IDLE_TIMEOUT_MS,
        SCAN_FALLBACK_DELAY_MS,
        MUTATION_SCAN_DEBOUNCE_MS,
        BODY_TEXT_CACHE_WINDOW_MS,
        SCAN_CHUNK_SIZE_DEFAULT,
        SCAN_CHUNK_OVERLAP_DEFAULT,
        SCAN_CHUNK_THRESHOLD_MEDIUM,
        SCAN_CHUNK_THRESHOLD_LARGE,
        SCAN_CHUNK_THRESHOLD_XL,
        SCAN_CHUNK_SIZE_MEDIUM,
        SCAN_CHUNK_SIZE_LARGE,
        SCAN_CHUNK_SIZE_XL,
        SCAN_CHUNK_OVERLAP_MEDIUM,
        SCAN_CHUNK_OVERLAP_LARGE,
        SCAN_CHUNK_OVERLAP_XL,
        SCAN_CHUNK_OVERLAP_MAX
    };
}

/* istanbul ignore next */
if (typeof module !== 'undefined') {
    module.exports = globalThis.WORDSPOTTING_CONSTANTS;
}
