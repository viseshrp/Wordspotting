importScripts(chrome.runtime.getURL('src/js/core/scanner.js'));

const DEFAULT_CHUNK_SIZE = 150000;
const DEFAULT_OVERLAP = 200;

function scanTextInChunks(keywordList, text, chunkSize, overlap) {
    const validKeywords = normalizeKeywords(keywordList);
    if (validKeywords.length == 0) return [];

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

        if (end == text.length) break;
        index = Math.max(0, end - overlapSize);
    }

    return Array.from(foundKeywords);
}

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type !== 'scan') return;
    const id = data.id;

    try {
        const text = typeof data.text === 'string' ? data.text : '';
        const chunkSize = Number.isFinite(data.chunkSize) ? data.chunkSize : DEFAULT_CHUNK_SIZE;
        const overlap = Number.isFinite(data.overlap) ? data.overlap : DEFAULT_OVERLAP;
        const words = scanTextInChunks(data.keywords, text, chunkSize, overlap);
        self.postMessage({ type: 'scan_result', id, words });
    } catch (e) {
        self.postMessage({ type: 'scan_error', id, error: e.message || 'scan_failed' });
    }
});
