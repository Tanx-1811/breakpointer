import { describe, expect, it } from 'vitest';
import type { CheckIssue } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import {
  MAX_SCAN_PROBES,
  SCAN_CARD_ID,
  coarseWidths,
  issueSignature,
  nearestSample,
  rangeText,
  rangesOf,
  scanFindings,
  scanMarkdown,
  scanWidths,
  validScanOptions,
  type ScanSample,
} from '../../src/state/scan';
import { compareCardId, isCompareCardId } from '../../src/state/compare';

const t = createTranslator('en');

/** A page that is 400px wide (it overflows below 399, as 1px is tolerated) and has tiny text below 768. */
function fakePage(width: number): ScanSample {
  const issues: CheckIssue[] = [];
  if (400 - width > 1) issues.push({ kind: 'overflow', count: 1, detail: `${400 - width}px`, samples: [] });
  if (width < 768) issues.push({ kind: 'small-text', count: 2, samples: [] });
  return { width, height: width < 768 ? 2400 : 1600, issues };
}

describe('width scan options', () => {
  it('accepts whole widths within the limits, the first below the second', () => {
    expect(validScanOptions({ from: 320, to: 1920, step: 16 })).not.toBeNull();
    expect(validScanOptions({ from: 1920, to: 320, step: 16 })).toBeNull();
    expect(validScanOptions({ from: 320, to: 320, step: 16 })).toBeNull();
    expect(validScanOptions({ from: 100, to: 800, step: 16 })).toBeNull();
    expect(validScanOptions({ from: 320.5, to: 800, step: 16 })).toBeNull();
    expect(validScanOptions({ from: 320, to: 800, step: 0 })).toBeNull();
  });

  it('checks every step of the first pass, both ends included', () => {
    expect(coarseWidths({ from: 320, to: 400, step: 32 })).toEqual([320, 352, 384, 400]);
    expect(coarseWidths({ from: 320, to: 384, step: 32 })).toEqual([320, 352, 384]);
  });

  it("uses a card id viewports can't have", () => {
    expect(SCAN_CARD_ID).toContain('~');
    expect(isCompareCardId(SCAN_CARD_ID)).toBe(false);
    expect(compareCardId('a')).not.toBe(SCAN_CARD_ID);
  });
});

describe('scanning every width', () => {
  it('finds where each issue starts and stops, to the pixel', async () => {
    const probed: number[] = [];
    const samples = await scanWidths({ from: 320, to: 900, step: 32 }, async (width) => {
      probed.push(width);
      return fakePage(width);
    });
    expect(samples.map((sample) => sample.width)).toEqual(
      [...samples.map((sample) => sample.width)].sort((a, b) => a - b),
    );
    expect(rangesOf(samples, 'overflow').map(({ from, to }) => [from, to])).toEqual([[320, 398]]);
    expect(rangesOf(samples, 'small-text').map(({ from, to }) => [from, to])).toEqual([[320, 767]]);
    // 20 widths in the first pass, then about log2(32) more for each of the two changes.
    expect(probed.length).toBeLessThanOrEqual(20 + 2 * 6);
    expect(new Set(probed).size).toBe(probed.length);
  });

  it('finds the worst width of a range', async () => {
    const samples = await scanWidths({ from: 320, to: 900, step: 32 }, async (width) => fakePage(width));
    const [overflow] = rangesOf(samples, 'overflow');
    expect(overflow!.peak.width).toBe(320);
    expect(overflow!.peak.issue.detail).toBe('80px');
  });

  it('reports its progress and can stop', async () => {
    const seen: number[] = [];
    let stop = false;
    const samples = await scanWidths(
      { from: 320, to: 900, step: 32 },
      async (width) => fakePage(width),
      (progress) => {
        seen.push(progress.done);
        if (progress.done === 5) stop = true;
      },
      () => stop,
    );
    expect(samples).toHaveLength(5);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('never checks more than its limit', async () => {
    let count = 0;
    // An issue that flips at every pixel: the scan gives up refining at the limit.
    await scanWidths({ from: 200, to: 3840, step: 4 }, async (width) => {
      count++;
      return { width, height: 100, issues: width % 2 ? [{ kind: 'overflow', count: 1, samples: [] }] : [] };
    });
    expect(count).toBeLessThanOrEqual(MAX_SCAN_PROBES);
  });

  it('fails when the preview does', async () => {
    await expect(
      scanWidths({ from: 320, to: 400, step: 32 }, async () => {
        throw new Error('No agent');
      }),
    ).rejects.toThrow('No agent');
  });
});

describe('scan results', () => {
  const samples = [320, 360, 398, 399, 767, 768, 900].map(fakePage);

  it('compares samples by their issues', () => {
    expect(issueSignature(fakePage(320))).toBe('overflow small-text');
    expect(issueSignature(fakePage(900))).toBe('');
  });

  it('lists the findings in the order of the checks', () => {
    expect(scanFindings(samples).map((finding) => finding.kind)).toEqual(['overflow', 'small-text']);
    expect(scanFindings([fakePage(900)])).toEqual([]);
  });

  it('writes ranges', () => {
    expect(rangeText({ from: 320, to: 398 }, t)).toBe('320–398 px');
    expect(rangeText({ from: 412, to: 412 }, t)).toBe('412 px');
  });

  it('finds the sample nearest to a width', () => {
    expect(nearestSample(samples, 370)?.width).toBe(360);
    expect(nearestSample(samples, 1000)?.width).toBe(900);
    expect(nearestSample([], 400)).toBeUndefined();
  });

  it('copies the scan as Markdown', () => {
    expect(scanMarkdown('https://example.com/', { from: 320, to: 900, step: 32 }, samples, t)).toBe(
      [
        '**Width scan** · https://example.com/ · 320–900 px',
        '',
        '| Check | Widths |',
        '| --- | --- |',
        '| Content wider than the screen | 320–398 px (+80px @ 320px) |',
        '| Text smaller than 12px | 320–767 px (2 @ 320px) |',
        '',
      ].join('\n'),
    );
    expect(scanMarkdown('https://example.com/', { from: 800, to: 900, step: 32 }, [fakePage(900)], t)).toContain(
      'No issues from 800 to 900 px.',
    );
  });
});
