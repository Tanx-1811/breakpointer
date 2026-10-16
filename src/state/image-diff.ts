/**
 * Pixel comparison of two screenshots of the same size (RGBA, as in ImageData).
 * Colour differences are measured in YIQ, which weighs them as the eye does
 * (the measure the pixelmatch library popularised), so a 1-step change of a
 * shade doesn't count while a moved edge does.
 */

export type DiffRegion = { x: number; y: number; width: number; height: number };

export type DiffResult = {
  /** Pixels that differ more than the threshold. */
  changed: number;
  total: number;
  /** changed / total, from 0 to 1. */
  ratio: number;
  /** Boxes around the areas that changed, largest first. */
  regions: DiffRegion[];
  /** The baseline faded to grey, with the changed pixels in magenta (RGBA, same size). */
  output: Uint8ClampedArray<ArrayBuffer>;
};

/**
 * From 0 (any change counts) to 1. 0.05 ignores shades a few steps apart (noise, resampling) but
 * catches a background turning from white to a light tint; pixelmatch's usual 0.1 would let that pass.
 */
export const DEFAULT_THRESHOLD = 0.05;
/** Changes are grouped on a grid of cells this many pixels wide to make regions. */
export const REGION_CELL = 16;
export const MAX_REGIONS = 40;

const CHANGED = [236, 24, 132] as const;

const blend = (channel: number, alpha: number) => 255 + (channel - 255) * alpha;
const y = (r: number, g: number, b: number) => r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
const i = (r: number, g: number, b: number) => r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
const q = (r: number, g: number, b: number) => r * 0.21147017 - g * 0.52261711 + b * 0.31114694;

/** The squared perceptual distance between two RGBA pixels (translucent ones are seen over white). */
export function colorDistance(a: ArrayLike<number>, ai: number, b: ArrayLike<number>, bi: number): number {
  let r1 = a[ai]!;
  let g1 = a[ai + 1]!;
  let b1 = a[ai + 2]!;
  const a1 = a[ai + 3]!;
  let r2 = b[bi]!;
  let g2 = b[bi + 1]!;
  let b2 = b[bi + 2]!;
  const a2 = b[bi + 3]!;
  if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) return 0;
  if (a1 < 255) {
    const alpha = a1 / 255;
    r1 = blend(r1, alpha);
    g1 = blend(g1, alpha);
    b1 = blend(b1, alpha);
  }
  if (a2 < 255) {
    const alpha = a2 / 255;
    r2 = blend(r2, alpha);
    g2 = blend(g2, alpha);
    b2 = blend(b2, alpha);
  }
  const dy = y(r1, g1, b1) - y(r2, g2, b2);
  const di = i(r1, g1, b1) - i(r2, g2, b2);
  const dq = q(r1, g1, b1) - q(r2, g2, b2);
  return 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
}

/** The largest distance between two colours is about 35215 (black and white: 32857); thresholds are a share of it, squared. */
const maxDistance = (threshold: number) => 35215 * threshold * threshold;

/**
 * Compares two images of `width` × `height` pixels. Throws when the buffers
 * don't have that size (scale one to the other first).
 */
export function diffImages(
  baseline: Uint8ClampedArray,
  current: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = DEFAULT_THRESHOLD,
): DiffResult {
  const total = width * height;
  if (baseline.length !== total * 4 || current.length !== total * 4)
    throw new Error('The images must have the same size');
  const limit = maxDistance(threshold);
  const output = new Uint8ClampedArray(total * 4);
  const columns = Math.ceil(width / REGION_CELL);
  const rows = Math.ceil(height / REGION_CELL);
  const cells = new Uint8Array(columns * rows);
  let changed = 0;
  for (let pixel = 0; pixel < total; pixel++) {
    const index = pixel * 4;
    if (colorDistance(baseline, index, current, index) > limit) {
      changed++;
      output[index] = CHANGED[0];
      output[index + 1] = CHANGED[1];
      output[index + 2] = CHANGED[2];
      output[index + 3] = 255;
      const x = pixel % width;
      const row = (pixel - x) / width;
      cells[Math.floor(row / REGION_CELL) * columns + Math.floor(x / REGION_CELL)] = 1;
    } else {
      // The baseline, faded to a light grey so the changes stand out.
      const alpha = baseline[index + 3]! / 255;
      const luma = y(
        blend(baseline[index]!, alpha),
        blend(baseline[index + 1]!, alpha),
        blend(baseline[index + 2]!, alpha),
      );
      const shade = blend(luma, 0.15);
      output[index] = shade;
      output[index + 1] = shade;
      output[index + 2] = shade;
      output[index + 3] = 255;
    }
  }
  return {
    changed,
    total,
    ratio: total ? changed / total : 0,
    regions: regionsOf(cells, columns, rows, width, height),
    output,
  };
}

/** Groups marked cells that touch (also diagonally) into boxes, in pixels, largest first. */
export function regionsOf(
  cells: Uint8Array,
  columns: number,
  rows: number,
  width: number,
  height: number,
  cell = REGION_CELL,
): DiffRegion[] {
  const seen = new Uint8Array(cells.length);
  const regions: DiffRegion[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (!cells[start] || seen[start]) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const index = stack.pop()!;
      const cx = index % columns;
      const cy = (index - cx) / columns;
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy);
      maxY = Math.max(maxY, cy);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
          const next = ny * columns + nx;
          if (cells[next] && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
    }
    const x = minX * cell;
    const y = minY * cell;
    regions.push({
      x,
      y,
      width: Math.min(width, (maxX + 1) * cell) - x,
      height: Math.min(height, (maxY + 1) * cell) - y,
    });
  }
  return regions.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, MAX_REGIONS);
}

/** "0.4%", "12%", "< 0.1%" — how much of the image changed. */
export function formatChange(ratio: number, locale = 'en'): string {
  if (ratio <= 0) return new Intl.NumberFormat(locale, { style: 'percent' }).format(0);
  if (ratio < 0.001)
    return `< ${new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(0.001)}`;
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: ratio < 0.1 ? 1 : 0,
  }).format(ratio);
}
