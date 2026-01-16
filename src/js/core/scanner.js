// Core scanning helpers (no Chrome-specific logic).

export function normalizeKeywords(keywordList) {
    return Array.isArray(keywordList)
        ? keywordList.filter((k) => k && typeof k === "string" && k.trim().length > 0)
        : [];
}

export function buildCombinedRegex(validKeywords) {
    const patterns = [];
    const patternMap = [];

    validKeywords.forEach((word, index) => {
        try {
            // Validate regex
            new RegExp(word);
            patterns.push(`(?<k${index}>${word})`);
            patternMap[index] = word;
        } catch (_e) {
            // ignore invalid regex entry
        }
    });

    if (patterns.length === 0) return null;

    const combinedPattern = patterns.join("|");
    return { regex: new RegExp(combinedPattern, "ig"), patternMap };
}

export function scanTextForKeywords(keywordList, textToScan) {
    const validKeywords = normalizeKeywords(keywordList);
    if (validKeywords.length === 0) return [];

    const text = typeof textToScan === "string" ? textToScan : "";
    const foundKeywords = new Set();
    const combined = buildCombinedRegex(validKeywords);
    if (!combined) return [];

    const { regex, patternMap } = combined;
    let match = regex.exec(text);

    while (match !== null) {
        if (match.groups) {
            for (const key in match.groups) {
                if (match.groups[key] !== undefined) {
                    const index = parseInt(key.substring(1), 10);
                    if (patternMap[index]) {
                        foundKeywords.add(patternMap[index]);
                    }
                }
            }
        }

        if (foundKeywords.size === validKeywords.length) {
            return Array.from(foundKeywords);
        }

        match = regex.exec(text);
    }

    return Array.from(foundKeywords);
}

export function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}
