import { describe, expect, it } from 'vitest';
import { shortcutFor } from '../../src/hooks/useShortcuts';
import {
  MAX_REGIONS,
  REGION_CELL,
  colorDistance,
  diffImages,
  formatChange,
  regionsOf,
} from '../../src/state/image-diff';
import { snapshotId, snapshotPage, snapshotsToPrune, summarizeSnapshots, viewportKey } from '../../src/state/snapshots';

/** A solid image of `width` × `height` pixels. */
function solid(width: number, height: number, [r, g, b, a = 255]: number[]): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set([r!, g!, b!, a], index);
  return data;
}

function paint(data: Uint8ClampedArray, width: number, x: number, y: number, w: number, h: number, rgb: number[]) {
  for (let row = y; row < y + h; row++)
    for (let column = x; column < x + w; column++) data.set([...rgb, 255], (row * width + column) * 4);
}

describe('pixel comparison', () => {
  it('measures colour differences as the eye sees them', () => {
    const white = [255, 255, 255, 255];
    const black = [0, 0, 0, 255];
    expect(colorDistance(white, 0, white, 0)).toBe(0);
    // Black against white is close to the largest difference (35215, the base of the threshold).
    expect(colorDistance(black, 0, white, 0)).toBeCloseTo(32857, 0);
    // A one-step change of a shade is tiny next to it.
    expect(colorDistance([200, 200, 200, 255], 0, [201, 200, 200, 255], 0)).toBeLessThan(1);
    // A transparent pixel is seen over white.
    expect(colorDistance([0, 0, 0, 0], 0, white, 0)).toBe(0);
  });

  it('finds nothing between identical images', () => {
    const image = solid(40, 30, [240, 240, 240]);
    const result = diffImages(image, image.slice(), 40, 30);
    expect(result.changed).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.regions).toEqual([]);
    expect(result.output).toHaveLength(40 * 30 * 4);
  });

  it('ignores differences under the threshold, but not a light tint', () => {
    expect(diffImages(solid(10, 10, [200, 200, 200]), solid(10, 10, [203, 201, 200]), 10, 10).changed).toBe(0);
    // A white background turning faintly pink is a change.
    expect(diffImages(solid(10, 10, [255, 255, 255]), solid(10, 10, [255, 238, 238]), 10, 10).changed).toBe(100);
    // Unless a looser threshold is asked for.
    expect(diffImages(solid(10, 10, [255, 255, 255]), solid(10, 10, [255, 238, 238]), 10, 10, 0.1).changed).toBe(0);
  });

  it('counts and boxes what changed', () => {
    const before = solid(64, 64, [255, 255, 255]);
    const after = before.slice();
    paint(after, 64, 4, 4, 8, 8, [20, 20, 20]);
    paint(after, 64, 48, 40, 10, 20, [255, 0, 0]);
    const result = diffImages(before, after, 64, 64);
    expect(result.changed).toBe(8 * 8 + 10 * 20);
    expect(result.ratio).toBeCloseTo((64 + 200) / (64 * 64), 6);
    // Regions follow the 16px grid, largest first.
    expect(result.regions).toEqual([
      { x: 48, y: 32, width: 16, height: 32 },
      { x: 0, y: 0, width: 16, height: 16 },
    ]);
    // Changed pixels are painted magenta, the rest a light grey.
    const changedPixel = (5 * 64 + 5) * 4;
    expect([...result.output.slice(changedPixel, changedPixel + 3)]).toEqual([236, 24, 132]);
    expect(result.output[0]).toBeGreaterThan(240);
  });

  it('refuses images of different sizes', () => {
    expect(() => diffImages(solid(4, 4, [0, 0, 0]), solid(4, 5, [0, 0, 0]), 4, 4)).toThrow('same size');
  });

  it('groups touching cells into one region, diagonals too', () => {
    const columns = 4;
    const cells = new Uint8Array(16);
    cells[0] = 1;
    cells[5] = 1; // diagonal neighbour of 0
    cells[15] = 1;
    const regions = regionsOf(cells, columns, 4, 64, 60);
    expect(regions).toEqual([
      { x: 0, y: 0, width: 2 * REGION_CELL, height: 2 * REGION_CELL },
      // The last row is cut to the image's height.
      { x: 48, y: 48, width: 16, height: 12 },
    ]);
  });

  it('keeps at most a few dozen regions', () => {
    const columns = 30;
    const cells = new Uint8Array(columns * columns);
    for (let row = 0; row < columns; row += 2)
      for (let column = 0; column < columns; column += 2) cells[row * columns + column] = 1;
    expect(regionsOf(cells, columns, columns, 480, 480)).toHaveLength(MAX_REGIONS);
  });

  it('writes how much changed', () => {
    expect(formatChange(0)).toBe('0%');
    expect(formatChange(0.0004)).toBe('< 0.1%');
    expect(formatChange(0.0234)).toBe('2.3%');
    expect(formatChange(0.42)).toBe('42%');
    expect(formatChange(0.0234, 'vi')).toBe('2,3%');
  });
});

describe('visual baselines', () => {
  it('belong to a page and a viewport size (and page colours)', () => {
    expect(viewportKey({ width: 375, height: 667 })).toBe('375x667');
    expect(viewportKey({ width: 375, height: 667, colorScheme: 'dark' })).toBe('375x667 dark');
    expect(snapshotPage('https://example.com/a?b=1#top')).toBe('https://example.com/a?b=1');
    expect(snapshotId('https://example.com/#x', '375x667')).toBe('https://example.com/ 375x667');
  });

  it('drop the oldest beyond the limit', () => {
    const list = [
      { id: 'c', createdAt: 3 },
      { id: 'a', createdAt: 1 },
      { id: 'b', createdAt: 2 },
    ];
    expect(snapshotsToPrune(list, 3)).toEqual([]);
    expect(snapshotsToPrune(list, 1)).toEqual(['a', 'b']);
  });

  it('are summed up per page, newest first', () => {
    const image = (size: number) => new Blob([new Uint8Array(size)]);
    expect(
      summarizeSnapshots([
        { page: 'https://a.test/', createdAt: 10, image: image(100) },
        { page: 'https://b.test/', createdAt: 30, image: image(50) },
        { page: 'https://a.test/', createdAt: 20, image: image(25) },
      ]),
    ).toEqual([
      { page: 'https://b.test/', count: 1, bytes: 50, updated: 30 },
      { page: 'https://a.test/', count: 2, bytes: 125, updated: 20 },
    ]);
  });

  it('V opens the visual check', () => {
    expect(
      shortcutFor({
        key: 'v',
        code: 'KeyV',
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        isComposing: false,
      }),
    ).toBe('visual');
  });
});
