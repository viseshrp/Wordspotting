export function normalizeKeywords(keywordList: any): string[] {
    return Array.isArray(keywordList)
        ? keywordList.filter((k: any) => k && typeof k === 'string' && k.trim().length > 0)
        : [];
}

export function buildCombinedRegex(validKeywords: string[]): { regex: RegExp, patternMap: string[] } | null {
    const patterns: string[] = [];
    const patternMap: string[] = [];

    validKeywords.forEach((word, index) => {
        try {
            new RegExp(word);
            patterns.push(`(?<k${index}>${word})`);
            patternMap[index] = word;
        } catch (_e) {
            // ignore
        }
    });

    if (patterns.length === 0) return null;

    const combinedPattern = patterns.join('|');
    return { regex: new RegExp(combinedPattern, 'ig'), patternMap };
}

export function scanTextForKeywords(keywordList: any, textToScan: string): string[] {
    const validKeywords = normalizeKeywords(keywordList);
    if (validKeywords.length === 0) return [];

    const text = typeof textToScan === 'string' ? textToScan : '';
    const foundKeywords = new Set<string>();
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

export function scanTextForMatches(keywordList: any, textToScan: string): any[] {
    const validKeywords = normalizeKeywords(keywordList);
    if (validKeywords.length === 0) return [];

    const text = typeof textToScan === 'string' ? textToScan : '';
    const matches: any[] = [];
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
                        matches.push({
                            keyword: patternMap[index],
                            index: match.index,
                            length: match[0].length
                        });
                    }
                }
            }
        }
        match = regex.exec(text);
    }

    return matches;
}

export function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
}
