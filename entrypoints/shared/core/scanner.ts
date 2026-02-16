// Core scanning helpers (no Chrome-specific logic).

const MAX_KEYWORD_REGEX_LENGTH = 120;
const NESTED_QUANTIFIER_PATTERN = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/;
const BACKREFERENCE_PATTERN = /\\[1-9]/;

export function normalizeKeywords(keywordList: unknown): string[] {
  return Array.isArray(keywordList)
    ? keywordList.filter((k) => k && typeof k === 'string' && k.trim().length > 0)
    : [];
}

export function isSafeKeywordPattern(pattern: string): boolean {
  const trimmed = typeof pattern === 'string' ? pattern.trim() : '';
  if (!trimmed) return false;
  if (trimmed.length > MAX_KEYWORD_REGEX_LENGTH) return false;
  if (NESTED_QUANTIFIER_PATTERN.test(trimmed)) return false;
  if (BACKREFERENCE_PATTERN.test(trimmed)) return false;
  try {
    new RegExp(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function buildCombinedRegex(validKeywords: string[]): { regex: RegExp; patternMap: string[] } | null {
  const patterns: string[] = [];
  const patternMap: string[] = [];

  validKeywords.forEach((word, index) => {
    if (!isSafeKeywordPattern(word)) return;
    patterns.push(`(?<k${index}>${word})`);
    patternMap[index] = word;
  });

  if (patterns.length === 0) return null;

  const combinedPattern = patterns.join('|');
  return { regex: new RegExp(combinedPattern, 'ig'), patternMap };
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

    match = regex.exec(text);
  }

  return Array.from(foundKeywords);
}

export function scanTextForMatches(keywordList: unknown, textToScan: unknown): Array<{ keyword: string; index: number; length: number }> {
  const validKeywords = normalizeKeywords(keywordList);
  if (validKeywords.length === 0) return [];

  const text = typeof textToScan === 'string' ? textToScan : '';
  const matches: Array<{ keyword: string; index: number; length: number }> = [];
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
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}
