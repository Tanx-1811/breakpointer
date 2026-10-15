/** At most this many screens are captured for one full-page screenshot (very long pages are cut). */
export const MAX_FULL_PAGE_SLICES = 30;

/**
 * The scroll positions (CSS pixels) to capture a page `scrollHeight` tall
 * through a viewport `viewportHeight` tall: one per screen, the last one
 * against the bottom of the page. `partial` when the page needs more than `max`.
 */
export function slicePositions(
  scrollHeight: number,
  viewportHeight: number,
  max = MAX_FULL_PAGE_SLICES,
): { positions: number[]; partial: boolean } {
  const screen = Math.max(1, Math.round(viewportHeight));
  const bottom = Math.max(0, Math.round(scrollHeight) - screen);
  const positions: number[] = [];
  for (let y = 0; ; y += screen) {
    if (positions.length === max) return { positions, partial: true };
    positions.push(Math.min(y, bottom));
    if (y >= bottom) break;
  }
  return { positions, partial: false };
}

/** The height of the stitched image (CSS pixels): from the top to the end of the last screen captured. */
export function stitchedHeight(positions: number[], viewportHeight: number): number {
  return positions.length ? positions[positions.length - 1]! + Math.round(viewportHeight) : 0;
}
