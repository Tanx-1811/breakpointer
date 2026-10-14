import { parsePreviewUrl, toSafeHref, type UrlParseError } from '../utils/url';

/**
 * Comparing two addresses with the same viewports: every visible viewport also
 * shows a "B" preview next to the usual one.
 * - `mirror`: B shows the same page (path, query, fragment) on another site,
 *   e.g. staging next to production; it follows when A moves to another page.
 * - `fixed`: B always shows one address.
 */
export type CompareTarget = { mode: 'mirror'; origin: string } | { mode: 'fixed'; url: string };

export type CompareMode = CompareTarget['mode'];

/** Card ids of B previews: the viewport id plus a suffix that viewport ids can't contain. */
const SUFFIX = '~b';

export const compareCardId = (viewportId: string) => `${viewportId}${SUFFIX}`;
export const isCompareCardId = (cardId: string) => cardId.endsWith(SUFFIX);
export const viewportIdOf = (cardId: string) => (isCompareCardId(cardId) ? cardId.slice(0, -SUFFIX.length) : cardId);

/** The address B shows while A shows `page`; null when it can't be made. */
export function compareUrl(target: CompareTarget, page: string): string | null {
  if (target.mode === 'fixed') return toSafeHref(target.url) ?? null;
  try {
    const a = new URL(page);
    return toSafeHref(`${new URL(target.origin).origin}${a.pathname}${a.search}${a.hash}`) ?? null;
  } catch {
    return null;
  }
}

/**
 * In mirror mode, the page A should show when B moved to `href` (the same path
 * on A's site); null when B left the compared site or in fixed mode.
 */
export function mirrorBack(target: CompareTarget, href: string, aOrigin: string): string | null {
  if (target.mode !== 'mirror') return null;
  try {
    const b = new URL(href);
    if (b.origin !== new URL(target.origin).origin) return null;
    return toSafeHref(`${new URL(aOrigin).origin}${b.pathname}${b.search}${b.hash}`) ?? null;
  } catch {
    return null;
  }
}

export type CompareParseResult = { ok: true; target: CompareTarget } | { ok: false; error: UrlParseError | 'same' };

/** Reads the address typed in the Compare dialog. `current` is A's page, if any. */
export function parseCompareInput(input: string, mode: CompareMode, current: string | null): CompareParseResult {
  const parsed = parsePreviewUrl(input);
  if (!parsed.ok) return parsed;
  const target: CompareTarget =
    mode === 'mirror' ? { mode, origin: parsed.url.origin } : { mode, url: parsed.url.href };
  // Comparing a page with itself shows nothing new.
  if (current && compareUrl(target, current) === current) return { ok: false, error: 'same' };
  return { ok: true, target };
}

/** Swaps A and B: what B shows becomes the workspace's page, and A's becomes the comparison. */
export function swapCompare(target: CompareTarget, page: string): { page: string; target: CompareTarget } | null {
  const next = compareUrl(target, page);
  if (!next) return null;
  return {
    page: next,
    target: target.mode === 'mirror' ? { mode: 'mirror', origin: new URL(page).origin } : { mode: 'fixed', url: page },
  };
}

/** What the B side is called in the UI: the other site's host, or the fixed address without its scheme. */
export function compareLabel(target: CompareTarget): string {
  if (target.mode === 'mirror') return new URL(target.origin).host;
  return target.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
