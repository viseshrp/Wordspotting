/* global normalizeKeywords, buildCombinedRegex, scanTextForMatches */

try {
    importScripts(chrome.runtime.getURL('src/js/core/scanner.js'));
} catch (e) {
    // If scanner can't be imported, scans will fail and content script will fall back.
    // Avoid throwing at top-level to keep worker creation predictable.
    void e;
}

const DEFAULT_CHUNK_SIZE = 150000;
const DEFAULT_OVERLAP = 200;

function scanTextInChunks(keywordList, text, chunkSize, overlap) {
    const validKeywords = normalizeKeywords(keywordList);
    if (validKeywords.length === 0) return [];

    const combined = buildCombinedRegex(validKeywords);
    if (!combined) return [];

    const { regex, patternMap } = combined;
    const foundKeywords = new Set();
    const size = Math.max(1, chunkSize);
    const overlapSize = Math.max(0, overlap);

    let index = 0;
    while (index < text.length) {
        const end = Math.min(text.length, index + size);
        const chunk = text.slice(index, end);
        regex.lastIndex = 0;
        let match = regex.exec(chunk);

        while (match !== null) {
            if (match.groups) {
                for (const key in match.groups) {
                    if (match.groups[key] !== undefined) {
                        const mapIndex = parseInt(key.substring(1), 10);
                        if (patternMap[mapIndex]) {
                            foundKeywords.add(patternMap[mapIndex]);
                        }
                    }
                }
            }

            if (foundKeywords.size === validKeywords.length) {
                return Array.from(foundKeywords);
            }

            match = regex.exec(chunk);
        }

        if (end === text.length) break;
        index = Math.max(0, end - overlapSize);
    }

    return Array.from(foundKeywords);
}

function scanChunksForHighlights(keywordList, chunks) {
    const results = {};
    if (!chunks || !Array.isArray(chunks)) return results;

    for (const chunk of chunks) {
        if (chunk && typeof chunk.text === 'string' && typeof chunk.id !== 'undefined') {
            const matches = scanTextForMatches(keywordList, chunk.text);
            if (matches.length > 0) {
                results[chunk.id] = matches;
            }
        }
    }
    return results;
}

self.addEventListener('message', (event) => {
    const data = event.data || {};
    const id = data.id;

    try {
        if (data.type === 'scan') {
            const text = typeof data.text === 'string' ? data.text : '';
            const chunkSize = Number.isFinite(data.chunkSize) ? data.chunkSize : DEFAULT_CHUNK_SIZE;
            const overlap = Number.isFinite(data.overlap) ? data.overlap : DEFAULT_OVERLAP;
            const words = scanTextInChunks(data.keywords, text, chunkSize, overlap);
            self.postMessage({ type: 'scan_result', id, words });
        } else if (data.type === 'scan_for_highlights') {
            const chunks = Array.isArray(data.chunks) ? data.chunks : [];
            const results = scanChunksForHighlights(data.keywords, chunks);
            self.postMessage({ type: 'scan_highlights_result', id, results });
        }
    } catch (e) {
        self.postMessage({ type: 'scan_error', id, error: e.message || 'scan_failed' });
    }
});
