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
    width: Math.max(metrics.minCardWidth, vp.width * zoom + metrics.chromeWidth),
    height: vp.height * zoom + metrics.stageExtraHeight + metrics.chromeHeight,
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

/**
 * The largest single zoom (≤ 100%) at which every visible viewport fits in the
 * area. One zoom for all keeps sizes comparable with each other.
 */
export function fitZoomForAll(
  viewports: ViewportConfig[],
  area: Area,
  layout: WorkspaceLayout,
  metrics: CardMetrics,
): number {
  const visible = viewports.filter((vp) => !vp.hidden);
  if (visible.length === 0 || area.width <= 0 || area.height <= 0) return MAX_ZOOM;
  if (fitsAt(visible, MAX_ZOOM, area, layout, metrics)) return MAX_ZOOM;

  // Search in whole percents for the largest zoom that fits.
  let low = Math.round(MIN_ZOOM * 100);
  let high = Math.round(MAX_ZOOM * 100);
  if (!fitsAt(visible, low / 100, area, layout, metrics)) return MIN_ZOOM;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fitsAt(visible, mid / 100, area, layout, metrics)) low = mid;
    else high = mid;
  }
  return low / 100;
}
