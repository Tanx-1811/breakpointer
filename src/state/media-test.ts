/**
 * The CSS toolkit's media query tester: whether a media query list applies
 * to a viewport of a given size. Size features (width, height, aspect ratio,
 * orientation, in px, em or rem, with min-/max- or range syntax) are answered;
 * features that depend on the browser or the device (hover, resolution…) are
 * unknown — `null` — unless the viewport says (its page colours).
 */
export type MediaViewport = { width: number; height: number; colorScheme?: 'light' | 'dark' | null };

/** Three-valued: true, false, or unknown (null). */
export type Tri = boolean | null;

export type MediaTest = {
  matches: Tri;
  /** The query couldn't be read. */
  invalid: boolean;
  /** Features the answer depends on that the toolkit can't know. */
  unknown: string[];
};

const and = (a: Tri, b: Tri): Tri => (a === false || b === false ? false : a === null || b === null ? null : true);
const or = (a: Tri, b: Tri): Tri => (a === true || b === true ? true : a === null || b === null ? null : false);
const not = (a: Tri): Tri => (a === null ? null : !a);

/** Splits at top-level commas (not inside parentheses). */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim());
}

/** A length in px (em and rem at 16 px, as media queries read them). */
function length(text: string): number | null {
  const match = /^(-?\d*\.?\d+)(px|em|rem)?$/i.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const unit = (match[2] ?? 'px').toLowerCase();
  if (!match[2] && value !== 0) return null;
  return unit === 'px' ? value : value * 16;
}

/** `16/9`, `16 / 9` or `1.777`. */
function ratio(text: string): number | null {
  const match = /^(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]) / (match[2] ? Number(match[2]) : 1);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const SIZE_FEATURES: Record<string, (viewport: MediaViewport) => number> = {
  width: (viewport) => viewport.width,
  height: (viewport) => viewport.height,
  'aspect-ratio': (viewport) => viewport.width / viewport.height,
};

const readValue = (feature: string, text: string) => (feature === 'aspect-ratio' ? ratio(text) : length(text));

const compare = (left: number, operator: string, right: number): boolean => {
  switch (operator) {
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    default:
      return left === right;
  }
};

const flip: Record<string, string> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' };

/** One `( … )` feature test; `undefined` when it can't be read. */
function feature(inner: string, viewport: MediaViewport, unknown: Set<string>): Tri | undefined {
  const text = inner.trim().toLowerCase();
  // Range syntax: (400px <= width < 800px), (width >= 600px), (600px < width).
  const range = /^([^<>=]+?)\s*(<=|>=|<|>|=)\s*([^<>=]+?)(?:\s*(<=|>=|<|>|=)\s*([^<>=]+?))?$/.exec(text);
  if (range) {
    const [, a, op1, b, op2, c] = range;
    if (c !== undefined && op2 !== undefined) {
      const name = b!.trim();
      if (!SIZE_FEATURES[name]) return unknownFeature(name, unknown);
      const low = readValue(name, a!);
      const high = readValue(name, c);
      if (low === null || high === null) return undefined;
      const value = SIZE_FEATURES[name]!(viewport);
      return compare(low, op1!, value) && compare(value, op2, high);
    }
    const [name, op, valueText] = SIZE_FEATURES[a!.trim()] ? [a!.trim(), op1!, b!] : [b!.trim(), flip[op1!]!, a!];
    if (!SIZE_FEATURES[name]) return unknownFeature(name, unknown);
    const limit = readValue(name, valueText);
    if (limit === null) return undefined;
    return compare(SIZE_FEATURES[name]!(viewport), op, limit);
  }
  const [rawName, rawValue] = text.split(':').map((part) => part.trim()) as [string, string | undefined];
  const prefix = /^(min|max)-/.exec(rawName)?.[1];
  const name = prefix ? rawName.slice(prefix.length + 1) : rawName;
  if (SIZE_FEATURES[name]) {
    if (rawValue === undefined) return prefix ? undefined : SIZE_FEATURES[name]!(viewport) > 0;
    const limit = readValue(name, rawValue);
    if (limit === null) return undefined;
    const value = SIZE_FEATURES[name]!(viewport);
    return prefix === 'min' ? value >= limit : prefix === 'max' ? value <= limit : value === limit;
  }
  if (name === 'orientation') {
    if (rawValue !== 'portrait' && rawValue !== 'landscape') return undefined;
    return viewport.height >= viewport.width === (rawValue === 'portrait');
  }
  if (name === 'prefers-color-scheme' && viewport.colorScheme && (rawValue === 'dark' || rawValue === 'light'))
    return rawValue === viewport.colorScheme;
  return unknownFeature(rawName, unknown);
}

const KNOWN_UNKNOWN =
  /^(?:(?:min|max)-)?(?:hover|any-hover|pointer|any-pointer|resolution|color|color-gamut|color-index|monochrome|prefers-[a-z-]+|forced-colors|inverted-colors|dynamic-range|video-dynamic-range|scripting|update|overflow-block|overflow-inline|display-mode|grid|-webkit-device-pixel-ratio|device-width|device-height|device-aspect-ratio)$/;

function unknownFeature(name: string, unknown: Set<string>): Tri | undefined {
  if (!KNOWN_UNKNOWN.test(name)) return undefined;
  unknown.add(name.replace(/^(min|max)-/, ''));
  return null;
}

/** A condition: features joined by `and` / `or`, with `not` and nested parentheses. */
function condition(text: string, viewport: MediaViewport, unknown: Set<string>): Tri | undefined {
  const trimmed = text.trim();
  if (/^not\s+/i.test(trimmed)) {
    const inner = condition(trimmed.replace(/^not\s+/i, ''), viewport, unknown);
    return inner === undefined ? undefined : not(inner);
  }
  // Top-level groups and the words between them.
  const groups: string[] = [];
  const words: string[] = [];
  let depth = 0;
  let current = '';
  let between = '';
  for (const char of trimmed) {
    if (char === '(') {
      if (depth === 0) {
        words.push(between.trim().toLowerCase());
        between = '';
      }
      depth++;
      if (depth === 1) continue;
    }
    if (char === ')') {
      depth--;
      if (depth === 0) {
        groups.push(current);
        current = '';
        continue;
      }
    }
    if (depth > 0) current += char;
    else between += char;
  }
  if (depth !== 0 || between.trim() || groups.length === 0) return undefined;
  const joiners = words.slice(1);
  if (joiners.some((word) => word !== 'and' && word !== 'or') || new Set(joiners).size > 1) return undefined;
  const values: Tri[] = [];
  for (const group of groups) {
    // A nested condition, or a single feature.
    const value = /^\s*(\(|not\s)/i.test(group)
      ? condition(group, viewport, unknown)
      : feature(group, viewport, unknown);
    if (value === undefined) return undefined;
    values.push(value);
  }
  return values
    .slice(1)
    .reduce<Tri>((result, value) => (joiners[0] === 'or' ? or(result, value) : and(result, value)), values[0]!);
}

const MEDIA_TYPES = new Set([
  'all',
  'screen',
  'print',
  'speech',
  'tv',
  'projection',
  'handheld',
  'braille',
  'embossed',
  'aural',
  'tty',
]);

/** One query of a list: `[not|only] [type] [and condition]` or a bare condition. */
function query(text: string, viewport: MediaViewport, unknown: Set<string>): Tri | undefined {
  const match = /^(?:(not|only)\s+)?([a-z-]+)(?:\s+and\s+([\s\S]+))?$/i.exec(text.trim());
  if (match && MEDIA_TYPES.has(match[2]!.toLowerCase())) {
    const type = match[2]!.toLowerCase();
    let result: Tri = type === 'all' || type === 'screen';
    if (match[3] !== undefined) {
      const rest = condition(match[3], viewport, unknown);
      if (rest === undefined) return undefined;
      result = and(result, rest);
    }
    return match[1]?.toLowerCase() === 'not' ? not(result) : result;
  }
  return condition(text, viewport, unknown);
}

export function testMedia(text: string, viewport: MediaViewport): MediaTest {
  const unknown = new Set<string>();
  const trimmed = text
    .trim()
    .replace(/^@media\s+/i, '')
    .replace(/\s*\{\s*$/, '');
  if (!trimmed) return { matches: null, invalid: true, unknown: [] };
  let matches: Tri = false;
  for (const part of splitTop(trimmed, ',')) {
    const value = query(part, viewport, unknown);
    if (value === undefined) return { matches: null, invalid: true, unknown: [] };
    matches = or(matches, value);
  }
  return { matches, invalid: false, unknown: [...unknown] };
}

/** Queries worth trying, as examples. */
export const MEDIA_EXAMPLES = [
  '(min-width: 768px)',
  '(max-width: 767.98px)',
  '(640px <= width < 1024px)',
  'screen and (orientation: landscape)',
  '(min-aspect-ratio: 16/9)',
  '(min-width: 48em) and (max-height: 800px)',
  '(prefers-color-scheme: dark)',
  '(hover: hover) and (pointer: fine)',
] as const;
