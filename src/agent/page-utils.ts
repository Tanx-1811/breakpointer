/**
 * Small, dependency-free helpers used by the frame agent (and unit tested on
 * their own). They only read the page's structure and styles; nothing here
 * sends or stores page content.
 */

import { parseColor, type Rgb } from '../state/contrast';
import type { MetaTag, PageMeta } from './protocol';

/** Pixels per em/rem in media queries (they use the initial font size, not the page's). */
const MEDIA_EM_PX = 16;

export type Comparison = '<' | '<=' | '>' | '>=';

/** A width's unit and number in media queries (regex sources, each one capturing group). */
export const UNIT = '(px|em|rem)';
export const NUMBER = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
const LEGACY = new RegExp(`\\(\\s*(min|max)-width\\s*:\\s*${NUMBER}${UNIT}\\s*\\)`, 'gi');
// `width >= 768px`, `768px <= width`, `640px <= width < 1024px` (Media Queries level 4 ranges).
const RANGE = new RegExp(
  `\\(\\s*(?:${NUMBER}${UNIT}\\s*(<=|<|>=|>)\\s*)?width\\s*(?:(<=|<|>=|>)\\s*${NUMBER}${UNIT})?\\s*\\)`,
  'gi',
);

/** A media query length in CSS pixels (em and rem are 16 px there). */
export function toPx(value: string, unit: string): number {
  const number = Number(value);
  return unit.toLowerCase() === 'px' ? number : number * MEDIA_EM_PX;
}

/** The first whole width at which `width <op> value` changes from true to false or back. */
function edgeOf(op: Comparison, value: number): number {
  switch (op) {
    case '>=':
    case '<':
      return Math.ceil(value);
    case '>':
    case '<=':
      return Math.floor(value) + 1;
  }
}

/** The same comparison read from the other side ("768px <= width" is "width >= 768px"). */
export const FLIP: Record<Comparison, Comparison> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };

/** Splits a media query list on its top-level commas. */
export function splitQueries(text: string): string[] {
  const queries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      queries.push(text.slice(start, index));
      start = index + 1;
    }
  }
  queries.push(text.slice(start));
  return queries.map((query) => query.trim()).filter(Boolean);
}

/**
 * Widths (CSS pixels) at which a media query list can change the layout, e.g.
 * "(max-width: 767.98px)" → [768] and "(min-width: 48em)" → [768]. Queries for
 * print only are ignored; so are `device-width` and heights.
 */
export function mediaQueryEdges(text: string): number[] {
  const edges = new Set<number>();
  for (const query of splitQueries(text.toLowerCase())) {
    if (/^(only\s+)?print\b/.test(query)) continue;
    for (const match of query.matchAll(LEGACY)) {
      const value = toPx(match[2]!, match[3]!);
      edges.add(edgeOf(match[1] === 'min' ? '>=' : '<=', value));
    }
    for (const match of query.matchAll(RANGE)) {
      const [, lowValue, lowUnit, lowOp, highOp, highValue, highUnit] = match;
      // "768px <= width" reads as "width >= 768px".
      if (lowValue && lowUnit && lowOp) edges.add(edgeOf(FLIP[lowOp as Comparison], toPx(lowValue, lowUnit)));
      if (highOp && highValue && highUnit) edges.add(edgeOf(highOp as Comparison, toPx(highValue, highUnit)));
    }
  }
  return [...edges].filter((edge) => edge > 0 && edge < 10_000).sort((a, b) => a - b);
}

/** Swaps `prefers-color-scheme: dark` and `light`, so a page in a light browser shows its dark styles (or back). */
export function swapColorScheme(text: string): string {
  return text.replace(
    /(prefers-color-scheme\s*:\s*)(dark|light)/gi,
    (_, prefix: string, scheme: string) => `${prefix}${scheme.toLowerCase() === 'dark' ? 'light' : 'dark'}`,
  );
}

export function mentionsColorScheme(text: string): boolean {
  return /prefers-color-scheme/i.test(text);
}

/**
 * Makes `prefers-reduced-motion` queries answer the other way, so a page in a
 * browser without the preference shows its reduced-motion styles: `reduce` and
 * `no-preference` swap, and the bare `(prefers-reduced-motion)` (true only with
 * the preference) becomes `(prefers-reduced-motion: no-preference)`.
 */
export function swapReducedMotion(text: string): string {
  return text.replace(
    /(prefers-reduced-motion)(\s*:\s*(reduce|no-preference))?/gi,
    (_, feature: string, _value: string | undefined, keyword: string | undefined) => {
      if (!keyword) return `${feature}: no-preference`;
      return `${feature}: ${keyword.toLowerCase() === 'reduce' ? 'no-preference' : 'reduce'}`;
    },
  );
}

export function mentionsReducedMotion(text: string): boolean {
  return /prefers-reduced-motion/i.test(text);
}

/**
 * Makes `prefers-contrast: more` queries match in a browser without the
 * preference: `more` and `no-preference` swap, and the bare
 * `(prefers-contrast)` (true with any preference) becomes `no-preference`.
 */
export function swapPrefersContrast(text: string): string {
  return text.replace(
    /(prefers-contrast)(\s*:\s*(more|no-preference))?(?=\s*\))/gi,
    (_, feature: string, _value: string | undefined, keyword: string | undefined) => {
      if (!keyword) return `${feature}: no-preference`;
      return `${feature}: ${keyword.toLowerCase() === 'more' ? 'no-preference' : 'more'}`;
    },
  );
}

export function mentionsPrefersContrast(text: string): boolean {
  return /prefers-contrast/i.test(text);
}

/**
 * Makes a desktop page (a mouse or trackpad: it hovers, its pointer is fine)
 * show its touch-screen styles: `hover: hover` and `none` swap, the bare
 * `(hover)` (true only with hover) becomes `(hover: none)`, and `pointer: fine`
 * and `coarse` swap — the same for `any-hover` and `any-pointer`. The bare
 * `(pointer)` and `pointer: none` stay: a touch screen has a pointer too.
 */
export function swapPointerMedia(text: string): string {
  return text
    .replace(
      /(?<![\w-])(any-hover|hover)(\s*:\s*(hover|none))?(?=\s*\))/gi,
      (_, feature: string, _value: string | undefined, keyword: string | undefined) =>
        `${feature}: ${keyword?.toLowerCase() === 'none' ? 'hover' : 'none'}`,
    )
    .replace(
      /(?<![\w-])(any-pointer|pointer)\s*:\s*(fine|coarse)(?=\s*\))/gi,
      (_, feature: string, keyword: string) => `${feature}: ${keyword.toLowerCase() === 'fine' ? 'coarse' : 'fine'}`,
    );
}

export function mentionsPointer(text: string): boolean {
  return /(?<![\w-])(any-)?(hover|pointer)(?![\w-])/i.test(text);
}

const MEDIA_TYPE = /^(not\s+)?(only\s+)?(all|print|screen|speech|tv|projection|handheld|braille|embossed|aural|tty)\b/i;

/**
 * Rewrites a media query list as if the page were printed: queries for print
 * (or all media) match, queries for the screen don't. `not` is kept in its
 * meaning ("not screen" matches when printing). Queries without a media type
 * are left as they are.
 */
export function printMedia(text: string): string {
  return splitQueries(text)
    .map((query) => {
      const match = MEDIA_TYPE.exec(query);
      if (!match) return query;
      const negated = Boolean(match[1]);
      const type = match[3]!.toLowerCase();
      const rest = query.slice(match[0].length);
      const matchesPrint = type === 'all' || type === 'print';
      if (negated) return matchesPrint ? `not all${rest}` : 'all';
      return matchesPrint ? `all${rest}` : 'not all';
    })
    .join(', ');
}

export function mentionsMediaType(text: string): boolean {
  return /\b(print|screen)\b/i.test(text);
}

/** The minimum text spacing WCAG 2.2 (1.4.12) says content must survive, as a style sheet. */
export const TEXT_SPACING_CSS =
  '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}p{margin-bottom:2em !important}';

/** A vector image (an SVG file or data URL): it is sharp at any size, so its pixel size means nothing. */
export function isVectorImage(src: string): boolean {
  return /\.svgz?(?:[?#]|$)/i.test(src) || /^data:image\/svg\+xml[;,]/i.test(src);
}

/**
 * How an image's file size compares to the size it is shown at: below 1 the
 * picture is stretched (blurry), above 3 it is much larger than needed.
 */
export function imageDensity(natural: number, shown: number): { density: number; tone: 'low' | 'ok' | 'high' } {
  const density = shown > 0 ? natural / shown : 0;
  return { density, tone: density < 1 ? 'low' : density > 3 ? 'high' : 'ok' };
}

/**
 * Keyboard (Tab) order: elements with a positive `tabIndex` first, from the
 * lowest, then the others in document order. `items` are in document order.
 */
export function tabOrder<T extends { tabIndex: number }>(items: T[]): T[] {
  const positive = items.filter((item) => item.tabIndex > 0);
  const natural = items.filter((item) => item.tabIndex === 0);
  return [
    ...positive
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.tabIndex - b.item.tabIndex || a.index - b.index)
      .map(({ item }) => item),
    ...natural,
  ];
}

const ACCENTED: Record<string, string> = {
  a: 'å', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
}; // prettier-ignore

/** How much longer pseudo-translated text gets: translations often run 30–40% longer than English. */
export const PSEUDO_EXPANSION = 0.4;

/**
 * Pseudo-translation, to find layouts that break with longer or accented text:
 * "Sign in" → "[Šîîĝñ îñ]". Letters get accents (checks fonts and line
 * height), vowels are doubled until the text is about 40% longer (checks that
 * it can grow and wrap), and brackets mark both ends (a missing "]" means the
 * text was cut off). Surrounding whitespace is kept; text without letters is
 * returned as it is.
 */
export function pseudoLocalize(text: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const [, lead, core, trail] = match as unknown as [string, string, string, string];
  if (!/\p{L}/u.test(core)) return text;
  // Brackets count toward the growth.
  let extra = Math.max(1, Math.ceil(core.length * PSEUDO_EXPANSION) - 2);
  let result = '';
  for (const char of core) {
    const accented = ACCENTED[char] ?? char;
    result += accented;
    if (extra > 0 && /[aeiouy]/i.test(char)) {
      result += accented;
      extra--;
    }
  }
  // Short words without enough vowels.
  if (extra > 0) result += '·'.repeat(extra);
  return `${lead}[${result}]${trail}`;
}

/** CSS shorthand for four sides: ["0px","8px","0px","8px"] → "0 8px". */
export function compressBox(sides: [string, string, string, string]): string {
  const [top, right, bottom, left] = sides.map((side) => (side === '0px' ? '0' : side)) as [
    string,
    string,
    string,
    string,
  ];
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && right === left) return `${top} ${right}`;
  if (right === left) return `${top} ${right} ${bottom}`;
  return `${top} ${right} ${bottom} ${left}`;
}

/**
 * A selector that finds this element again in another preview of the same
 * page: the nearest unique id, then tag names with their position among
 * siblings of the same type (stable across widths, unlike class lists that
 * frameworks change at breakpoints).
 */
export function cssPath(element: Element): string {
  const doc = element.ownerDocument;
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== doc.documentElement) {
    if (node.id) {
      const id = `#${CSS.escape(node.id)}`;
      if (doc.querySelectorAll(id).length === 1) {
        parts.unshift(id);
        return parts.join(' > ');
      }
    }
    if (node === doc.body) {
      parts.unshift('body');
      break;
    }
    let index = 1;
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.localName === node.localName) index++;
    }
    parts.unshift(`${CSS.escape(node.localName)}:nth-of-type(${index})`);
    node = node.parentElement;
  }
  if (parts.length === 0) return ':root';
  // Outside <body> (e.g. added to <html> directly): anchored at the root.
  if (parts[0] !== 'body') parts.unshift(':root');
  return parts.join(' > ');
}

/** A short, readable description, e.g. "div.hero > img" (at most three levels). */
export function describeElement(element: Element): string {
  const doc = element.ownerDocument;
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== doc.body && node !== doc.documentElement && parts.length < 3) {
    let part = node.localName;
    if (node.id) part += `#${node.id}`;
    else {
      const classes = [...node.classList].slice(0, 2);
      if (classes.length) part += `.${classes.join('.')}`;
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ') || element.localName;
}

/* ---------- CSS colours as getComputedStyle writes them ---------- */

type Channels = Rgb;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Linear light to sRGB (0–1). */
const encode = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(Math.abs(value), 1 / 2.4) * Math.sign(value) - 0.055;
const decode = (value: number) =>
  Math.abs(value) <= 0.04045 ? value / 12.92 : Math.sign(value) * Math.pow((Math.abs(value) + 0.055) / 1.055, 2.4);
const multiply = (m: number[][], v: [number, number, number]): [number, number, number] =>
  m.map((row) => row[0]! * v[0] + row[1]! * v[1] + row[2]! * v[2]) as [number, number, number];

/** CIE XYZ (D65) to linear sRGB, and the matrices that lead there (CSS Color 4). */
const XYZ_TO_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];

const fromLinear = ([r, g, b]: [number, number, number], a: number): Channels => ({
  r: Math.round(clamp01(encode(r)) * 255),
  g: Math.round(clamp01(encode(g)) * 255),
  b: Math.round(clamp01(encode(b)) * 255),
  a: Math.round(clamp01(a) * 1000) / 1000,
});

function oklabToLinear(l: number, a: number, b: number): [number, number, number] {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const [L, M, S] = [l_ ** 3, m_ ** 3, s_ ** 3];
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

function labToLinear(l: number, a: number, b: number): [number, number, number] {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const y = l > kappa * epsilon ? fy ** 3 : l / kappa;
  const z = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;
  // D50 white point, then to D65.
  const xyz = multiply(D50_TO_D65, [x * 0.9642956764295677, y, z * 0.8251046025104602]);
  return multiply(XYZ_TO_SRGB, xyz);
}

/** "264.6", "0.25turn", "1.2rad" → degrees. */
function hue(text: string): number {
  const value = Number.parseFloat(text);
  if (/turn$/i.test(text)) return value * 360;
  if (/grad$/i.test(text)) return value * 0.9;
  if (/rad$/i.test(text)) return (value * 180) / Math.PI;
  return value;
}

/** A component that may be a percentage of `full` (or `none`, read as 0). */
const amount = (text: string, full: number) =>
  text === 'none' ? 0 : text.endsWith('%') ? (Number.parseFloat(text) / 100) * full : Number.parseFloat(text);

/**
 * Reads a colour as Chrome's getComputedStyle writes it — `rgb()`/`rgba()`,
 * `transparent`, and the newer spaces sites now use (`oklch()` in Tailwind 4,
 * `oklab()`, `lab()`, `lch()`, `color(srgb …)`, `color(display-p3 …)`) —
 * as sRGB (gamut-clipped). Null for anything else: the colour is unknown.
 */
export function parseCssColor(text: string): Channels | null {
  const value = text.trim().toLowerCase();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const rgb = parseColor(value);
  if (rgb) return rgb;
  const match = /^(oklch|oklab|lab|lch|color)\(\s*([^)]*)\)$/.exec(value);
  if (!match) return null;
  const [body, alphaText] = match[2]!.split('/').map((part) => part.trim());
  const parts = body!.split(/\s+/).filter(Boolean);
  const alpha = alphaText === undefined ? 1 : amount(alphaText, 1);
  const numbers = (from: number, full: number[]) =>
    parts.slice(from, from + 3).map((part, index) => amount(part, full[index]!));
  if (!Number.isFinite(alpha)) return null;
  let linear: [number, number, number] | null = null;
  switch (match[1]) {
    case 'oklab': {
      const [l, a, b] = numbers(0, [1, 0.4, 0.4]);
      if (parts.length === 3) linear = oklabToLinear(l!, a!, b!);
      break;
    }
    case 'oklch': {
      const [l, c] = numbers(0, [1, 0.4]);
      const h = parts[2] === 'none' ? 0 : hue(parts[2] ?? '0');
      if (parts.length === 3)
        linear = oklabToLinear(l!, c! * Math.cos((h * Math.PI) / 180), c! * Math.sin((h * Math.PI) / 180));
      break;
    }
    case 'lab': {
      const [l, a, b] = numbers(0, [100, 125, 125]);
      if (parts.length === 3) linear = labToLinear(l!, a!, b!);
      break;
    }
    case 'lch': {
      const [l, c] = numbers(0, [100, 150]);
      const h = parts[2] === 'none' ? 0 : hue(parts[2] ?? '0');
      if (parts.length === 3)
        linear = labToLinear(l!, c! * Math.cos((h * Math.PI) / 180), c! * Math.sin((h * Math.PI) / 180));
      break;
    }
    case 'color': {
      const [space, ...channels] = parts;
      if (channels.length !== 3) break;
      const [r, g, b] = channels.map((part) => amount(part, 1)) as [number, number, number];
      if (space === 'srgb') linear = [decode(r), decode(g), decode(b)];
      else if (space === 'srgb-linear') linear = [r, g, b];
      else if (space === 'display-p3')
        linear = multiply(XYZ_TO_SRGB, multiply(P3_TO_XYZ, [decode(r), decode(g), decode(b)]));
      break;
    }
  }
  if (!linear || linear.some((channel) => !Number.isFinite(channel))) return null;
  return fromLinear(linear, alpha);
}

/** A layout shift as reported by the Layout Instability API (only what the score needs). */
export type ShiftEntry = { startTime: number; value: number };

/**
 * Cumulative layout shift as Core Web Vitals define it: shifts are grouped in
 * session windows (each shift less than 1 s after the previous one, a window at
 * most 5 s long) and the score is the largest window's total. Returns that
 * total and the indexes of the shifts in that window. Entries are in time order.
 */
export function cumulativeLayoutShift(entries: ShiftEntry[]): { value: number; window: number[] } {
  let best = { value: 0, window: [] as number[] };
  let current = { value: 0, window: [] as number[] };
  entries.forEach((entry, index) => {
    const first = entries[current.window[0] ?? -1];
    const last = entries[current.window[current.window.length - 1] ?? -1];
    if (first && last && entry.startTime - last.startTime < 1000 && entry.startTime - first.startTime < 5000) {
      current = { value: current.value + entry.value, window: [...current.window, index] };
    } else {
      current = { value: entry.value, window: [index] };
    }
    if (current.value > best.value) best = current;
  });
  return best;
}

/** "0.24", "0.105": a layout shift score with up to three decimals. */
export function formatShift(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** WCAG's large text: at least 24px (18pt), or 18.66px (14pt) when bold. */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
}

/**
 * The track sizes of a grid container's computed `grid-template-columns` or
 * `-rows` ("200px [main] 186.5px 200px" → [200, 186.5, 200]); line names are
 * skipped. Null for anything else (`none`, `subgrid`, unresolved values).
 */
export function gridTracks(template: string): number[] | null {
  const tracks: number[] = [];
  const tokens = template
    .replace(/\[[^\]]*\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const token of tokens) {
    const match = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)px$/i.exec(token);
    if (!match) return null;
    tracks.push(Number(match[1]));
  }
  return tracks.length ? tracks : null;
}

/**
 * Where a grid's tracks start and how much extra space goes between them, for
 * `justify-content` (columns) or `align-content` (rows) with `free` pixels left
 * over: [offset of the first track from the start edge, extra gap]. `rtl` turns
 * the physical `left` and `right` into end and start.
 */
export function distributeTracks(alignment: string, free: number, count: number, rtl = false): [number, number] {
  if (free <= 0 || count === 0) return [0, 0];
  const value = alignment.replace(/\b(safe|unsafe)\s+/g, '').trim();
  if (value === 'center') return [free / 2, 0];
  if (value === 'end' || value === 'flex-end' || (value === 'right' && !rtl) || (value === 'left' && rtl))
    return [free, 0];
  if (value === 'space-between') return count > 1 ? [0, free / (count - 1)] : [0, 0];
  if (value === 'space-around') return [free / count / 2, free / count];
  if (value === 'space-evenly') return [free / (count + 1), free / (count + 1)];
  // normal, start, stretch (tracks then fill the space already), left in left-to-right…
  return [0, 0];
}

/** The first family of a font stack: `"Inter Var", system-ui` → `Inter Var`. */
export function firstFontFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? '';
  return first.replace(/^(['"])(.*)\1$/, '$2');
}

type Edges = { left: number; top: number; right: number; bottom: number };

/**
 * How many pixels of a line of text a box cuts off, sideways (`x`) and
 * vertically (`y`) — only when the line is partly visible. Null when it is
 * fully inside the box, or fully outside it (hidden on purpose, such as the
 * other slides of a carousel).
 */
export function cutOff(line: Edges, box: Edges): { x: number; y: number } | null {
  const width = line.right - line.left;
  const height = line.bottom - line.top;
  if (width <= 0 || height <= 0) return null;
  const x = Math.max(0, line.right - box.right) + Math.max(0, box.left - line.left);
  const y = Math.max(0, line.bottom - box.bottom) + Math.max(0, box.top - line.top);
  if (x <= 0 && y <= 0) return null;
  if (x >= width || y >= height) return null;
  return { x, y };
}

/* ---------- Long lines of text ---------- */

/** Blocks with less text than this aren't measured (a short paragraph can't have many long lines). */
export const LONG_LINE_MIN_TEXT = 160;
/** Lines a block needs to be measured (the last one is usually short). */
export const LONG_LINE_MIN_LINES = 3;
/** Characters a line may hold before it is reported, and for Chinese, Japanese or Korean text. */
export const MAX_LINE_CHARS = 100;
export const MAX_LINE_CHARS_CJK = 50;

/** A piece of a line of text on screen (a client rect of a text node). */
export type LineRect = { top: number; width: number; height: number };

/**
 * The number of lines of text, from the client rects of a block's text nodes in
 * document order: a rect starts a new line when its top is more than a few
 * pixels (2, up to a quarter of its height but at most 6) from the top of the
 * line's first rect — so a link, `<code>` or a superscript on the line doesn't
 * count as a line of its own. In document order, the columns of a multi-column
 * layout don't merge. Empty rects are left out.
 */
export function countLines(rects: readonly LineRect[]): number {
  let lines = 0;
  let lineTop = Number.NaN;
  for (const rect of rects) {
    if (!(rect.width > 0 && rect.height > 0)) continue;
    const tolerance = Math.min(6, Math.max(2, rect.height / 4));
    if (lines > 0 && Math.abs(rect.top - lineTop) <= tolerance) continue;
    lines++;
    lineTop = rect.top;
  }
  return lines;
}

/** About how many characters a line holds: the last line is usually short, so it counts as half. */
export const charsPerLine = (length: number, lines: number) => (lines > 0.5 ? length / (lines - 0.5) : 0);

const LETTER = /\p{L}/gu;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

/** The share of a text's letters that are Chinese, Japanese or Korean (0 when it has no letters). */
export function cjkShare(text: string): number {
  const letters = text.match(LETTER)?.length ?? 0;
  return letters ? (text.match(CJK)?.length ?? 0) / letters : 0;
}

/** Characters a line of this text may hold: fewer for Chinese, Japanese or Korean (each character is wider). */
export const lineCharLimit = (text: string) => (cjkShare(text) >= 0.5 ? MAX_LINE_CHARS_CJK : MAX_LINE_CHARS);

/**
 * About how many characters a line of this block holds, when that is too many
 * to read comfortably: its text (whitespace collapsed) has at least 160
 * characters on 3 lines or more, and more than 100 characters a line (50 for
 * Chinese, Japanese or Korean). Null otherwise.
 */
export function longLineLength(text: string, rects: readonly LineRect[]): number | null {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  const length = Array.from(collapsed).length;
  if (length < LONG_LINE_MIN_TEXT) return null;
  const lines = countLines(rects);
  if (lines < LONG_LINE_MIN_LINES) return null;
  const chars = charsPerLine(length, lines);
  return chars > lineCharLimit(collapsed) ? chars : null;
}

/**
 * True when a computed `transform` (or `rotate`) turns or skews text, so its
 * lines no longer stack from top to bottom. Moving and scaling don't; anything
 * that can't be read counts as turning.
 */
export function turnsText(transform: string, rotate = 'none'): boolean {
  if (rotate && rotate !== 'none') return true;
  const value = transform.trim();
  if (!value || value === 'none') return false;
  const match = /^matrix(3d)?\(([^)]*)\)$/.exec(value);
  if (!match) return true;
  const values = match[2]!.split(',').map(Number);
  if (values.length !== (match[1] ? 16 : 6) || values.some((number) => !Number.isFinite(number))) return true;
  // Everything but the scale and the move: 2D b and c; in 3D, all but m11, m22, m33, m41–m44.
  const others = match[1] ? [1, 2, 3, 4, 6, 7, 8, 9, 11] : [1, 2];
  return others.some((index) => Math.abs(values[index]!) > 1e-6);
}

/**
 * Runs `task` after a delay. A new request never postpones a run that is due
 * sooner (so pages that change all the time still get it); if it asks for a
 * later time, the task runs once more then.
 */
export function scheduler(task: () => void) {
  let timer = 0;
  let due = 0;
  let again = 0;
  const schedule = (delay: number) => {
    const at = performance.now() + delay;
    if (timer && at >= due) {
      again = Math.max(again, at);
      return;
    }
    // Sooner than the pending run: run then, and still at the later time.
    if (timer) again = Math.max(again, due);
    window.clearTimeout(timer);
    due = at;
    timer = window.setTimeout(run, delay);
  };
  const run = () => {
    timer = 0;
    task();
    if (again) {
      const wait = Math.max(0, again - performance.now());
      again = 0;
      schedule(wait);
    }
  };
  return schedule;
}

const MAX_META_TAGS = 80;
const MAX_META_VALUE = 400;
const MAX_HEADINGS = 80;
const MAX_HEADING_TEXT = 120;
/** Meta tags whose content is an address (made absolute). */
const ADDRESS_TAGS = /(^|:)(image|image:url|image:secure_url|url|video|audio)$/;

const squash = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** An absolute http(s) address for `value`, or null. */
function absoluteAddress(value: string, base: string): string | null {
  try {
    const url = new URL(value.trim(), base);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * What the page tells search engines and link previews (the audit's Meta tab):
 * its title, language, `<meta>` tags by name or property, canonical address,
 * icons and headings. `isHidden` says whether a heading is shown at this size.
 */
export function collectMeta(doc: Document, isHidden: (element: Element) => boolean): PageMeta {
  const base = doc.baseURI;
  const tags: MetaTag[] = [];
  for (const meta of doc.querySelectorAll('meta[name], meta[property]')) {
    if (tags.length >= MAX_META_TAGS) break;
    const key = (meta.getAttribute('property') || meta.getAttribute('name') || '').trim().toLowerCase();
    const content = meta.getAttribute('content');
    if (!key || content === null) continue;
    const value = ADDRESS_TAGS.test(key)
      ? (absoluteAddress(content, base) ?? squash(content, MAX_META_VALUE))
      : content;
    tags.push({ key, value: squash(value, MAX_META_VALUE) });
  }
  const canonicalHref = doc.querySelector('link[rel~="canonical" i]')?.getAttribute('href');
  const icons = [
    ...doc.querySelectorAll('link[rel~="icon" i], link[rel~="apple-touch-icon" i], link[rel~="mask-icon" i]'),
  ]
    .slice(0, 12)
    .flatMap((link) => {
      const href = absoluteAddress(link.getAttribute('href') ?? '', base);
      return href
        ? [
            {
              rel: (link.getAttribute('rel') ?? '').toLowerCase().trim(),
              href,
              sizes: link.getAttribute('sizes') ?? '',
            },
          ]
        : [];
    });
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].slice(0, MAX_HEADINGS).map((heading) => ({
    level: Number(heading.tagName.slice(1)),
    text: squash(heading.textContent ?? '', MAX_HEADING_TEXT),
    hidden: isHidden(heading),
  }));
  return {
    title: squash(doc.title, MAX_META_VALUE),
    lang: doc.documentElement.getAttribute('lang')?.trim() ?? '',
    tags,
    canonical: canonicalHref ? absoluteAddress(canonicalHref, base) : null,
    icons,
    alternates: doc.querySelectorAll('link[rel~="alternate" i][hreflang]').length,
    headings,
  };
}

/**
 * An image file's format from its address: the extension of its name (`jpeg`
 * read as `jpg`), or the type of a data URL; '' when it can't be told.
 */
export function imageFormat(src: string): string {
  const data = /^data:image\/([a-z0-9.+-]+)[;,]/i.exec(src);
  if (data) return normaliseFormat(data[1]!);
  try {
    const name = new URL(src).pathname.split('/').pop() ?? '';
    const extension = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1];
    return extension ? normaliseFormat(extension) : '';
  } catch {
    return '';
  }
}

const normaliseFormat = (format: string) => {
  const lower = format.toLowerCase();
  return lower === 'jpeg' || lower === 'pjpeg' ? 'jpg' : lower === 'svg+xml' ? 'svg' : lower;
};

/* ---------- v0.13: the Elements panel ---------- */

/** Splits at top-level commas (not inside parentheses, brackets or strings). */
export function splitTopLevel(text: string, separator = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quote) {
      if (char === '\\') {
        current += char + (text[index + 1] ?? '');
        index++;
        continue;
      }
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    else if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export type Specificity = [number, number, number];

const LEGACY_PSEUDO_ELEMENTS = /^(before|after|first-line|first-letter)$/i;

/**
 * The specificity of one complex selector, as [ids, classes, types]:
 * `:where()` counts nothing, `:is()`, `:not()` and `:has()` their most
 * specific argument, pseudo-elements count as types, `*` and combinators nothing.
 */
export function selectorSpecificity(selector: string): Specificity {
  const result: Specificity = [0, 0, 0];
  const text = selector.trim();
  let index = 0;
  const add = (other: Specificity) => {
    result[0] += other[0];
    result[1] += other[1];
    result[2] += other[2];
  };
  const readIdent = () => {
    const match = /^(?:\\.|[\w-]|[\u0080-\uffff])+/.exec(text.slice(index));
    index += match ? match[0].length : 0;
    return match?.[0] ?? '';
  };
  /** The text inside parentheses starting at `index` (on the '('). */
  const readArgument = () => {
    let depth = 0;
    const start = index;
    for (; index < text.length; index++) {
      if (text[index] === '(') depth++;
      else if (text[index] === ')' && --depth === 0) {
        index++;
        return text.slice(start + 1, index - 1);
      }
    }
    return text.slice(start + 1);
  };
  while (index < text.length) {
    const char = text[index]!;
    if (char === '#') {
      index++;
      readIdent();
      result[0]++;
    } else if (char === '.') {
      index++;
      readIdent();
      result[1]++;
    } else if (char === '[') {
      const end = text.indexOf(']', index);
      index = end < 0 ? text.length : end + 1;
      result[1]++;
    } else if (char === ':') {
      const element = text[index + 1] === ':';
      index += element ? 2 : 1;
      const name = readIdent().toLowerCase();
      const argument = text[index] === '(' ? readArgument() : null;
      if (element || LEGACY_PSEUDO_ELEMENTS.test(name)) result[2]++;
      else if (name === 'where') continue;
      else if ((name === 'is' || name === 'not' || name === 'has' || name === 'matches') && argument !== null)
        add(maxSpecificity(splitTopLevel(argument).map(selectorSpecificity)));
      else if ((name === 'nth-child' || name === 'nth-last-child') && argument !== null && /\bof\b/i.test(argument)) {
        result[1]++;
        add(maxSpecificity(splitTopLevel(argument.replace(/^[\s\S]*?\bof\b/i, '')).map(selectorSpecificity)));
      } else result[1]++;
    } else if (/[\w-]|[\u0080-\uffff]|\\/.test(char)) {
      readIdent();
      result[2]++;
    } else index++;
  }
  return result;
}

export const compareSpecificity = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

const maxSpecificity = (list: Specificity[]): Specificity =>
  list.reduce<Specificity>((best, item) => (compareSpecificity(item, best) > 0 ? item : best), [0, 0, 0]);

/** A declaration block's text (`cssText`) as declarations, shorthands kept. */
export function splitDeclarations(cssText: string): { name: string; value: string; important: boolean }[] {
  return splitTopLevel(cssText, ';')
    .map((part) => {
      const colon = part.indexOf(':');
      if (colon <= 0) return null;
      const name = part.slice(0, colon).trim();
      let value = part.slice(colon + 1).trim();
      const important = /!\s*important\s*$/i.test(value);
      if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
      return name ? { name, value, important } : null;
    })
    .filter((item): item is { name: string; value: string; important: boolean } => item !== null);
}

export type CascadeGroup = {
  inline: boolean;
  specificity: Specificity;
  /** Later in the document wins at equal specificity. */
  order: number;
  /** Each declaration with the longhand properties it sets. */
  declarations: { important: boolean; longhands: string[] }[];
};

/**
 * Which declarations lose to others for every property they set:
 * `!important` first (inline before rules), then inline style, then the
 * higher specificity, then the later rule, then the later declaration.
 */
export function overriddenDeclarations(groups: readonly CascadeGroup[]): boolean[][] {
  type Contender = { group: number; declaration: number };
  const rank = (contender: Contender) => {
    const group = groups[contender.group]!;
    const declaration = group.declarations[contender.declaration]!;
    return [
      declaration.important ? 1 : 0,
      group.inline ? 1 : 0,
      ...group.specificity,
      group.order,
      contender.declaration,
    ];
  };
  const better = (a: Contender, b: Contender) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let index = 0; index < ra.length; index++) if (ra[index] !== rb[index]) return ra[index]! > rb[index]!;
    return false;
  };
  const winners = new Map<string, Contender>();
  groups.forEach((group, groupIndex) =>
    group.declarations.forEach((declaration, declarationIndex) => {
      const contender = { group: groupIndex, declaration: declarationIndex };
      for (const property of declaration.longhands) {
        const current = winners.get(property);
        if (!current || better(contender, current)) winners.set(property, contender);
      }
    }),
  );
  return groups.map((group, groupIndex) =>
    group.declarations.map(
      (declaration, declarationIndex) =>
        declaration.longhands.length > 0 &&
        declaration.longhands.every((property) => {
          const winner = winners.get(property);
          return !winner || winner.group !== groupIndex || winner.declaration !== declarationIndex;
        }),
    ),
  );
}

/** Elements HTML no longer has (shown in the summary when a page still uses them). */
export const OBSOLETE_TAGS = [
  'acronym',
  'applet',
  'basefont',
  'big',
  'blink',
  'center',
  'dir',
  'font',
  'frame',
  'frameset',
  'isindex',
  'marquee',
  'nobr',
  'noframes',
  'plaintext',
  'strike',
  'tt',
  'xmp',
] as const;

/* ---------- Fields that make iPhones zoom in ---------- */

/** Safari on iPhone zooms the page in when a field whose text is smaller than this gets focus. */
export const MIN_FIELD_FONT_PX = 16;
/** The checked previews' widths, at most (phone sizes). */
export const INPUT_ZOOM_MAX_WIDTH = 600;
/** Input types that take no typed text: Safari doesn't zoom in on them. */
export const NO_ZOOM_INPUT_TYPES: readonly string[] = [
  'hidden',
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'submit',
  'button',
  'reset',
  'image',
];

/**
 * True when Safari on iPhone zooms in as a field with this computed font size
 * (px) gets focus: under 16px. 0px text is a hiding technique, not small text.
 */
export function zoomsOnFocus(fontSizePx: number): boolean {
  if (!Number.isFinite(fontSizePx) || fontSizePx < 1) return false;
  // 1.6rem on a 10px root can compute to 15.999…px.
  return Math.round(fontSizePx * 100) / 100 < MIN_FIELD_FONT_PX;
}

/** A field's font size as reported, e.g. "14px", "15.9px": rounded down to tenths, so it never reads 16px. */
export const fieldFontText = (fontSizePx: number) => `${Math.floor(Math.round(fontSizePx * 100) / 10) / 10}px`;

/** True for an `<input type>` (as the element reports it) that takes typed text. */
export const takesTypedText = (type: string) => !NO_ZOOM_INPUT_TYPES.includes(type.trim().toLowerCase());

/**
 * True when a viewport tag's content keeps Safari from zooming in on focus:
 * `maximum-scale` of 1 or less (Safari on iPhone still lets people pinch-zoom).
 */
export function blocksFocusZoom(viewportContent: string): boolean {
  const match = /(?:^|[\s,;])maximum-scale\s*=\s*([\d.]+)/i.exec(viewportContent);
  const scale = match ? Number.parseFloat(match[1]!) : Number.NaN;
  return Number.isFinite(scale) && scale <= 1;
}

/* ---------- Order on screen and in the HTML ---------- */

/** What makes a flex or grid container show its items in another order than the HTML. */
export type OrderCause = 'order' | 'row-reverse' | 'column-reverse' | 'wrap-reverse' | 'grid placement' | 'dense';

/** The computed styles of a container that matter to the order of its items. */
export type OrderContainerStyle = { display: string; flexDirection: string; flexWrap: string; gridAutoFlow: string };
/** The computed styles of an item that matter to its place. */
export type OrderItemStyle = { order: string; gridRowStart: string; gridColumnStart: string };

/** A computed `display` that makes a flex container ("flex", "inline-flex", "block flex"…). */
export const isFlexDisplay = (display: string) => /(^|[\s-])flex$/.test(display.trim());
/** A computed `display` that makes a grid container ("grid", "inline-grid"…). */
export const isGridDisplay = (display: string) => /(^|[\s-])grid$/.test(display.trim());

/** A grid line given by number or name (not `auto`, and not only a span). */
const explicitLine = (value: string) => {
  const line = value.trim();
  return line !== '' && line !== 'auto' && !/^span\b/.test(line);
};

/**
 * Why a flex or grid container may show its items out of HTML order: an item
 * with `order` other than 0, a reversed flex direction or wrap, grid items
 * placed on given lines (`grid-row`, `grid-column`, `grid-area`), or `dense`
 * packing. Empty for other containers, or when nothing reorders.
 */
export function reorderCauses(container: OrderContainerStyle, items: readonly OrderItemStyle[]): OrderCause[] {
  const flex = isFlexDisplay(container.display);
  const grid = !flex && isGridDisplay(container.display);
  if (!flex && !grid) return [];
  const causes: OrderCause[] = [];
  if (
    items.some((item) => {
      const order = Number(item.order || 0);
      return Number.isFinite(order) && order !== 0;
    })
  )
    causes.push('order');
  if (flex) {
    const direction = container.flexDirection.trim();
    if (direction === 'row-reverse' || direction === 'column-reverse') causes.push(direction);
    if (container.flexWrap.trim() === 'wrap-reverse') causes.push('wrap-reverse');
  } else {
    if (items.some((item) => explicitLine(item.gridRowStart) || explicitLine(item.gridColumnStart)))
      causes.push('grid placement');
    if (/\bdense\b/.test(container.gridAutoFlow)) causes.push('dense');
  }
  return causes;
}

/** A box on screen (viewport pixels). */
export type OrderRect = { left: number; top: number; right: number; bottom: number };

/**
 * The order in which the eye reads boxes given in HTML order: the indices of
 * `rects`, as seen. By rows (top to bottom), each left to right — right to left
 * when `rtl`; with `columns` (a column flex container), by columns (left to
 * right, or right to left when `rtl`), each top to bottom. Boxes share a row
 * while they share a horizontal band: each overlaps the band the row's boxes
 * have in common by more than half its height (or the band's) — so a box that
 * spans several rows stays in the first, and boxes moved a few pixels by
 * negative margins don't join the next. Positions are rounded to whole pixels;
 * boxes in the same place keep their HTML order.
 */
export function visualOrder(rects: readonly OrderRect[], options: { rtl?: boolean; columns?: boolean } = {}): number[] {
  const { rtl = false, columns = false } = options;
  // Along `from`…`to` boxes are grouped into lines (rows or columns), read in
  // ascending order; `along` orders the boxes in a line.
  const items = rects.map((rect, index) => {
    const left = Math.round(rect.left);
    const right = Math.round(rect.right);
    const top = Math.round(rect.top);
    const bottom = Math.round(rect.bottom);
    const x = rtl ? -right : left;
    return columns
      ? { index, from: x, to: rtl ? -left : right, along: top }
      : { index, from: top, to: bottom, along: x };
  });
  type Item = (typeof items)[number];
  const sorted = [...items].sort((a, b) => a.from - b.from || a.along - b.along || a.index - b.index);
  const lines: Item[][] = [];
  let line: Item[] = [];
  let bandFrom = 0;
  let bandTo = 0;
  for (const item of sorted) {
    if (line.length) {
      const overlap = Math.min(bandTo, item.to) - Math.max(bandFrom, item.from);
      if (overlap > 0 && overlap > Math.min(item.to - item.from, bandTo - bandFrom) / 2) {
        line.push(item);
        bandFrom = Math.max(bandFrom, item.from);
        bandTo = Math.min(bandTo, item.to);
        continue;
      }
      lines.push(line);
    }
    line = [item];
    bandFrom = item.from;
    bandTo = item.to;
  }
  if (line.length) lines.push(line);
  return lines.flatMap((boxes) =>
    boxes.sort((a, b) => a.along - b.along || a.from - b.from || a.index - b.index).map((item) => item.index),
  );
}

/** True when a sequence of HTML positions isn't in ascending order: something was moved. */
export const isReordered = (order: readonly number[]) =>
  order.some((value, index) => index > 0 && value < order[index - 1]!);

/** The HTML positions (from 1) in the order seen, e.g. "2, 1, 3"; at most `max`, then "…". */
export function formatOrder(order: readonly number[], max = 8): string {
  const shown = order.slice(0, max).map((value) => String(value + 1));
  return order.length > max ? `${shown.join(', ')}, …` : shown.join(', ');
}
