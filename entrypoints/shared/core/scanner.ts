// Core scanning helpers (no Chrome-specific logic).
export type HighlightMatch = { keyword: string; index: number; length: number };

export function normalizeKeywords(keywordList: unknown): string[] {
  return Array.isArray(keywordList)
    ? keywordList.filter((k) => k && typeof k === 'string' && k.trim().length > 0)
    : [];
}

export function buildCombinedRegex(validKeywords: string[]): { regex: RegExp; patternMap: string[] } | null {
  const patterns: string[] = [];
  const patternMap: string[] = [];

  validKeywords.forEach((word, index) => {
    try {
      // Validate regex
      new RegExp(word);
      patterns.push(`(?<k${index}>${word})`);
      patternMap[index] = word;
    } catch {
      // ignore invalid regex entry
    }
  });

  if (patterns.length === 0) return null;

  const combinedPattern = patterns.join('|');
  return { regex: new RegExp(combinedPattern, 'ig'), patternMap };
}

function advanceRegexIfEmptyMatch(regex: RegExp, match: RegExpExecArray, textLength: number): void {
  if (match[0].length === 0) {
    if (regex.lastIndex >= textLength) return;
    regex.lastIndex += 1;
  }
}

export function scanTextForKeywords(keywordList: unknown, textToScan: unknown): string[] {
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

    advanceRegexIfEmptyMatch(regex, match, text.length);
    match = regex.exec(text);
  }

  return Array.from(foundKeywords);
}

export function scanTextForMatches(keywordList: unknown, textToScan: unknown): HighlightMatch[] {
  const validKeywords = normalizeKeywords(keywordList);
  if (validKeywords.length === 0) return [];

  const text = typeof textToScan === 'string' ? textToScan : '';
  const matches: HighlightMatch[] = [];
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
    advanceRegexIfEmptyMatch(regex, match, text.length);
    match = regex.exec(text);
  }

  return matches;
}

export function scanChunksForMatches(keywordList: unknown, chunks: unknown): Record<number, HighlightMatch[]> {
  const results: Record<number, HighlightMatch[]> = {};
  if (!Array.isArray(chunks)) return results;

  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') continue;
    const typed = chunk as { id?: unknown; text?: unknown };
    if (typeof typed.id !== 'number' || !Number.isFinite(typed.id) || typeof typed.text !== 'string') continue;

    const matches = scanTextForMatches(keywordList, typed.text);
    if (matches.length > 0) {
      results[typed.id] = matches;
    }
  }

  return results;
}

export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}
