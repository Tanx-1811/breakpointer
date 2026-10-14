/** An sRGB colour: channels 0–255, alpha 0–1. */
export type Rgb = { r: number; g: number; b: number; a: number };

const HEX = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const FUNCTION = /^rgba?\(\s*([^)]*)\)$/i;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function channel(part: string): number | null {
  const value = part.trim();
  if (!/^-?\d*\.?\d+%?$/.test(value)) return null;
  const number = Number.parseFloat(value);
  return clamp(Math.round(value.endsWith('%') ? (number / 100) * 255 : number), 0, 255);
}

function alpha(part: string | undefined): number | null {
  if (part === undefined) return 1;
  const value = part.trim();
  if (!/^-?\d*\.?\d+%?$/.test(value)) return null;
  const number = Number.parseFloat(value);
  return clamp(value.endsWith('%') ? number / 100 : number, 0, 1);
}

/**
 * Reads a colour typed by the user or returned by the eyedropper: `#rgb`,
 * `#rgba`, `#rrggbb`, `#rrggbbaa` (the `#` is optional), `rgb(…)` or `rgba(…)`
 * with commas or spaces. Null when it isn't one of those.
 */
export function parseColor(input: string): Rgb | null {
  const text = input.trim();
  const hex = HEX.exec(text);
  if (hex) {
    let digits = hex[1]!;
    if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join('');
    const value = (index: number) => Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return {
      r: value(0),
      g: value(1),
      b: value(2),
      a: digits.length === 8 ? Math.round((value(3) / 255) * 1000) / 1000 : 1,
    };
  }
  const fn = FUNCTION.exec(text);
  if (!fn) return null;
  // rgb(1, 2, 3, .5) · rgb(1 2 3 / 50%)
  const [colours, slashAlpha] = fn[1]!.split('/');
  const parts = colours!.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4 || (parts.length === 4 && slashAlpha !== undefined)) return null;
  const [r, g, b] = parts.slice(0, 3).map(channel);
  const a = alpha(slashAlpha ?? parts[3]);
  if (r == null || g == null || b == null || a == null) return null;
  return { r, g, b, a };
}

/** `#rrggbb` (alpha is left out). */
export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

/** A translucent colour as it shows over an opaque background. */
export function blend(top: Rgb, bottom: Rgb): Rgb {
  const mix = (a: number, b: number) => Math.round(a * top.a + b * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** Relative luminance (WCAG 2), from 0 (black) to 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const linear = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio of text over a background, from 1 to 21. A translucent text colour is blended first. */
export function contrastRatio(text: Rgb, background: Rgb): number {
  const solidBackground = background.a < 1 ? blend(background, { r: 255, g: 255, b: 255, a: 1 }) : background;
  const solidText = text.a < 1 ? blend(text, solidBackground) : text;
  const [lighter, darker] = [relativeLuminance(solidText), relativeLuminance(solidBackground)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/**
 * "4.54" — truncated, never rounded up: WCAG thresholds are exact, so 4.499
 * must not read as 4.50 and appear to pass.
 */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2);
}

/** The WCAG 2.2 thresholds a contrast ratio meets. */
export const CONTRAST_CRITERIA = [
  { id: 'aaNormal', min: 4.5 },
  { id: 'aaLarge', min: 3 },
  { id: 'aaaNormal', min: 7 },
  { id: 'aaaLarge', min: 4.5 },
  { id: 'ui', min: 3 },
] as const;

export type ContrastCriterion = (typeof CONTRAST_CRITERIA)[number]['id'];

export function contrastPasses(ratio: number): Record<ContrastCriterion, boolean> {
  // Compared on the truncated value, as shown.
  const shown = Number(formatRatio(ratio));
  return Object.fromEntries(CONTRAST_CRITERIA.map(({ id, min }) => [id, shown >= min])) as Record<
    ContrastCriterion,
    boolean
  >;
}
