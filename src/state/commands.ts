/**
 * Searching the command palette. Matching ignores case and Vietnamese
 * accents ("vua man hinh" finds "Vừa màn hình"); every word typed must match.
 */

export type Searchable = {
  title: string;
  /** Extra words that match too (other names, sizes, English terms in another language). */
  keywords?: string;
};

export function normalizeText(text: string): string {
  return text
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** True when the letters of `token` appear in `text` in order (e.g. "rtal" in "rotate all"). */
function isSubsequence(token: string, text: string): boolean {
  let index = 0;
  for (const char of text) {
    if (char === token[index]) index++;
    if (index === token.length) return true;
  }
  return token.length === 0;
}

function wordStarts(text: string, token: string): boolean {
  return text.split(/[\s·/().,:–-]+/).some((word) => word.startsWith(token));
}

/** How well one typed word matches; 0 = it doesn't. */
function tokenScore(token: string, title: string, keywords: string): number {
  if (title.startsWith(token)) return 100;
  if (wordStarts(title, token)) return 70;
  if (title.includes(token)) return 50;
  if (wordStarts(keywords, token)) return 35;
  if (keywords.includes(token)) return 25;
  if (token.length >= 3 && isSubsequence(token, title)) return 10;
  return 0;
}

/** Score of an item for a query (0 = no match; higher is better). */
export function matchScore(query: string, item: Searchable): number {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 1;
  const title = normalizeText(item.title);
  const keywords = normalizeText(item.keywords ?? '');
  let total = 0;
  for (const token of tokens) {
    const score = tokenScore(token, title, keywords);
    if (score === 0) return 0;
    total += score;
  }
  // Shorter titles that match as well are usually what was meant.
  return total - Math.min(title.length, 60) / 100;
}

/** Items matching `query`, best first (ties keep their order, at most `limit`); every item for an empty query. */
export function searchCommands<T extends Searchable>(items: T[], query: string, limit = 60): T[] {
  if (!query.trim()) return items;
  return items
    .map((item, index) => ({ item, index, score: matchScore(query, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
