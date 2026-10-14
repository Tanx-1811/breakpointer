export type Rect = { left: number; top: number; width: number; height: number };

export type Size = { width: number; height: number };

/** Space between windows placed side by side, in screen pixels. */
export const WINDOW_GAP = 8;
/** How far each cascaded window is moved from the previous one. */
export const CASCADE_STEP = 32;

/**
 * Where to put real windows (outer sizes, frame included) on the screen's
 * available `area`: left to right, wrapping onto new rows like the workspace.
 * Windows that no longer fit below are cascaded from the top left, so each
 * one stays reachable. A window larger than the area is shrunk to it (Chrome
 * would do the same).
 */
export function tileWindows(sizes: Size[], area: Rect, gap = WINDOW_GAP): Rect[] {
  const right = area.left + area.width;
  const bottom = area.top + area.height;
  let x = area.left;
  let y = area.top;
  let rowHeight = 0;
  let cascaded = 0;
  return sizes.map((size) => {
    const width = Math.max(1, Math.min(Math.round(size.width), area.width));
    const height = Math.max(1, Math.min(Math.round(size.height), area.height));
    // Start a new row when this window doesn't fit next to the previous one.
    if (x > area.left && x + width > right) {
      x = area.left;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    if (y + height <= bottom) {
      const rect = { left: x, top: y, width, height };
      x += width + gap;
      rowHeight = Math.max(rowHeight, height);
      return rect;
    }
    // No room left: cascade, kept inside the area.
    const offset = CASCADE_STEP * cascaded++;
    return {
      left: Math.min(area.left + offset, right - width),
      top: Math.min(area.top + offset, bottom - height),
      width,
      height,
    };
  });
}
