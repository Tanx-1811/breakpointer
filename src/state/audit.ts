import {
  CHECK_KINDS,
  type CheckIssue,
  type CheckKind,
  type CheckReport,
  type PageStats,
  type TypeSample,
} from '../agent/protocol';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';
import { CHECK_KIND_KEYS } from './checks';

/** One preview in the audit: a column of the comparison. */
export type AuditColumn = { id: string; name: string; width: number; height: number };

export type IssueHit = { column: AuditColumn; issue: CheckIssue };

/** One kind of issue and the previews it was found in. */
export type IssueGroup = { kind: CheckKind; hits: IssueHit[] };

/**
 * The issues found in any preview, grouped by kind in the order the checks are
 * shown; within a kind, previews keep the order given (narrowest first, as the
 * workspace lists them).
 */
export function groupIssues(columns: (AuditColumn & { report: CheckReport | null })[]): IssueGroup[] {
  const groups: IssueGroup[] = [];
  for (const kind of CHECK_KINDS) {
    const hits: IssueHit[] = [];
    for (const column of columns) {
      const issue = column.report?.issues.find((item) => item.kind === kind);
      if (issue) hits.push({ column, issue });
    }
    if (hits.length) groups.push({ kind, hits });
  }
  return groups;
}

/** A short value for a table cell: "+184px", "3 · 2.85:1", "CLS 0.24", "45%"… */
export function issueCell(issue: CheckIssue): string {
  switch (issue.kind) {
    case 'overflow':
      return issue.detail ? `+${issue.detail}` : String(issue.count);
    case 'viewport-meta':
      return '!';
    case 'fixed-cover':
      return issue.detail ?? String(issue.count);
    case 'layout-shift':
      return `CLS ${issue.detail ?? ''}`.trim();
    case 'low-contrast':
      return issue.detail ? `${issue.count} · ${issue.detail}:1` : String(issue.count);
    default:
      return String(issue.count);
  }
}

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

function table(header: string[], rows: string[][]): string {
  return [
    `| ${header.map(cell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

const columnTitle = (column: AuditColumn) => `${column.name} (${column.width}px)`;

/**
 * Every check in every preview as a Markdown table — ⚠ with the detail where an
 * issue was found, ✓ where not, — where the preview wasn't checked — to paste
 * into a ticket or a pull request.
 */
export function issuesMarkdown(
  page: string,
  columns: (AuditColumn & { report: CheckReport | null })[],
  kinds: readonly CheckKind[],
  t: Translate,
): string {
  const rows = kinds.map((kind) => [
    t(CHECK_KIND_KEYS[kind]),
    ...columns.map((column) => {
      if (!column.report) return '—';
      const issue = column.report.issues.find((item) => item.kind === kind);
      return issue ? `⚠ ${issueCell(issue)}` : '✓';
    }),
  ]);
  return `${t('audit.markdownIssues', { page })}\n\n${table([t('audit.check'), ...columns.map(columnTitle)], rows)}\n`;
}

/* ---------- Page stats ---------- */

export const STAT_METRICS = [
  'transferred',
  'requests',
  'imagePixels',
  'lcp',
  'cls',
  'height',
  'elements',
  'fonts',
] as const;

export type StatMetric = (typeof STAT_METRICS)[number];

export const STAT_KEYS: Record<StatMetric, { label: MessageKey; hint: MessageKey }> = {
  transferred: { label: 'audit.stat.transferred', hint: 'audit.stat.transferredHint' },
  requests: { label: 'audit.stat.requests', hint: 'audit.stat.requestsHint' },
  imagePixels: { label: 'audit.stat.imagePixels', hint: 'audit.stat.imagePixelsHint' },
  lcp: { label: 'audit.stat.lcp', hint: 'audit.stat.lcpHint' },
  cls: { label: 'audit.stat.cls', hint: 'audit.stat.clsHint' },
  height: { label: 'audit.stat.height', hint: 'audit.stat.heightHint' },
  elements: { label: 'audit.stat.elements', hint: 'audit.stat.elementsHint' },
  fonts: { label: 'audit.stat.fonts', hint: 'audit.stat.fontsHint' },
};

/** The number a metric is compared by; null when the page didn't report it. */
export function statValue(stats: PageStats, metric: StatMetric): number | null {
  return metric === 'lcp' ? stats.lcp : stats[metric];
}

/**
 * How the images' files compare with what this screen needs where they are
 * shown: 1 is just right, below 1 is blurry, far above 1 downloads pixels that
 * are never seen. Null without images.
 */
export function imageDensityRatio(stats: PageStats): number | null {
  if (!stats.images || stats.shownPixels <= 0 || stats.imagePixels <= 0) return null;
  return Math.sqrt(stats.imagePixels / stats.shownPixels) / Math.max(1, stats.dpr);
}

/** Core Web Vitals thresholds ("needs improvement" from here), and images far denser than needed. */
export function statWarning(stats: PageStats, metric: StatMetric): boolean {
  if (metric === 'lcp') return stats.lcp !== null && stats.lcp > 2500;
  if (metric === 'cls') return stats.cls > 0.1;
  if (metric === 'imagePixels') {
    const ratio = imageDensityRatio(stats);
    return ratio !== null && ratio > 2;
  }
  return false;
}

const number = (value: number, locale: string, digits = 0) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

/** "18 kB", "1.4 MB" (decimal units, as Chrome's DevTools). */
export function formatBytes(bytes: number, locale = 'en'): string {
  if (bytes < 1000) return `${number(bytes, locale)} B`;
  if (bytes < 1_000_000) return `${number(bytes / 1000, locale)} kB`;
  return `${number(bytes / 1_000_000, locale, 1)} MB`;
}

/** "850 ms", "1.8 s". */
export function formatMs(ms: number, locale = 'en'): string {
  return ms < 1000 ? `${number(ms, locale)} ms` : `${number(ms / 1000, locale, 1)} s`;
}

/** "3.1 MP", "0.4 MP", "< 0.1 MP". */
export function formatMegapixels(pixels: number, locale = 'en'): string {
  const megapixels = pixels / 1_000_000;
  if (pixels > 0 && megapixels < 0.1) return `< ${number(0.1, locale, 1)} MP`;
  return `${number(megapixels, locale, 1)} MP`;
}

export function formatStat(metric: StatMetric, stats: PageStats, locale = 'en'): string {
  switch (metric) {
    case 'transferred':
      return formatBytes(stats.transferred, locale);
    case 'imagePixels':
      return formatMegapixels(stats.imagePixels, locale);
    case 'lcp':
      return stats.lcp === null ? '—' : formatMs(stats.lcp, locale);
    case 'cls':
      return number(stats.cls, locale, 2);
    case 'height':
      return `${number(stats.height, locale)} px`;
    default:
      return number(stats[metric], locale);
  }
}

/** The page's numbers in every preview, as a Markdown table. */
export function statsMarkdown(
  page: string,
  columns: (AuditColumn & { stats: PageStats | null })[],
  t: Translate,
  locale = 'en',
): string {
  const rows = STAT_METRICS.map((metric) => [
    t(STAT_KEYS[metric].label),
    ...columns.map((column) => (column.stats ? formatStat(metric, column.stats, locale) : '—')),
  ]);
  return `${t('audit.markdownStats', { page })}\n\n${table([t('audit.metric'), ...columns.map(columnTitle)], rows)}\n`;
}

/* ---------- Type scale ---------- */

/** "32px / 40px · 700" (line height left out when it is `normal`). */
export function typeValue(sample: TypeSample): string {
  const size = `${Math.round(sample.fontSize * 10) / 10}px`;
  const line = sample.lineHeight === null ? '' : ` / ${Math.round(sample.lineHeight * 10) / 10}px`;
  return `${size}${line} · ${sample.fontWeight}`;
}

export type TypeRow = {
  tag: string;
  /** The sample for each column (undefined: not shown there, or not known). */
  samples: (TypeSample | undefined)[];
  /** The size, line height or weight differs between the columns that show it. */
  changes: boolean;
};

/** One row per kind of element shown in any preview, in the agents' order (h1…h6, p, li…). */
export function typeRows(columns: (AuditColumn & { samples: TypeSample[] | null })[]): TypeRow[] {
  const tags: string[] = [];
  for (const column of columns)
    for (const sample of column.samples ?? []) if (!tags.includes(sample.tag)) tags.push(sample.tag);
  const order = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'button', 'label', 'input', 'small'];
  tags.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return tags.map((tag) => {
    const samples = columns.map((column) => column.samples?.find((sample) => sample.tag === tag));
    const values = new Set(samples.filter(Boolean).map((sample) => typeValue(sample!)));
    return { tag, samples, changes: values.size > 1 };
  });
}

export function typeMarkdown(
  page: string,
  columns: (AuditColumn & { samples: TypeSample[] | null })[],
  t: Translate,
): string {
  const rows = typeRows(columns).map((row) => [
    `\`${row.tag}\``,
    ...row.samples.map((sample) => (sample ? typeValue(sample) : '—')),
  ]);
  return `${t('audit.markdownType', { page })}\n\n${table([t('audit.element'), ...columns.map(columnTitle)], rows)}\n`;
}
