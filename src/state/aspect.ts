import { cssNumber } from './fluid';

/**
 * Aspect ratios for the CSS toolkit: a width and a height as the simplest
 * ratio (and the common one it is close to), its CSS, and the height a
 * full-width box gets at each viewport.
 */
export const COMMON_RATIOS = [
  [1, 1],
  [5, 4],
  [4, 3],
  [3, 2],
  [16, 10],
  [16, 9],
  [2, 1],
  [21, 9],
  [4, 5],
  [3, 4],
  [2, 3],
  [9, 16],
] as const;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export type AspectRatio = {
  width: number;
  height: number;
  /** Width ÷ height. */
  value: number;
  /** A common ratio within 1% of it, when the simplest form isn't one (1366 × 768 ≈ 16:9). */
  near: { width: number; height: number } | null;
};

/** Null unless both sides are positive. Decimals are kept to two places (1.85:1). */
export function aspectRatio(width: number, height: number): AspectRatio | null {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  // Whole hundredths, so 2.39 × 1 simplifies like 239 × 100.
  const w = Math.round(width * 100);
  const h = Math.round(height * 100);
  const divisor = gcd(w, h);
  const simple = { width: w / divisor, height: h / divisor };
  const value = width / height;
  const isCommon = COMMON_RATIOS.some(([a, b]) => a === simple.width && b === simple.height);
  let near: AspectRatio['near'] = null;
  if (!isCommon) {
    const closest = [...COMMON_RATIOS].sort(
      (a, b) => Math.abs(a[0] / a[1] - value) - Math.abs(b[0] / b[1] - value),
    )[0]!;
    if (Math.abs(closest[0] / closest[1] - value) / value <= 0.01) near = { width: closest[0], height: closest[1] };
  }
  return { ...simple, value, near };
}

/** `16:9`; a ratio with large terms is written as a decimal (`1.778:1`). */
export function ratioText(ratio: Pick<AspectRatio, 'width' | 'height' | 'value'>): string {
  return ratio.width > 99 || ratio.height > 99
    ? `${cssNumber(ratio.value, 3)}:1`
    : `${cssNumber(ratio.width, 2)}:${cssNumber(ratio.height, 2)}`;
}

/** `aspect-ratio: 16 / 9;` and the padding fallback for very old browsers. */
export function aspectCss(ratio: AspectRatio): string {
  const terms =
    ratio.width > 99 || ratio.height > 99 ? `${cssNumber(ratio.value, 4)}` : `${ratio.width} / ${ratio.height}`;
  return [
    `aspect-ratio: ${terms};`,
    '',
    '/* Fallback: a wrapper with this padding and the content positioned inside. */',
    `padding-top: ${cssNumber(100 / ratio.value, 4)}%;`,
  ].join('\n');
}

/** The height (px, rounded) of a box `share` % of the viewport wide at this ratio. */
export const heightAt = (viewportWidth: number, share: number, ratio: AspectRatio) =>
  Math.round(((viewportWidth * share) / 100 / ratio.value) * 100) / 100;
