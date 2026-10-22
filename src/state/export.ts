import type { CheckIssue, CheckReport, PageStats, TypeSample } from '../agent/protocol';
import type { Translate } from '../i18n/translate';
import { type BatchCell, type BatchRun, failureText, pageScore } from './batch';
import { CHECK_KIND_KEYS } from './checks';
import { responsiveScore } from './score';
import { scanFindings, type ScanOptions, type ScanSample } from './scan';

/**
 * CSV and JSON exports (Pro) of Check pages, the width scanner and the audit
 * panel, for spreadsheets and scripts. Made in the browser from what is shown;
 * nothing is uploaded.
 */
export type ExportFormat = 'csv' | 'json';

/** Text a spreadsheet would run as a formula (CSV injection): kept as text with a leading apostrophe. */
const FORMULA = /^[=+\-@\t\r]/;

/** One CSV field (RFC 4180): quoted when it holds a comma, quote or line break. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value;
  if (typeof value === 'string' && FORMULA.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A CSV file: a header row and the rows, separated by CRLF, starting with a
 * byte order mark so spreadsheet apps read it as UTF-8 (Vietnamese, emoji…).
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** The common part of every JSON export. */
type Envelope = { app: 'Breakpointer'; kind: string; version: string; exportedAt: string };
const envelope = (kind: string, version: string, now: Date): Envelope => ({
  app: 'Breakpointer',
  kind,
  version,
  exportedAt: now.toISOString(),
});

const issueJson = (issue: CheckIssue) => ({
  kind: issue.kind,
  count: issue.count,
  ...(issue.detail ? { detail: issue.detail } : {}),
  samples: issue.samples.map((sample) => ({
    selector: sample.selector,
    ...(sample.detail ? { detail: sample.detail } : {}),
  })),
});

const examples = (issue: CheckIssue) =>
  issue.samples.map((sample) => (sample.detail ? `${sample.selector} (${sample.detail})` : sample.selector)).join('; ');

/**
 * The check, its id, how many elements and the value the check measured, as
 * the agent wrote it ("184px", "2.85", "45%"): no sign in front, so a
 * spreadsheet never takes it for a formula and it needs no apostrophe.
 */
const issueColumns = (issue: CheckIssue, t: Translate) => [
  t(CHECK_KIND_KEYS[issue.kind]),
  issue.kind,
  issue.count,
  issue.detail ?? '',
  examples(issue),
];

/* ---------- Check pages ---------- */

function cellResult(cell: BatchCell | null, t: Translate): string {
  if (!cell) return t('export.result.notChecked');
  if (cell.status === 'failed') return t('export.result.failed');
  return cell.issues.length ? t('export.result.issues') : t('export.result.ok');
}

/** A row per page, size and issue (a row per page and size when it has none): easy to filter and pivot. */
export function batchCsv(run: BatchRun, t: Translate): string {
  const header = [
    t('batch.page'),
    t('export.finalPage'),
    t('report.viewport'),
    t('export.width'),
    t('export.height'),
    t('export.result'),
    t('audit.check'),
    t('export.checkId'),
    t('export.elements'),
    t('export.value'),
    t('export.examples'),
    t('export.pageScore'),
  ];
  const rows: (string | number | null)[][] = [];
  for (const page of run.pages) {
    if (page.status === 'failed') {
      rows.push([page.url, page.finalUrl ?? '', '', null, null, failureText(page, t), '', '', null, '', '', null]);
      continue;
    }
    const score = pageScore(page)?.score ?? null;
    run.sizes.forEach((size, index) => {
      const cell = page.cells[index] ?? null;
      const base = [page.url, page.finalUrl ?? '', size.name, size.width, size.height, cellResult(cell, t)];
      if (cell?.status === 'checked' && cell.issues.length)
        for (const issue of cell.issues) rows.push([...base, ...issueColumns(issue, t), score]);
      else rows.push([...base, '', '', null, '', '', score]);
    });
  }
  return toCsv(header, rows);
}

export function batchJson(run: BatchRun, version: string, now = new Date()): string {
  return `${JSON.stringify(
    {
      ...envelope('check-pages', version, now),
      started: new Date(run.started).toISOString(),
      complete: run.complete,
      sizes: run.sizes.map(({ key, name, width, height, colorScheme }) => ({ key, name, width, height, colorScheme })),
      pages: run.pages.map((page) => ({
        url: page.url,
        ...(page.finalUrl ? { finalUrl: page.finalUrl } : {}),
        status: page.status,
        ...(page.failure ? { failure: page.failure } : {}),
        ...(page.httpStatus ? { httpStatus: page.httpStatus } : {}),
        score: scoreJson(pageScore(page)),
        results: page.cells.map((cell, index) => ({
          size: run.sizes[index]?.key ?? null,
          status: cell?.status ?? 'notChecked',
          issues: cell?.status === 'checked' ? cell.issues.map(issueJson) : [],
        })),
      })),
    },
    null,
    2,
  )}\n`;
}

const scoreJson = (score: ReturnType<typeof pageScore>) =>
  score ? { value: score.score, grade: score.grade, sizes: score.sizes } : null;

/* ---------- Width scan ---------- */

/** A row per issue and range of widths: where it starts and ends, and its worst width. */
const byWidth = (samples: ScanSample[]) => [...samples].sort((a, b) => a.width - b.width);

export function scanCsv(samples: ScanSample[], t: Translate): string {
  const header = [
    t('audit.check'),
    t('export.checkId'),
    t('export.fromWidth'),
    t('export.toWidth'),
    t('export.worstWidth'),
    t('export.value'),
  ];
  const rows = scanFindings(byWidth(samples)).flatMap(({ kind, ranges }) =>
    ranges.map((range) => [
      t(CHECK_KIND_KEYS[kind]),
      kind,
      range.from,
      range.to,
      range.peak.width,
      range.peak.issue.detail ?? String(range.peak.issue.count),
    ]),
  );
  return toCsv(header, rows);
}

export function scanJson(
  page: string,
  options: ScanOptions,
  samples: ScanSample[],
  version: string,
  now = new Date(),
): string {
  return `${JSON.stringify(
    {
      ...envelope('width-scan', version, now),
      page,
      from: options.from,
      to: options.to,
      step: options.step,
      findings: scanFindings(byWidth(samples)).map(({ kind, ranges }) => ({
        kind,
        ranges: ranges.map((range) => ({
          from: range.from,
          to: range.to,
          worst: { width: range.peak.width, ...issueJson(range.peak.issue) },
        })),
      })),
      samples: byWidth(samples).map((sample) => ({
        width: sample.width,
        height: sample.height,
        issues: sample.issues.map((issue) => ({
          kind: issue.kind,
          count: issue.count,
          ...(issue.detail ? { detail: issue.detail } : {}),
        })),
      })),
    },
    null,
    2,
  )}\n`;
}

/* ---------- Audit ---------- */

/** One preview in the audit, as exported. */
export type AuditExportRow = {
  name: string;
  width: number;
  height: number;
  report: CheckReport | null;
  stats?: PageStats | null;
  type?: TypeSample[] | null;
};

/** A row per preview and issue (a row per preview when it has none, or wasn't checked). */
export function auditCsv(rows: AuditExportRow[], t: Translate): string {
  const header = [
    t('report.viewport'),
    t('export.width'),
    t('export.height'),
    t('export.result'),
    t('audit.check'),
    t('export.checkId'),
    t('export.elements'),
    t('export.value'),
    t('export.examples'),
  ];
  const lines: (string | number | null)[][] = [];
  for (const row of rows) {
    const base = [row.name, row.width, row.height];
    if (!row.report) {
      lines.push([...base, t('export.result.notChecked'), '', '', null, '', '']);
      continue;
    }
    if (!row.report.issues.length) {
      lines.push([...base, t('export.result.ok'), '', '', null, '', '']);
      continue;
    }
    for (const issue of row.report.issues) lines.push([...base, t('export.result.issues'), ...issueColumns(issue, t)]);
  }
  return toCsv(header, lines);
}

export function auditJson(page: string | null, rows: AuditExportRow[], version: string, now = new Date()): string {
  return `${JSON.stringify(
    {
      ...envelope('audit', version, now),
      page,
      score: scoreJson(responsiveScore(rows.map((row) => row.report))),
      previews: rows.map((row) => ({
        name: row.name,
        width: row.width,
        height: row.height,
        checked: row.report !== null,
        issues: row.report?.issues.map(issueJson) ?? [],
        stats: row.stats ?? null,
        typeScale: row.type ?? null,
      })),
    },
    null,
    2,
  )}\n`;
}
