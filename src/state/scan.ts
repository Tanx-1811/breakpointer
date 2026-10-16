import { CHECK_KINDS, type CheckIssue, type CheckKind } from '../agent/protocol';
import type { Translate } from '../i18n/translate';
import { MAX_DIMENSION, MIN_DIMENSION } from '../utils/constants';
import { CHECK_KIND_KEYS } from './checks';
import { issueCell } from './audit';

/**
 * The card id of the width scanner's preview frame: `~` can't occur in viewport
 * ids, so it never meets a viewport (as with the B side of a comparison).
 */
export const SCAN_CARD_ID = '~scan';

/** What the width scanner found at one width. */
export type ScanSample = {
  width: number;
  /** The page's height there, in CSS pixels. */
  height: number;
  issues: CheckIssue[];
};

export type ScanOptions = {
  from: number;
  to: number;
  /** The first pass checks every `step` pixels; changes between two of them are then found to the pixel. */
  step: number;
};

/** Steps offered for the first pass. */
export const SCAN_STEPS = [32, 16, 8] as const;

export const DEFAULT_SCAN: ScanOptions = { from: 320, to: 1920, step: 16 };

/** At most this many widths are checked in one scan (a wide range with a fine step). */
export const MAX_SCAN_PROBES = 600;

/** Valid options, or null: whole widths within the viewport limits, `from` below `to`. */
export function validScanOptions(options: ScanOptions): ScanOptions | null {
  const { from, to, step } = options;
  const whole = (value: number) => Number.isInteger(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION;
  if (!whole(from) || !whole(to) || from >= to) return null;
  if (!Number.isInteger(step) || step < 1) return null;
  return options;
}

/** The widths of the first pass: every `step` pixels from `from` to `to`, both ends included. */
export function coarseWidths({ from, to, step }: ScanOptions): number[] {
  const widths: number[] = [];
  for (let width = from; width < to; width += step) widths.push(width);
  widths.push(to);
  return widths;
}

/** The issues at a sample as a comparable key ("low-contrast overflow"). */
export const issueSignature = (sample: ScanSample) =>
  sample.issues
    .map((issue) => issue.kind)
    .sort()
    .join(' ');

export type ScanProgress = { done: number; total: number; width: number };

/** Neighbouring samples whose issues differ and that are more than 1px apart: an edge not found exactly yet. */
const openGaps = (samples: ScanSample[]) =>
  samples
    .slice(1)
    .map((sample, index) => [samples[index]!, sample] as const)
    .filter(([a, b]) => b.width - a.width > 1 && issueSignature(a) !== issueSignature(b));

/**
 * Checks the page at every width of the first pass, then between any two
 * neighbouring widths whose issues differ, halves the gap until they are one
 * pixel apart — so each issue's first and last width is exact. `probe` resizes
 * the preview and answers with what it found. Stops early (keeping what was
 * found) when `stopped()` says so. Samples come back sorted by width.
 */
export async function scanWidths(
  options: ScanOptions,
  probe: (width: number) => Promise<ScanSample>,
  onProgress?: (progress: ScanProgress, samples: ScanSample[]) => void,
  stopped: () => boolean = () => false,
): Promise<ScanSample[]> {
  const found = new Map<number, ScanSample>();
  const sorted = () => [...found.values()].sort((a, b) => a.width - b.width);
  const coarse = coarseWidths(options);
  // Each change costs about log2(step) more widths.
  const perChange = Math.max(1, Math.ceil(Math.log2(options.step)));
  let total = coarse.length;
  let done = 0;
  const check = async (width: number) => {
    if (found.has(width) || done >= MAX_SCAN_PROBES) return found.get(width);
    const sample = await probe(width);
    // Kept under the width asked for (the preview waits until it has that width before answering).
    found.set(width, { ...sample, width });
    done++;
    onProgress?.({ done, total: Math.min(MAX_SCAN_PROBES, Math.max(total, done)), width }, sorted());
    return found.get(width);
  };

  for (const width of coarse) {
    if (stopped()) return sorted();
    await check(width);
  }

  // Gaps between neighbours whose issues differ, narrowed until they are 1px wide.
  let pending = openGaps(sorted());
  total = done + pending.length * perChange;
  while (pending.length && !stopped() && done < MAX_SCAN_PROBES) {
    for (const [a, b] of pending) {
      if (stopped()) break;
      await check(Math.floor((a.width + b.width) / 2));
    }
    pending = openGaps(sorted());
    total = Math.max(total, done + pending.length * Math.max(1, perChange - 1));
  }
  return sorted();
}

/**
 * What a scan's samples cover: the widths from `from` to `to` were checked, and
 * each issue's edges are exact to `accuracy` px — 1 when the scan finished, more
 * when it was stopped (or reached its limit) before narrowing every gap.
 */
export type ScanCoverage = { from: number; to: number; accuracy: number };

export function scanCoverage(options: ScanOptions, samples: ScanSample[]): ScanCoverage {
  const last = samples.at(-1)?.width ?? options.from;
  const accuracy = Math.max(1, ...openGaps(samples).map(([a, b]) => b.width - a.width));
  return { from: options.from, to: Math.min(options.to, last), accuracy };
}

/** What a reader of the results should know about a scan that didn't finish (nothing when it did). */
export function coverageNotes(options: ScanOptions, coverage: ScanCoverage, t: Translate): string[] {
  const notes: string[] = [];
  if (coverage.to < options.to) notes.push(t('scan.partial', { from: coverage.from, to: coverage.to }));
  if (coverage.accuracy > 1) notes.push(t('scan.approximate', { accuracy: coverage.accuracy }));
  return notes;
}

/** A run of widths where an issue was found, both ends included, with the width where it is worst. */
export type ScanRange = { from: number; to: number; peak: { width: number; issue: CheckIssue } };

/** How bad an issue is, to find the worst width of a range (higher is worse). */
function severity(issue: CheckIssue): number {
  const amount = Number.parseFloat(issue.detail ?? '');
  if (issue.kind === 'overflow' || issue.kind === 'fixed-cover') return Number.isFinite(amount) ? amount : issue.count;
  // The lowest contrast ratio is the worst.
  if (issue.kind === 'low-contrast') return Number.isFinite(amount) ? -amount : issue.count;
  return issue.count;
}

/** The runs of neighbouring samples where `kind` was found. */
export function rangesOf(samples: ScanSample[], kind: CheckKind): ScanRange[] {
  const ranges: ScanRange[] = [];
  let current: ScanRange | null = null;
  for (const sample of samples) {
    const issue = sample.issues.find((item) => item.kind === kind);
    if (!issue) {
      current = null;
      continue;
    }
    if (!current) {
      current = { from: sample.width, to: sample.width, peak: { width: sample.width, issue } };
      ranges.push(current);
      continue;
    }
    current.to = sample.width;
    if (severity(issue) > severity(current.peak.issue)) current.peak = { width: sample.width, issue };
  }
  return ranges;
}

/** Every kind of issue found, in display order, with its ranges. */
export function scanFindings(samples: ScanSample[]): { kind: CheckKind; ranges: ScanRange[] }[] {
  return CHECK_KINDS.map((kind) => ({ kind, ranges: rangesOf(samples, kind) })).filter(
    (finding) => finding.ranges.length > 0,
  );
}

/** "320–359 px" or "412 px". */
export function rangeText(range: Pick<ScanRange, 'from' | 'to'>, t: Translate): string {
  return range.from === range.to
    ? t('scan.rangeOne', { width: range.from })
    : t('scan.range', { from: range.from, to: range.to });
}

/** The sample nearest to a width (the scan checks only some widths). */
export function nearestSample(samples: ScanSample[], width: number): ScanSample | undefined {
  let best: ScanSample | undefined;
  for (const sample of samples)
    if (!best || Math.abs(sample.width - width) < Math.abs(best.width - width)) best = sample;
  return best;
}

/** The scan as a Markdown table: each issue with the widths where it was found. */
export function scanMarkdown(page: string, options: ScanOptions, samples: ScanSample[], t: Translate): string {
  const coverage = scanCoverage(options, samples);
  const heading = [t('scan.markdown', { page, from: options.from, to: options.to }), ...coverageNotes(options, coverage, t)]
    .map((line) => `${line}\n`)
    .join('\n');
  const findings = scanFindings(samples);
  if (findings.length === 0) return `${heading}\n${t('scan.none', { from: coverage.from, to: coverage.to })}\n`;
  const rows = findings.map(({ kind, ranges }) => {
    const widths = ranges
      .map((range) => `${rangeText(range, t)} (${issueCell(range.peak.issue)} @ ${range.peak.width}px)`)
      .join(', ');
    return `| ${t(CHECK_KIND_KEYS[kind])} | ${widths} |`;
  });
  return [heading, `| ${t('audit.check')} | ${t('scan.widths')} |`, '| --- | --- |', ...rows, ''].join('\n');
}
