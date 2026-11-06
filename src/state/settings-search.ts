import { normalizeText } from './commands';

/**
 * Searching Settings. Like the command palette, matching ignores case and
 * Vietnamese accents ("giao dien" finds "Giao diện"), and every word typed
 * must appear somewhere in a setting's text.
 */

/** The words of a query, folded like the text they are matched against. */
export function searchWords(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

/** True when every word appears in the text (no words: everything matches). */
export function matchesWords(text: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const folded = normalizeText(text);
  return words.every((word) => folded.includes(word));
}

/**
 * Where the words appear in `text`, as sorted, merged `[start, end)` offsets
 * into the original text (folding can change its length: "ệ" is three
 * characters in NFD, one letter once folded), for highlighting.
 */
export function matchRanges(text: string, words: readonly string[]): [number, number][] {
  if (words.length === 0 || !text) return [];
  let folded = '';
  // The index in `text` each folded character came from.
  const origin: number[] = [];
  for (let index = 0; index < text.length; index++) {
    for (const char of normalizeText(text[index]!)) {
      folded += char;
      origin.push(index);
    }
  }
  const found: [number, number][] = [];
  for (const word of words) {
    for (let at = folded.indexOf(word); at !== -1; at = folded.indexOf(word, at + word.length)) {
      let end = origin[at + word.length - 1]! + 1;
      // Keep the accents of the last letter (combining marks of text written decomposed).
      while (end < text.length && /\p{M}/u.test(text[end]!)) end++;
      found.push([origin[at]!, end]);
    }
  }
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: [number, number][] = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}
