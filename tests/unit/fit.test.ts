import { describe, expect, it } from 'vitest';
import { fitZoomForAll, fitsAt, type CardMetrics } from '../../src/state/fit';
import { createViewport, updateViewport } from '../../src/state/viewports';

const metrics: CardMetrics = { chromeHeight: 80, chromeWidth: 2, stageExtraHeight: 0, minCardWidth: 300, gap: 20 };
const viewports = [
  createViewport({ name: 'Phone', width: 375, height: 667 }),
  createViewport({ name: 'Tablet', width: 768, height: 1024 }),
  createViewport({ name: 'Laptop', width: 1366, height: 768 }),
];

describe('fit', () => {
  it('returns 100% when everything already fits', () => {
    expect(fitZoomForAll(viewports, { width: 5000, height: 2000 }, 'row', metrics)).toBe(1);
  });

  it('finds the largest zoom that fits in a single row', () => {
    const area = { width: 1392, height: 760 };
    const zoom = fitZoomForAll(viewports, area, 'row', metrics);
    expect(fitsAt(viewports, zoom, area, 'row', metrics)).toBe(true);
    expect(fitsAt(viewports, zoom + 0.01, area, 'row', metrics)).toBe(false);
  });

  it('allows wrapping onto several rows in the wrap layout', () => {
    const area = { width: 900, height: 1600 };
    const zoom = fitZoomForAll(viewports, area, 'wrap', metrics);
    expect(zoom).toBeGreaterThan(fitZoomForAll(viewports, area, 'row', metrics));
    expect(fitsAt(viewports, zoom, area, 'wrap', metrics)).toBe(true);
  });

  it('ignores hidden viewports and degrades gracefully', () => {
    const hiddenLaptop = updateViewport(viewports, viewports[2]!.id, { hidden: true });
    expect(fitZoomForAll(hiddenLaptop, { width: 1200, height: 900 }, 'row', metrics)).toBeGreaterThan(
      fitZoomForAll(viewports, { width: 1200, height: 900 }, 'row', metrics),
    );
    expect(fitZoomForAll(viewports, { width: 10, height: 10 }, 'row', metrics)).toBe(0.1);
    expect(fitZoomForAll([], { width: 100, height: 100 }, 'row', metrics)).toBe(1);
  });
});
