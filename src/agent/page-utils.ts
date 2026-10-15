/**
 * Small, dependency-free helpers used by the frame agent (and unit tested on
 * their own). They only read the page's structure and styles; nothing here
 * sends or stores page content.
 */

/** Pixels per em/rem in media queries (they use the initial font size, not the page's). */
const MEDIA_EM_PX = 16;

type Comparison = '<' | '<=' | '>' | '>=';

const UNIT = '(px|em|rem)';
const NUMBER = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
const LEGACY = new RegExp(`\\(\\s*(min|max)-width\\s*:\\s*${NUMBER}${UNIT}\\s*\\)`, 'gi');
// `width >= 768px`, `768px <= width`, `640px <= width < 1024px` (Media Queries level 4 ranges).
const RANGE = new RegExp(
  `\\(\\s*(?:${NUMBER}${UNIT}\\s*(<=|<|>=|>)\\s*)?width\\s*(?:(<=|<|>=|>)\\s*${NUMBER}${UNIT})?\\s*\\)`,
  'gi',
);

function toPx(value: string, unit: string): number {
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

const FLIP: Record<Comparison, Comparison> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };

/** Splits a media query list on its top-level commas. */
function splitQueries(text: string): string[] {
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
