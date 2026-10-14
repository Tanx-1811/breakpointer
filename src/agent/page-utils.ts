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
  return text.replace(/(prefers-color-scheme\s*:\s*)(dark|light)/gi, (_, prefix: string, scheme: string) =>
    `${prefix}${scheme.toLowerCase() === 'dark' ? 'light' : 'dark'}`,
  );
}

export function mentionsColorScheme(text: string): boolean {
  return /prefers-color-scheme/i.test(text);
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
  return parts.join(' > ') || 'html';
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
