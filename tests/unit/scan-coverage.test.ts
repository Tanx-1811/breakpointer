import { describe, expect, it } from 'vitest';
import type { CheckIssue } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import { buildReportHtml } from '../../src/state/report';
import {
  MAX_SCAN_PROBES,
  coverageNotes,
  scanCoverage,
  scanMarkdown,
  scanWidths,
  type ScanProgress,
  type ScanSample,
} from '../../src/state/scan';

const t = createTranslator('en');

/** A page that overflows below 400px. */
function page(width: number): ScanSample {
  const issues: CheckIssue[] = width < 400 ? [{ kind: 'overflow', count: 1, detail: '20px', samples: [] }] : [];
  return { width, height: 1000, issues };
}

const options = { from: 320, to: 900, step: 32 };

describe('what a width scan covered', () => {
  it('covers the whole range, to the pixel, once finished', async () => {
    const samples = await scanWidths(options, async (width) => page(width));
    expect(scanCoverage(options, samples)).toEqual({ from: 320, to: 900, accuracy: 1 });
    expect(coverageNotes(options, scanCoverage(options, samples), t)).toEqual([]);
  });

  it('covers only the widths reached when stopped during the first pass', async () => {
    let probes = 0;
    const samples = await scanWidths(
      options,
      async (width) => {
        probes++;
        return page(width);
      },
      undefined,
      () => probes >= 5,
    );
    // 320, 352, 384, 416, 448: the overflow ends somewhere between 384 and 416.
    const coverage = scanCoverage(options, samples);
    expect(coverage).toEqual({ from: 320, to: 448, accuracy: 32 });
    expect(coverageNotes(options, coverage, t)).toEqual([
      'Stopped early: only the widths from 320 to 448 px were checked.',
      'Edges are accurate to 32 px: the scan ended before narrowing them all to the pixel.',
    ]);
  });

  it('has edges accurate only to the gap left when stopped while narrowing', async () => {
    const coarse = Math.ceil((options.to - options.from) / options.step) + 1;
    let probes = 0;
    const samples = await scanWidths(
      options,
      async (width) => {
        probes++;
        return page(width);
      },
      undefined,
      () => probes >= coarse + 2,
    );
    const coverage = scanCoverage(options, samples);
    expect(coverage.to).toBe(900);
    // Two halvings of the 32px gap leave 8px.
    expect(coverage.accuracy).toBe(8);
    expect(coverageNotes(options, coverage, t)).toEqual([
      'Edges are accurate to 8 px: the scan ended before narrowing them all to the pixel.',
    ]);
  });

  it('says so in the copied Markdown, and finds no issues only where it looked', async () => {
    let probes = 0;
    const clean = await scanWidths(
      { from: 400, to: 900, step: 32 },
      async (width) => {
        probes++;
        return page(width);
      },
      undefined,
      () => probes >= 3,
    );
    expect(scanMarkdown('https://example.com/', { from: 400, to: 900, step: 32 }, clean, t)).toBe(
      [
        '**Width scan** · https://example.com/ · 400–900 px',
        '',
        'Stopped early: only the widths from 400 to 464 px were checked.',
        '',
        'No issues from 400 to 464 px.',
        '',
      ].join('\n'),
    );
  });

  it('never counts more widths to check than one scan checks', async () => {
    const totals: number[] = [];
    // An issue that comes and goes every few pixels keeps the scan narrowing until its limit.
    await scanWidths(
      { from: 200, to: 3840, step: 8 },
      async (width) => ({
        width,
        height: 1000,
        issues: width % 6 < 3 ? [{ kind: 'small-text', count: 1, samples: [] }] : [],
      }),
      (progress: ScanProgress) => totals.push(progress.total),
    );
    expect(Math.max(...totals)).toBeLessThanOrEqual(MAX_SCAN_PROBES);
  });
});

describe('a stopped scan in the report', () => {
  it('shows the notes and finds no issues only up to the last width checked', () => {
    const html = buildReportHtml(
      {
        url: 'https://example.com/',
        title: 'Example',
        created: new Date('2026-10-16T10:00:00Z'),
        version: '0.4.0',
        language: 'en',
        cards: [],
        scan: {
          from: 320,
          to: 1920,
          checkedTo: 480,
          notes: ['Stopped early: only the widths from 320 to 480 px were checked. <b>'],
          findings: [],
        },
      },
      t,
    );
    expect(html).toContain(
      '<p class="muted">Stopped early: only the widths from 320 to 480 px were checked. &lt;b&gt;</p>',
    );
    expect(html).toContain('No issues from 320 to 480 px.');
  });
});
