import { describe, expect, it } from 'vitest';
import { parseCssColor } from '../../src/agent/page-utils';

/** Each channel within `tolerance` of the expected value. */
function near(text: string, [r, g, b, a = 1]: number[], tolerance = 2) {
  const color = parseCssColor(text);
  expect(color, text).not.toBeNull();
  expect(Math.abs(color!.r - r!), `${text} red`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(color!.g - g!), `${text} green`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(color!.b - b!), `${text} blue`).toBeLessThanOrEqual(tolerance);
  expect(color!.a).toBeCloseTo(a, 2);
}

describe('colours as getComputedStyle writes them', () => {
  it('reads rgb() and transparent', () => {
    near('rgb(31, 36, 48)', [31, 36, 48]);
    near('rgba(0, 0, 0, 0.5)', [0, 0, 0, 0.5]);
    expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('reads oklch() and oklab(), as Tailwind 4 writes its colours', () => {
    // The CSS Color 4 examples for pure red and white.
    near('oklch(0.628 0.25768 29.2339)', [255, 0, 0]);
    near('oklab(0.62796 0.22486 0.12585)', [255, 0, 0]);
    near('oklch(1 0 0)', [255, 255, 255]);
    near('oklch(0 0 none)', [0, 0, 0]);
    near('oklch(62.8% 0.25768 29.2339)', [255, 0, 0]);
    // Tailwind's gray-900 and gray-50.
    near('oklch(0.21 0.034 264.665)', [16, 24, 40], 3);
    near('oklch(0.985 0.002 247.839)', [249, 250, 251], 3);
    expect(parseCssColor('oklch(0.5 0.1 200 / 0.4)')!.a).toBeCloseTo(0.4, 3);
  });

  it('reads lab(), lch() and color()', () => {
    // CSS lab() is relative to D50: sRGB red is lab(54.29 80.81 69.89).
    near('lab(54.29 80.81 69.89)', [255, 0, 0], 3);
    near('lch(54.29 106.84 40.85)', [255, 0, 0], 3);
    near('lab(100 0 0)', [255, 255, 255]);
    near('color(srgb 0.2 0.4 0.6)', [51, 102, 153]);
    near('color(srgb-linear 0.2140 0.2140 0.2140)', [128, 128, 128]);
    near('color(display-p3 1 1 1 / 0.5)', [255, 255, 255, 0.5]);
    // Outside sRGB, clipped.
    near('color(display-p3 1 0 0)', [255, 0, 0], 3);
  });

  it('knows when it can’t read a colour', () => {
    for (const unknown of ['color(rec2020 1 0 0)', 'oklch(0.5 0.1)', 'hsl(0 100% 50%)', 'currentcolor', 'lab(nope)'])
      expect(parseCssColor(unknown), unknown).toBeNull();
  });
});
