import { describe, expect, it } from 'vitest';
import { fitZoomForAll, fitsAt, MIN_READABLE_ZOOM, type CardMetrics } from '../../src/state/fit';
import { createViewport, updateViewport } from '../../src/state/viewports';

const metrics: CardMetrics = { chromeHeight: 80, chromeWidth: 2, stageExtraHeight: 0, minCardWidth: 300, gap: 20 };
const viewports = [
  createViewport({ name: 'Phone', width: 375, height: 667 }),
  createViewport({ name: 'Tablet', width: 768, height: 1024 }),
  createViewport({ name: 'Laptop', width: 1366, height: 768 }),
];

describe('fit', () => {
  it('returns 100% when everything already fits', () => {
    expect(fitZoomForAll(viewports, { width: 5000, height: 2000 }, 'wrap', metrics)).toBe(1);
    expect(fitZoomForAll(viewports, { width: 5000, height: 2000 }, 'row', metrics)).toBe(1);
  });

  it('fits only the height in the row layout, which scrolls sideways', () => {
    // The tallest preview (1024) must fit in 760 - 80 px of height.
    expect(fitZoomForAll(viewports, { width: 600, height: 760 }, 'row', metrics)).toBe(0.66);
  });

  it('finds the largest zoom at which everything fits when wrapping', () => {
    const area = { width: 1392, height: 760 };
    const zoom = fitZoomForAll(viewports, area, 'wrap', metrics)!;
    expect(fitsAt(viewports, zoom, area, 'wrap', metrics)).toBe(true);
    expect(fitsAt(viewports, zoom + 0.01, area, 'wrap', metrics)).toBe(false);
  });

  it('prefers a readable zoom and scrolling over shrinking everything to a sliver', () => {
    const many = Array.from({ length: 8 }, (_, i) => createViewport({ name: `#${i}`, width: 1440, height: 900 }));
    const zoom = fitZoomForAll(many, { width: 976, height: 600 }, 'wrap', metrics)!;
    expect(zoom).toBe(MIN_READABLE_ZOOM);
    // Each card still fits on its own.
    expect(fitsAt([many[0]!], zoom, { width: 976, height: 600 }, 'wrap', metrics)).toBe(true);
  });

  it('ignores hidden viewports, returns null when nothing is visible, and never goes below 10%', () => {
    const hiddenLaptop = updateViewport(viewports, viewports[2]!.id, { hidden: true });
    expect(fitZoomForAll(hiddenLaptop, { width: 1200, height: 900 }, 'wrap', metrics)!).toBeGreaterThan(
      fitZoomForAll(viewports, { width: 1200, height: 900 }, 'wrap', metrics)!,
    );
    const allHidden = viewports.map((vp) => ({ ...vp, hidden: true }));
    expect(fitZoomForAll(allHidden, { width: 1200, height: 900 }, 'wrap', metrics)).toBeNull();
    expect(fitZoomForAll(viewports, { width: 10, height: 10 }, 'wrap', metrics)).toBe(0.1);
  });
});
