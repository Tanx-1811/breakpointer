import { FLIP, NUMBER, splitQueries, toPx, UNIT, type Comparison } from '../agent/page-utils';
import type { MediaQueryEntry, MediaQueryReport } from '../agent/protocol';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';
import type { AuditColumn } from './audit';

/** Whole CSS-pixel widths where a query can apply; null: no bound on that side. */
export type WidthRange = { min: number | null; max: number | null };

/**
 * Two queries that meet badly at a breakpoint: a gap (neither applies at
 * `from`…`to`) or an overlap (both apply there). `below` is the query for
 * narrower windows (a max-width only), `above` the one for wider windows.
 */
export type BreakpointProblem = { type: 'gap' | 'overlap'; from: number; to: number; below: string; above: string };

/** A max-width and a min-width this close (CSS px) are taken as meant to meet. */
const NEAR_PX = 4;

// A length may leave out its unit only when it is 0.
const LENGTH = `${NUMBER}${UNIT}?`;
const OP = '(<=|<|>=|>)';
const LEGACY_WIDTH = new RegExp(`^(min|max)-width\\s*:\\s*${LENGTH}$`);
const EXACT_WIDTH = new RegExp(`^width\\s*:\\s*${LENGTH}$`);
// `width >= 768px`, `768px <= width`, `640px <= width < 1024px`.
const RANGE_WIDTH = new RegExp(`^(?:${LENGTH}\\s*${OP}\\s*)?width(?:\\s*${OP}\\s*${LENGTH})?$`);
// The window's width (not `device-width`, `min-device-width` or a height).
const MENTIONS_WIDTH = /(^|[^-\w])(min-|max-)?width\b/;

/** A length in CSS pixels, or null when it has no unit and isn't 0. */
function length(value: string, unit: string | undefined): number | null {
  if (unit) return toPx(value, unit);
  return Number(value) === 0 ? 0 : null;
}

/** The whole widths where `width <op> value` holds, as a bound. */
function bound(op: Comparison, value: number): WidthRange {
  switch (op) {
    case '>=':
      return { min: Math.ceil(value), max: null };
    case '>':
      return { min: Math.floor(value) + 1, max: null };
    case '<=':
      return { min: null, max: Math.floor(value) };
    case '<':
      return { min: null, max: Math.ceil(value) - 1 };
  }
}

/** The bounds one condition (the text inside its parentheses) puts on the width; [] when it isn't about width; null when unreadable. */
function conditionBounds(condition: string): WidthRange[] | null {
  const text = condition.replace(/\s+/g, ' ').trim();
  const legacy = LEGACY_WIDTH.exec(text);
  if (legacy) {
    const value = length(legacy[2]!, legacy[3]);
    return value === null ? null : [bound(legacy[1] === 'min' ? '>=' : '<=', value)];
  }
  const exact = EXACT_WIDTH.exec(text);
  if (exact) {
    const value = length(exact[1]!, exact[2]);
    return value === null ? null : [bound('>=', value), bound('<=', value)];
  }
  const range = RANGE_WIDTH.exec(text);
  if (range && (range[3] || range[4])) {
    const [, lowValue, lowUnit, lowOp, highOp, highValue, highUnit] = range;
    const bounds: WidthRange[] = [];
    if (lowValue && lowOp) {
      const value = length(lowValue, lowUnit);
      if (value === null) return null;
      bounds.push(bound(FLIP[lowOp as Comparison], value));
    }
    if (highValue && highOp) {
      const value = length(highValue, highUnit);
      if (value === null) return null;
      bounds.push(bound(highOp as Comparison, value));
    }
    return bounds;
  }
  // `(width)` alone holds at any width; anything else about the width (vw, calc…) can't be read.
  if (text === 'width') return [];
  return MENTIONS_WIDTH.test(text) ? null : [];
}

/** One query's width range; 'empty' when it can never apply; null when width alone doesn't say. */
function queryRange(query: string): WidthRange | 'empty' | null {
  let rest = query.trim().toLowerCase();
  if (/^not\b/.test(rest)) return null;
  const type = /^(?:only\s+)?([a-z-]+)\s*/.exec(rest);
  if (type) {
    // Previews are screens: queries for print, speech… never apply there.
    if (type[1] !== 'screen' && type[1] !== 'all') return null;
    rest = rest.slice(type[0].length);
    if (rest && !/^and\b/.test(rest)) return null;
    rest = rest.replace(/^and\s*/, '');
  }
  let min: number | null = null;
  let max: number | null = null;
  let width = false;
  while (rest) {
    if (!rest.startsWith('(')) return null;
    let depth = 0;
    let end = -1;
    for (let index = 0; index < rest.length; index++) {
      if (rest[index] === '(') depth++;
      else if (rest[index] === ')' && --depth === 0) {
        end = index;
        break;
      }
    }
    if (end < 0) return null;
    const condition = rest.slice(1, end);
    // A nested condition (`(not (hover))`, `((a) or (b))`) only counts when it leaves the width alone.
    const bounds = condition.includes('(') ? (MENTIONS_WIDTH.test(condition) ? null : []) : conditionBounds(condition);
    if (!bounds) return null;
    for (const item of bounds) {
      width = true;
      if (item.min !== null) min = min === null ? item.min : Math.max(min, item.min);
      if (item.max !== null) max = max === null ? item.max : Math.min(max, item.max);
    }
    rest = rest.slice(end + 1).trim();
    if (!rest) break;
    if (!/^and\b/.test(rest)) return null;
    rest = rest.replace(/^and\s*/, '');
    if (!rest) return null;
  }
  if (!width) return null;
  // A min-width of 0 holds at every width.
  if (min !== null && min <= 0) min = null;
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min > max) return 'empty';
  if (max !== null && max < 0) return 'empty';
  return { min, max };
}

/**
 * The whole CSS-pixel widths where a media query list can apply, from its
 * width conditions only — one range per query, e.g. "(max-width: 767.98px)" →
 * up to 767 and "(min-width: 48em)" → from 768. Other conditions (hover,
 * orientation…) are left aside; queries that never apply give no range. Null
 * when a query has no width condition, uses `not` or `or`, is for another media
 * type than screen, or can't be read.
 */
export function widthRanges(text: string): WidthRange[] | null {
  const queries = splitQueries(text);
  if (queries.length === 0) return null;
  const ranges: WidthRange[] = [];
  for (const query of queries) {
    const range = queryRange(query);
    if (range === null) return null;
    if (range !== 'empty') ranges.push(range);
  }
  return ranges;
}

/**
 * Max-width and min-width queries a few pixels apart that leave widths where
 * neither applies (a gap: `max-width: 767px` and `min-width: 769px` at 768) or
 * where both do (an overlap: `max-width: 768px` and `min-width: 768px` at 768).
 * Only queries with one width range and one bound are compared.
 */
export function breakpointProblems(texts: readonly string[]): BreakpointProblem[] {
  const below: { text: string; max: number }[] = [];
  const above: { text: string; min: number }[] = [];
  for (const text of new Set(texts)) {
    const ranges = widthRanges(text);
    if (ranges?.length !== 1) continue;
    const { min, max } = ranges[0]!;
    if (min === null && max !== null) below.push({ text, max });
    else if (max === null && min !== null) above.push({ text, min });
  }
  const problems = new Map<string, BreakpointProblem>();
  for (const low of below)
    for (const high of above) {
      const distance = high.min - low.max;
      if (Math.abs(distance) > NEAR_PX || distance === 1) continue;
      const problem: BreakpointProblem =
        distance > 1
          ? { type: 'gap', from: low.max + 1, to: high.min - 1, below: low.text, above: high.text }
          : { type: 'overlap', from: high.min, to: low.max, below: low.text, above: high.text };
      const key = `${problem.type} ${problem.from} ${problem.to}`;
      if (!problems.has(key)) problems.set(key, problem);
    }
  return [...problems.values()].sort((a, b) => a.from - b.from || a.to - b.to || a.type.localeCompare(b.type));
}

/** One of the page's queries across the previews. */
export type MediaRow = {
  text: string;
  kind: MediaQueryEntry['kind'];
  /** Style rules it holds (the most any preview found). */
  rules: number;
  /** Where it can apply by width (null: not by width alone; always null for container queries). */
  ranges: WidthRange[] | null;
  /**
   * By card id: it applies in that preview; null for a container query. No
   * entry: that preview wasn't measured.
   */
  matches: Record<string, boolean | null>;
};

/** The width a range marks: where it starts to apply, or where it stops. */
const edgeOf = (range: WidthRange) => range.min ?? (range.max === null ? 0 : range.max + 1);
/** At the same width: the query for narrower windows, then wider ones, then those with both bounds. */
const sideOf = (range: WidthRange) => (range.min === null ? 0 : range.max === null ? 1 : 2);
const LAST = Number.MAX_SAFE_INTEGER;

function compareRows(a: MediaRow, b: MediaRow): number {
  const left = a.ranges?.[0];
  const right = b.ranges?.[0];
  if (left && right)
    return (
      edgeOf(left) - edgeOf(right) ||
      sideOf(left) - sideOf(right) ||
      (left.max ?? LAST) - (right.max ?? LAST) ||
      a.text.localeCompare(b.text)
    );
  if (left) return -1;
  if (right) return 1;
  if (a.kind !== b.kind) return a.kind === 'media' ? -1 : 1;
  return b.rules - a.rules || a.text.localeCompare(b.text);
}

/**
 * The distinct queries of every preview: width queries by the breakpoint they
 * mark (the one for narrower windows first), then the others (media queries
 * before container queries, most rules first). A preview that answered without
 * a query doesn't use it, so it doesn't apply there.
 */
export function mergeMediaRows(
  rows: readonly { id: string; report: MediaQueryReport | null | undefined }[],
): MediaRow[] {
  const merged = new Map<string, MediaRow>();
  for (const row of rows)
    for (const entry of row.report?.queries ?? []) {
      const key = `${entry.kind} ${entry.text}`;
      let item = merged.get(key);
      if (!item) {
        item = {
          text: entry.text,
          kind: entry.kind,
          rules: entry.rules,
          ranges: entry.kind === 'media' ? widthRanges(entry.text) : null,
          matches: {},
        };
        merged.set(key, item);
      } else item.rules = Math.max(item.rules, entry.rules);
      item.matches[row.id] = entry.kind === 'container' ? null : entry.matches;
    }
  for (const item of merged.values())
    for (const row of rows)
      if (row.report && !(row.id in item.matches)) item.matches[row.id] = item.kind === 'container' ? null : false;
  return [...merged.values()].sort(compareRows);
}

/** The distinct widths where the page's width queries switch, sorted. */
export function mediaBreakpoints(rows: readonly MediaRow[]): number[] {
  const edges = new Set<number>();
  for (const row of rows)
    for (const range of row.ranges ?? []) {
      if (range.min !== null) edges.add(range.min);
      if (range.max !== null) edges.add(range.max + 1);
    }
  return [...edges].sort((a, b) => a - b);
}

/** Gaps and overlaps between the merged rows' media queries. */
export const mediaProblems = (rows: readonly MediaRow[]) =>
  breakpointProblems(rows.filter((row) => row.kind === 'media').map((row) => row.text));

/** The most stylesheets any preview couldn't read. */
export const unreadableSheets = (reports: readonly (MediaQueryReport | null | undefined)[]) =>
  Math.max(0, ...reports.map((report) => report?.unreadable ?? 0));

export const PROBLEM_KEYS: Record<BreakpointProblem['type'], { title: MessageKey; hint: MessageKey }> = {
  gap: { title: 'media.gap', hint: 'media.gapHint' },
  overlap: { title: 'media.overlap', hint: 'media.overlapHint' },
};

/** "768 px" or "768–770 px". */
export const problemWidths = (problem: Pick<BreakpointProblem, 'from' | 'to'>, t: Translate) =>
  problem.from === problem.to
    ? t('media.width', { width: problem.from })
    : t('media.widths', { from: problem.from, to: problem.to });

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.map(cell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

const columnTitle = (column: AuditColumn) => `${column.name} (${column.width}px)`;
const queryText = (row: Pick<MediaRow, 'kind' | 'text'>) =>
  `\`${row.kind === 'container' ? '@container ' : ''}${row.text}\``;

/**
 * Every query as a Markdown table — ✓ where it applies, – where it doesn't, —
 * for container queries and previews not measured — then the possible gaps and
 * overlaps.
 */
export function mediaMarkdown(
  page: string,
  columns: readonly (AuditColumn & { media?: MediaQueryReport | null | undefined })[],
  t: Translate,
): string {
  const rows = mergeMediaRows(columns.map((column) => ({ id: column.id, report: column.media })));
  if (rows.length === 0) return `${t('media.markdown', { page })}\n\n${t('media.empty')}\n`;
  const body = rows.map((row) => [
    queryText(row),
    String(row.rules),
    ...columns.map((column) => {
      const matches = row.matches[column.id];
      return matches === true ? '✓' : matches === false ? '–' : '—';
    }),
  ]);
  const lines = [
    t('media.markdown', { page }),
    '',
    table([t('media.colQuery'), t('media.colRules'), ...columns.map(columnTitle)], body),
  ];
  const problems = mediaProblems(rows);
  if (problems.length > 0)
    lines.push(
      '',
      `**${t('media.problems')}**`,
      '',
      ...problems.map(
        (problem) =>
          `- ${t(PROBLEM_KEYS[problem.type].title, { widths: problemWidths(problem, t) })} · ${t(PROBLEM_KEYS[problem.type].hint)}: \`${problem.below}\` · \`${problem.above}\``,
      ),
    );
  const unreadable = unreadableSheets(columns.map((column) => column.media));
  const notes = [
    rows.some((row) => row.kind === 'container') ? t('media.containerNote') : '',
    unreadable === 0 ? '' : unreadable === 1 ? t('media.unreadableOne') : t('media.unreadable', { count: unreadable }),
  ].filter(Boolean);
  if (notes.length > 0) lines.push('', ...notes);
  return `${lines.join('\n')}\n`;
}
