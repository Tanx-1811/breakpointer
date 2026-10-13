import type { ViewportConfig, WorkspaceLayout } from '../types';
import { MAX_ZOOM, MIN_ZOOM } from '../utils/constants';

export type CardMetrics = {
  /** Height of a card's header plus borders, in CSS pixels. */
  chromeHeight: number;
  /** Extra width a card adds around the scaled preview (borders, ruler). */
  chromeWidth: number;
  /** Extra height inside the stage (ruler). */
  stageExtraHeight: number;
  minCardWidth: number;
  gap: number;
};

export type Area = { width: number; height: number };

function cardSize(vp: ViewportConfig, zoom: number, metrics: CardMetrics) {
  return {
    // Cards round their scaled size; round up here so a fit never overflows by a sub-pixel.
    width: Math.max(metrics.minCardWidth, Math.ceil(vp.width * zoom) + metrics.chromeWidth),
    height: Math.ceil(vp.height * zoom) + metrics.stageExtraHeight + metrics.chromeHeight,
  };
}

/** Whether the cards fit in `area` at `zoom`, simulating flex-wrap or a single row. */
export function fitsAt(
  viewports: ViewportConfig[],
  zoom: number,
  area: Area,
  layout: WorkspaceLayout,
  metrics: CardMetrics,
): boolean {
  const sizes = viewports.map((vp) => cardSize(vp, zoom, metrics));
  if (layout === 'row') {
    const totalWidth = sizes.reduce((sum, size) => sum + size.width, 0) + metrics.gap * (sizes.length - 1);
    return totalWidth <= area.width && sizes.every((size) => size.height <= area.height);
  }

  let rowWidth = 0;
  let rowHeight = 0;
  let totalHeight = 0;
  for (const size of sizes) {
    if (size.width > area.width) return false;
    const nextWidth = rowWidth === 0 ? size.width : rowWidth + metrics.gap + size.width;
    if (nextWidth > area.width) {
      totalHeight += rowHeight + metrics.gap;
      rowWidth = size.width;
      rowHeight = size.height;
    } else {
      rowWidth = nextWidth;
      rowHeight = Math.max(rowHeight, size.height);
    }
  }
  totalHeight += rowHeight;
  return totalHeight <= area.height;
}

/** Below this, previews are hard to read: prefer scrolling to shrinking further. */
export const MIN_READABLE_ZOOM = 0.25;

const floorPercent = (zoom: number) => Math.floor(zoom * 100) / 100;
const clampZoomRange = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The largest zoom at which every card, on its own, fits the area (nothing is cut off). */
function perCardZoom(visible: ViewportConfig[], area: Area, metrics: CardMetrics, includeWidth: boolean): number {
  return Math.min(
    ...visible.map((vp) => {
      const byHeight = (area.height - metrics.chromeHeight - metrics.stageExtraHeight) / vp.height;
      const byWidth = (area.width - metrics.chromeWidth) / vp.width;
      return includeWidth ? Math.min(byHeight, byWidth) : byHeight;
    }),
  );
}

/**
 * One zoom for every visible viewport (so sizes stay comparable), or null when
 * none is visible.
 * - Row layout scrolls sideways by design: fit the height only.
 * - Wrap layout: the largest zoom at which everything fits on screen. If that
 *   would be unreadably small (or impossible, e.g. many cards in a small
 *   window), use a readable zoom instead and let the workspace scroll.
 */
export function fitZoomForAll(
  viewports: ViewportConfig[],
  area: Area,
  layout: WorkspaceLayout,
  metrics: CardMetrics,
): number | null {
  const visible = viewports.filter((vp) => !vp.hidden);
  if (visible.length === 0) return null;
  if (area.width <= 0 || area.height <= 0) return MIN_ZOOM;

  if (layout === 'row') return clampZoomRange(floorPercent(perCardZoom(visible, area, metrics, false)));

  if (fitsAt(visible, MAX_ZOOM, area, layout, metrics)) return MAX_ZOOM;
  // Search in whole percents for the largest zoom that fits.
  let low = Math.round(MIN_ZOOM * 100);
  let high = Math.round(MAX_ZOOM * 100);
  let fitted: number | null = null;
  if (fitsAt(visible, low / 100, area, layout, metrics)) {
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (fitsAt(visible, mid / 100, area, layout, metrics)) low = mid;
      else high = mid;
    }
    fitted = low / 100;
  }
  if (fitted !== null && fitted >= MIN_READABLE_ZOOM) return fitted;
  // Everything can't fit readably: keep each card whole and readable, and scroll.
  return clampZoomRange(floorPercent(Math.min(perCardZoom(visible, area, metrics, true), MIN_READABLE_ZOOM)));
}
