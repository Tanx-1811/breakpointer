import type { HiddenElement, ShownState } from '../agent/protocol';
import type { Translate } from '../i18n/translate';
import type { AuditColumn } from './audit';

/*
 * The audit's Visibility tab (v0.14): elements shown in some previews and
 * hidden in others (`hidden md:block`, a burger menu only on phones, a sidebar
 * only on desktops). Every preview lists the elements it doesn't show
 * (`getHiddenElements`); the workspace asks every preview about all of them
 * (`getShownStates`) and keeps those whose state differs between previews.
 */

/** One preview's answer: the elements asked about (every preview's hidden ones) and their state there, in the same order. */
export type VisibilityReport = { items: readonly HiddenElement[]; states: readonly ShownState[] };

/** A cell of the matrix: `unknown` when that preview didn't say. */
export type CellState = ShownState | 'unknown';

/** When an element is shown, from the widths of the previews (they are the only widths known). */
export type VisibilitySummary =
  /** Hidden in the narrower previews, shown from `width` on. */
  | { kind: 'shownFrom'; width: number }
  /** Shown in the narrower previews, hidden from `width` on. */
  | { kind: 'hiddenFrom'; width: number }
  /** Shown only in the previews from `from` to `to` wide (hidden in narrower and wider ones). */
  | { kind: 'shownBetween'; from: number; to: number }
  /** Hidden only in the previews from `from` to `to` wide. */
  | { kind: 'hiddenBetween'; from: number; to: number }
  /** Anything else: it switches more often, or previews of the same width differ. */
  | { kind: 'some'; shown: number; total: number };

export type VisibilityRow = {
  selector: string;
  label: string;
  /** By preview id; `unknown` for previews that didn't answer about it. */
  states: Record<string, CellState>;
  summary: VisibilitySummary;
  /** The narrowest width whose state differs from the narrowest preview's (rows are sorted by it). */
  switchAt: number;
};

export type VisibilityColumn = AuditColumn & { visibility?: VisibilityReport | null | undefined };

/** Elements asked about in every preview, at most. */
export const MAX_VISIBILITY_ITEMS = 400;

/** How each state is written in a Markdown table. */
export const CELL_MARKS: Record<CellState, string> = { shown: '✓', hidden: '–', missing: '∅', unknown: '?' };

/** The words for each state (the legend, and the cells' labels for assistive technology). */
export const STATE_KEYS = {
  shown: 'visibility.stateShown',
  hidden: 'visibility.stateHidden',
  missing: 'visibility.stateMissing',
  unknown: 'visibility.stateUnknown',
} as const;

/**
 * Every preview's hidden elements, once each by selector (the first label
 * wins), taken in turn from each list so that every preview has its share
 * when there are more than `limit`.
 */
export function unionHidden(
  lists: readonly (readonly HiddenElement[] | null | undefined)[],
  limit = MAX_VISIBILITY_ITEMS,
): HiddenElement[] {
  const union = new Map<string, HiddenElement>();
  const longest = Math.max(0, ...lists.map((list) => list?.length ?? 0));
  for (let index = 0; index < longest && union.size < limit; index++)
    for (const list of lists) {
      const item = list?.[index];
      if (!item || typeof item.selector !== 'string' || !item.selector || union.has(item.selector)) continue;
      union.set(item.selector, { selector: item.selector, label: String(item.label || item.selector) });
      if (union.size >= limit) break;
    }
  return [...union.values()];
}

/** The previews that answered, narrowest first (previews of the same width keep their order). */
export function answeredColumns<T extends VisibilityColumn>(
  columns: readonly T[],
): (T & { visibility: VisibilityReport })[] {
  return columns
    .filter((column): column is T & { visibility: VisibilityReport } => Boolean(column.visibility))
    .sort((a, b) => a.width - b.width);
}

/**
 * When an element is shown, from its state in each preview, narrowest first.
 * Hidden and not on the page both count as not shown; unknown cells are left out.
 */
export function visibilitySummary(cells: readonly { width: number; state: CellState }[]): VisibilitySummary {
  const known = cells.filter((cell) => cell.state !== 'unknown').sort((a, b) => a.width - b.width);
  const shown = known.filter((cell) => cell.state === 'shown').length;
  const some: VisibilitySummary = { kind: 'some', shown, total: known.length };
  // Runs of widths with the same state.
  const runs: { shown: boolean; from: number; to: number }[] = [];
  for (const cell of known) {
    const value = cell.state === 'shown';
    const run = runs[runs.length - 1];
    // Two previews of the same width that differ (another height, other page colours): no rule by width.
    if (run && run.to === cell.width && run.shown !== value) return some;
    if (run && run.shown === value) run.to = cell.width;
    else runs.push({ shown: value, from: cell.width, to: cell.width });
  }
  const [first, second, third] = runs;
  if (runs.length === 2 && first && second)
    return first.shown ? { kind: 'hiddenFrom', width: second.from } : { kind: 'shownFrom', width: second.from };
  if (runs.length === 3 && second && third)
    return second.shown
      ? { kind: 'shownBetween', from: second.from, to: second.to }
      : { kind: 'hiddenBetween', from: second.from, to: second.to };
  return some;
}

/** The summary in words, e.g. "Shown from 1024 px". */
export function summaryText(summary: VisibilitySummary, t: Translate): string {
  switch (summary.kind) {
    case 'shownFrom':
      return t('visibility.shownFrom', { width: summary.width });
    case 'hiddenFrom':
      return t('visibility.hiddenFrom', { width: summary.width });
    case 'shownBetween':
      return summary.from === summary.to
        ? t('visibility.shownOnlyAt', { width: summary.from })
        : t('visibility.shownOnlyBetween', { from: summary.from, to: summary.to });
    case 'hiddenBetween':
      return summary.from === summary.to
        ? t('visibility.hiddenOnlyAt', { width: summary.from })
        : t('visibility.hiddenOnlyBetween', { from: summary.from, to: summary.to });
    case 'some':
      return t('visibility.shownIn', { shown: summary.shown, total: summary.total });
  }
}

/**
 * The elements shown in at least one preview and hidden (or not on the page)
 * in at least one other, with their state in every preview that answered;
 * sorted by the width where they switch, then in the order they were found.
 */
export function visibilityRows(columns: readonly VisibilityColumn[]): VisibilityRow[] {
  const answered = answeredColumns(columns);
  if (answered.length < 2) return [];
  const lookups = answered.map((column) => {
    const states = new Map<string, ShownState>();
    column.visibility.items.forEach((item, index) => {
      const state = column.visibility.states[index];
      if (state === 'shown' || state === 'hidden' || state === 'missing') states.set(item.selector, state);
    });
    return states;
  });
  const items = unionHidden(
    answered.map((column) => column.visibility.items),
    Infinity,
  );
  const rows: (VisibilityRow & { order: number })[] = [];
  items.forEach((item, order) => {
    const cells = answered.map((column, index) => ({
      id: column.id,
      width: column.width,
      state: (lookups[index]!.get(item.selector) ?? 'unknown') as CellState,
    }));
    const known = cells.filter((cell) => cell.state !== 'unknown');
    if (!known.some((cell) => cell.state === 'shown') || known.every((cell) => cell.state === 'shown')) return;
    const narrowest = known[0]!.state === 'shown';
    const switchAt = known.find((cell) => (cell.state === 'shown') !== narrowest)!.width;
    rows.push({
      selector: item.selector,
      label: item.label,
      states: Object.fromEntries(cells.map((cell) => [cell.id, cell.state])),
      summary: visibilitySummary(cells),
      switchAt,
      order,
    });
  });
  return rows.sort((a, b) => a.switchAt - b.switchAt || a.order - b.order).map(({ order: _order, ...row }) => row);
}

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.map(cell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

/** "✓ shown · – hidden · ∅ not on the page · ? not measured". */
export const markdownLegend = (t: Translate) =>
  (Object.keys(CELL_MARKS) as CellState[]).map((state) => `${CELL_MARKS[state]} ${t(STATE_KEYS[state])}`).join(' · ');

/** The matrix as a Markdown table — one row per element, one column per preview, narrowest first — for a ticket. */
export function visibilityMarkdown(page: string, columns: readonly VisibilityColumn[], t: Translate): string {
  const heading = t('visibility.markdown', { page });
  const answered = answeredColumns(columns);
  const notRead = columns.filter((column) => !column.visibility).map((column) => column.name);
  const notReadLine = notRead.length > 0 ? `\n${t('visibility.notRead', { names: notRead.join(', ') })}\n` : '';
  if (answered.length === 0) return `${heading}\n\n${t('visibility.noAgent')}\n`;
  if (answered.length === 1) return `${heading}\n\n${t('visibility.needTwo')}\n${notReadLine}`;
  const rows = visibilityRows(answered);
  if (rows.length === 0) return `${heading}\n\n${t('visibility.empty')}\n${notReadLine}`;
  const body = rows.map((row) => [
    `\`${row.label.replace(/`/g, '')}\``,
    ...answered.map((column) => CELL_MARKS[row.states[column.id] ?? 'unknown']),
    summaryText(row.summary, t),
  ]);
  return [
    heading,
    '',
    table(
      [
        t('visibility.colElement'),
        ...answered.map((column) => `${column.name} (${column.width}px)`),
        t('visibility.colSummary'),
      ],
      body,
    ),
    '',
    markdownLegend(t),
    notReadLine,
  ]
    .join('\n')
    .replace(/\n*$/, '\n');
}
