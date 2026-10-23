import type { ElementRect } from '../agent/protocol';

/**
 * The inspector's distance between two elements at one viewport: the space
 * between their edges across and down, or — when one is inside the other — the
 * inner one's distance from each edge of the outer one.
 */
export type Gap =
  /** The space across and down; null along an axis where the two overlap (a stack has no space across). */
  | { relation: 'apart'; horizontal: number | null; vertical: number | null }
  | { relation: 'overlap' }
  | { relation: 'inside'; top: number; right: number; bottom: number; left: number };

const round = (value: number) => Math.round(value * 10) / 10;

export function gapBetween(a: ElementRect, b: ElementRect): Gap {
  const right = (rect: ElementRect) => rect.x + rect.width;
  const bottom = (rect: ElementRect) => rect.y + rect.height;
  const across = Math.min(right(a), right(b)) - Math.max(a.x, b.x);
  const down = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
  if (across <= 0 || down <= 0)
    return {
      relation: 'apart',
      horizontal: across <= 0 ? round(-across) : null,
      vertical: down <= 0 ? round(-down) : null,
    };
  const contains = (outer: ElementRect, inner: ElementRect) =>
    inner.x >= outer.x && inner.y >= outer.y && right(inner) <= right(outer) && bottom(inner) <= bottom(outer);
  const [outer, inner] = contains(a, b) ? [a, b] : contains(b, a) ? [b, a] : [null, null];
  if (!outer || !inner) return { relation: 'overlap' };
  return {
    relation: 'inside',
    top: round(inner.y - outer.y),
    right: round(right(outer) - right(inner)),
    bottom: round(bottom(outer) - bottom(inner)),
    left: round(inner.x - outer.x),
  };
}

/** Words for the relations: overlapping, and the insets of one element inside the other ("Inside: …"). */
export type GapWords = { overlap: string; inside: (insets: string) => string };

const px = (value: number) => `${value} px`;

/** "↔ 24 px", "↕ 16 px", "↔ 24 px · ↕ 16 px", "Inside: 8 px 16 px 8 px 16 px" or "Overlap". */
export function gapText(gap: Gap, words: GapWords): string {
  if (gap.relation === 'overlap') return words.overlap;
  if (gap.relation === 'inside') return words.inside([gap.top, gap.right, gap.bottom, gap.left].map(px).join(' '));
  return [gap.horizontal !== null && `↔ ${px(gap.horizontal)}`, gap.vertical !== null && `↕ ${px(gap.vertical)}`]
    .filter(Boolean)
    .join(' · ');
}

/** Whether the distance isn't the same at every viewport where both elements are shown. */
export function gapChanges(gaps: readonly (Gap | null | undefined)[]): boolean {
  const words: GapWords = { overlap: 'overlap', inside: (insets) => insets };
  return new Set(gaps.filter((gap): gap is Gap => Boolean(gap)).map((gap) => gapText(gap, words))).size > 1;
}
