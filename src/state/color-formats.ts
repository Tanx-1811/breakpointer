import { parseCssColor } from '../agent/page-utils';
import { contrastRatio, parseColor, type Rgb } from './contrast';
import { cssNumber } from './fluid';

/**
 * A colour in the formats CSS uses, for the CSS toolkit's colour picker:
 * HEX, rgb(), hsl() and oklch(), with its contrast on white and on black.
 */
export const COLOR_FORMATS = ['hex', 'rgb', 'hsl', 'oklch'] as const;
export type ColorFormat = (typeof COLOR_FORMATS)[number];

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Hue (0–360), saturation and lightness (0–100). */
export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: l * 100 };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === red) h = ((green - blue) / delta) % 6;
  else if (max === green) h = (blue - red) / delta + 2;
  else h = (red - green) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number, a = 1): Rgb {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r1, g1, b1] =
    hue < 1
      ? [chroma, x, 0]
      : hue < 2
        ? [x, chroma, 0]
        : hue < 3
          ? [0, chroma, x]
          : hue < 4
            ? [0, x, chroma]
            : hue < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const m = lightness - chroma / 2;
  const channel = (value: number) => Math.round((value + m) * 255);
  return { r: channel(r1), g: channel(g1), b: channel(b1), a };
}

const toLinear = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** OKLCH (Björn Ottosson's OKLab, in polar form): lightness 0–1, chroma, hue in degrees. */
export function rgbToOklch({ r, g, b }: Rgb): { l: number; c: number; h: number } {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 0.0001 ? 0 : h };
}

const alphaPart = (a: number) => (a < 1 ? ` / ${cssNumber(a, 3)}` : '');

/** The colour written in one format. */
export function formatColor(color: Rgb, format: ColorFormat): string {
  const rgb = { r: Math.round(color.r), g: Math.round(color.g), b: Math.round(color.b), a: color.a };
  switch (format) {
    case 'hex': {
      const hex = [rgb.r, rgb.g, rgb.b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('');
      const alpha = rgb.a < 1 ? Math.round(clamp(rgb.a, 0, 1) * 255).toString(16).padStart(2, '0') : '';
      return `#${hex}${alpha}`;
    }
    case 'rgb':
      return `rgb(${rgb.r} ${rgb.g} ${rgb.b}${alphaPart(rgb.a)})`;
    case 'hsl': {
      const { h, s, l } = rgbToHsl(rgb);
      return `hsl(${cssNumber(h, 1)} ${cssNumber(s, 1)}% ${cssNumber(l, 1)}%${alphaPart(rgb.a)})`;
    }
    case 'oklch': {
      const { l, c, h } = rgbToOklch(rgb);
      return `oklch(${cssNumber(l * 100, 1)}% ${cssNumber(c, 3)} ${cssNumber(h, 1)}${alphaPart(rgb.a)})`;
    }
  }
}

const HSL = /^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i;

/**
 * Reads a colour typed by the user: HEX, rgb(), hsl(), oklch() and the other
 * spaces Chrome writes (oklab, lab, lch, color()). Named colours need the
 * browser (`resolveNamed`). Null when unreadable.
 */
export function parseAnyColor(input: string, resolveNamed?: (text: string) => string | null): Rgb | null {
  const text = input.trim();
  if (!text) return null;
  const direct = parseColor(text);
  if (direct) return direct;
  const hsl = HSL.exec(text);
  if (hsl) {
    const alphaText = hsl[4];
    const alpha =
      alphaText === undefined
        ? 1
        : alphaText.endsWith('%')
          ? Number.parseFloat(alphaText) / 100
          : Number.parseFloat(alphaText);
    return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]), clamp(alpha, 0, 1));
  }
  const css = parseCssColor(text);
  if (css) return { r: css.r, g: css.g, b: css.b, a: css.a };
  if (resolveNamed && /^[a-z]+$/i.test(text)) {
    const resolved = resolveNamed(text);
    return resolved ? parseAnyColor(resolved) : null;
  }
  return null;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };

/** Contrast of the colour as text on white and on black (WCAG 2). */
export function contrastOnWhiteAndBlack(color: Rgb): { white: number; black: number } {
  return { white: contrastRatio(color, WHITE), black: contrastRatio(color, BLACK) };
}

/** Every format of a colour, one per line, for copying. */
export const allFormats = (color: Rgb) => COLOR_FORMATS.map((format) => formatColor(color, format)).join('\n');
