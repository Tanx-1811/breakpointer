import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';
import type { QaItem } from '../types';
import { createId } from '../utils/id';

/**
 * The QA checklist: manual checks ("the menu opens and closes") ticked off at
 * every visible size, copied as a Markdown report. The list of checks is a
 * setting (empty: the built-in ones, in the UI's language); results are kept
 * for the session only.
 */

export const MAX_QA_ITEMS = 40;
export const MAX_QA_ID = 40;
export const MAX_QA_TEXT = 140;

/** The built-in checks, translated when shown (so they follow the UI's language until the list is edited). */
export const DEFAULT_QA_ITEMS: readonly { id: string; key: MessageKey }[] = [
  { id: 'default:nav', key: 'qa.default.nav' },
  { id: 'default:overflow', key: 'qa.default.overflow' },
  { id: 'default:text', key: 'qa.default.text' },
  { id: 'default:images', key: 'qa.default.images' },
  { id: 'default:tap', key: 'qa.default.tap' },
  { id: 'default:forms', key: 'qa.default.forms' },
  { id: 'default:media', key: 'qa.default.media' },
  { id: 'default:dialogs', key: 'qa.default.dialogs' },
];

/** The checks to show: the stored ones, or the built-in ones translated when none are stored. */
export function resolveQaItems(stored: readonly QaItem[], t: Translate): QaItem[] {
  if (stored.length) return [...stored];
  return DEFAULT_QA_ITEMS.map(({ id, key }) => ({ id, text: t(key) }));
}

/** A check's text on one line, without surrounding spaces, cut to the maximum length. */
export const normalizeQaText = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_QA_TEXT);

/** Stored or imported checks are untrusted: invalid, duplicate and extra items are dropped. */
export function parseQaChecklist(raw: unknown): QaItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: QaItem[] = [];
  for (const entry of raw) {
    if (items.length >= MAX_QA_ITEMS) break;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const { id, text } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > MAX_QA_ID || seen.has(id)) continue;
    if (typeof text !== 'string') continue;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_QA_TEXT) continue;
    seen.add(id);
    items.push({ id, text: trimmed });
  }
  return items;
}

/** Adds a check at the end (unchanged when the text is empty or the list is full). */
export function addQaItem(items: readonly QaItem[], text: string, id: string = createId()): QaItem[] {
  const clean = normalizeQaText(text);
  if (!clean || items.length >= MAX_QA_ITEMS || items.some((item) => item.id === id)) return [...items];
  return [...items, { id, text: clean }];
}

/** Changes a check's text (unchanged when the new text is empty). */
export function editQaItem(items: readonly QaItem[], id: string, text: string): QaItem[] {
  const clean = normalizeQaText(text);
  return items.map((item) => (item.id === id && clean ? { ...item, text: clean } : item));
}

export const removeQaItem = (items: readonly QaItem[], id: string): QaItem[] => items.filter((item) => item.id !== id);

/* ---------- Results ---------- */

export type QaResult = 'pass' | 'fail' | 'skip';

/** Results by check id, then by viewport id; a missing result is "not checked". */
export type QaResults = Record<string, Record<string, QaResult>>;

const CYCLE: readonly (QaResult | undefined)[] = [undefined, 'pass', 'fail', 'skip'];

/** What a click on a cell sets: not checked → passed → failed → skipped → not checked. */
export function nextQaResult(current?: QaResult): QaResult | undefined {
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
}

/** The results with one cell set (or cleared with undefined); the others are kept as they are. */
export function setQaResult(
  results: QaResults,
  itemId: string,
  viewportId: string,
  result: QaResult | undefined,
): QaResults {
  const { [viewportId]: _previous, ...rest } = results[itemId] ?? {};
  const row: Record<string, QaResult> = result ? { ...rest, [viewportId]: result } : rest;
  const { [itemId]: _row, ...others } = results;
  return Object.keys(row).length ? { ...others, [itemId]: row } : others;
}

export type QaSummary = { total: number; checked: number; passed: number; failed: number; skipped: number };

/** Counts the cells of the current checks and viewports (results of removed ones don't count). */
export function qaSummary(items: readonly QaItem[], viewportIds: readonly string[], results: QaResults): QaSummary {
  const summary: QaSummary = { total: items.length * viewportIds.length, checked: 0, passed: 0, failed: 0, skipped: 0 };
  for (const item of items) {
    for (const viewportId of viewportIds) {
      const result = results[item.id]?.[viewportId];
      if (!result) continue;
      summary.checked += 1;
      if (result === 'pass') summary.passed += 1;
      else if (result === 'fail') summary.failed += 1;
      else summary.skipped += 1;
    }
  }
  return summary;
}

/* ---------- Markdown ---------- */

export type QaViewport = { id: string; name: string; width: number; height: number };

export const QA_RESULT_KEYS: Record<QaResult, MessageKey> = {
  pass: 'qa.state.pass',
  fail: 'qa.state.fail',
  skip: 'qa.state.skip',
};

const QA_MARKS: Record<QaResult, string> = { pass: '✅', fail: '❌', skip: '➖' };

const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
const cell = (value: string) => oneLine(value).replace(/\|/g, '\\|');

/**
 * The checklist as Markdown: the page and how far it got, a table with a
 * column per viewport (✅ passed, ❌ failed, ➖ skipped, blank not checked),
 * then every failure with the viewport's size.
 */
export function qaMarkdown({
  page,
  items,
  viewports,
  results,
  t,
}: {
  page: string;
  items: readonly QaItem[];
  viewports: readonly QaViewport[];
  results: QaResults;
  t: Translate;
}): string {
  const summary = qaSummary(
    items,
    viewports.map((viewport) => viewport.id),
    results,
  );
  const progress = [
    t('qa.progress', { checked: summary.checked, total: summary.total }),
    ...(summary.failed ? [t('qa.progressFailed', { failed: summary.failed })] : []),
  ].join(' · ');
  const legend = (Object.keys(QA_MARKS) as QaResult[])
    .map((result) => `${QA_MARKS[result]} ${t(QA_RESULT_KEYS[result])}`)
    .join(' · ');
  const header = [t('qa.check'), ...viewports.map((viewport) => `${viewport.name} ${viewport.width}`)];
  const rows = items.map((item) => [
    item.text,
    ...viewports.map((viewport) => {
      const result = results[item.id]?.[viewport.id];
      return result ? QA_MARKS[result] : '';
    }),
  ]);
  const lines = [
    `## ${t('qa.reportTitle')} · ${page}`,
    '',
    progress,
    '',
    legend,
    '',
    `| ${header.map(cell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
  const failures = items.flatMap((item) =>
    viewports
      .filter((viewport) => results[item.id]?.[viewport.id] === 'fail')
      .map((viewport) => `- ${oneLine(item.text)} — ${viewport.name} (${viewport.width} × ${viewport.height})`),
  );
  if (failures.length) lines.push('', `### ${t('qa.reportFailed')}`, '', ...failures);
  return `${lines.join('\n')}\n`;
}
