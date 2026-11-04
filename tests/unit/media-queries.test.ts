import { describe, expect, it } from 'vitest';
import { mediaQueryEdges } from '../../src/agent/page-utils';
import type { MediaQueryReport } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import {
  breakpointProblems,
  mediaBreakpoints,
  mediaMarkdown,
  mediaProblems,
  mergeMediaRows,
  problemWidths,
  unreadableSheets,
  widthRanges,
} from '../../src/state/media-queries';

const t = createTranslator('en');

describe('widthRanges', () => {
  it('reads min-width and max-width in px, em and rem', () => {
    expect(widthRanges('(min-width: 768px)')).toEqual([{ min: 768, max: null }]);
    expect(widthRanges('(max-width: 767px)')).toEqual([{ min: null, max: 767 }]);
    expect(widthRanges('(min-width: 48em)')).toEqual([{ min: 768, max: null }]);
    expect(widthRanges('(max-width: 40rem)')).toEqual([{ min: null, max: 640 }]);
    expect(widthRanges('(MIN-WIDTH: 64EM)')).toEqual([{ min: 1024, max: null }]);
    expect(widthRanges('(min-width:.5em)')).toEqual([{ min: 8, max: null }]);
  });

  it('rounds fractional widths to the whole pixels where the query applies', () => {
    expect(widthRanges('(max-width: 767.98px)')).toEqual([{ min: null, max: 767 }]);
    expect(widthRanges('(min-width: 768.02px)')).toEqual([{ min: 769, max: null }]);
    expect(widthRanges('(max-width: 47.99875em)')).toEqual([{ min: null, max: 767 }]);
  });

  it('reads range syntax, strict and inclusive, from either side', () => {
    expect(widthRanges('(width >= 768px)')).toEqual([{ min: 768, max: null }]);
    expect(widthRanges('(width > 768px)')).toEqual([{ min: 769, max: null }]);
    expect(widthRanges('(width < 768px)')).toEqual([{ min: null, max: 767 }]);
    expect(widthRanges('(width <= 768px)')).toEqual([{ min: null, max: 768 }]);
    expect(widthRanges('(768px <= width)')).toEqual([{ min: 768, max: null }]);
    expect(widthRanges('(768px < width)')).toEqual([{ min: 769, max: null }]);
    expect(widthRanges('(768px > width)')).toEqual([{ min: null, max: 767 }]);
    expect(widthRanges('(400px <= width < 800px)')).toEqual([{ min: 400, max: 799 }]);
    expect(widthRanges('(25em<width<=50em)')).toEqual([{ min: 401, max: 800 }]);
    expect(widthRanges('(width < 767.5px)')).toEqual([{ min: null, max: 767 }]);
    expect(widthRanges('(width > 767.5px)')).toEqual([{ min: 768, max: null }]);
  });

  it('reads an exact width', () => {
    expect(widthRanges('(width: 768px)')).toEqual([{ min: 768, max: 768 }]);
  });

  it('combines conditions joined with and, and media types that apply on screens', () => {
    expect(widthRanges('(min-width: 768px) and (max-width: 1023.98px)')).toEqual([{ min: 768, max: 1023 }]);
    expect(widthRanges('only screen and (max-width: 600px)')).toEqual([{ min: null, max: 600 }]);
    expect(widthRanges('screen and (min-width: 40em)')).toEqual([{ min: 640, max: null }]);
    expect(widthRanges('all and (width >= 1280px)')).toEqual([{ min: 1280, max: null }]);
    expect(widthRanges('(width >= 600px) and (width <= 900px)')).toEqual([{ min: 600, max: 900 }]);
  });

  it('keeps the width of a query that has other conditions too', () => {
    expect(widthRanges('(min-width: 768px) and (hover: hover)')).toEqual([{ min: 768, max: null }]);
    expect(widthRanges('(orientation: landscape) and (max-width: 900px)')).toEqual([{ min: null, max: 900 }]);
    expect(widthRanges('(max-width: 600px) and (min-height: 400px)')).toEqual([{ min: null, max: 600 }]);
  });

  it('gives one range per query of a comma-separated list', () => {
    expect(widthRanges('(max-width: 599px), (min-width: 1200px)')).toEqual([
      { min: null, max: 599 },
      { min: 1200, max: null },
    ]);
  });

  it('treats a min-width of 0 as no bound, and leaves out queries that never apply', () => {
    expect(widthRanges('(min-width: 0) and (max-width: 767px)')).toEqual([{ min: null, max: 767 }]);
    expect(widthRanges('(min-width: 0px)')).toBeNull();
    expect(widthRanges('(min-width: 800px) and (max-width: 600px)')).toEqual([]);
    expect(widthRanges('(min-width: 800px) and (max-width: 600px), (min-width: 1200px)')).toEqual([
      { min: 1200, max: null },
    ]);
  });

  it('says nothing about queries without a width condition', () => {
    expect(widthRanges('(prefers-color-scheme: dark)')).toBeNull();
    expect(widthRanges('(hover: hover) and (pointer: fine)')).toBeNull();
    expect(widthRanges('screen')).toBeNull();
    expect(widthRanges('print')).toBeNull();
    expect(widthRanges('')).toBeNull();
    expect(widthRanges('(width)')).toBeNull();
    expect(widthRanges('(min-device-width: 768px)')).toBeNull();
    expect(widthRanges('(max-height: 600px)')).toBeNull();
  });

  it('says nothing about not, or, other media types and widths it can’t read', () => {
    expect(widthRanges('not all and (min-width: 768px)')).toBeNull();
    expect(widthRanges('not screen and (max-width: 600px)')).toBeNull();
    expect(widthRanges('(min-width: 768px) or (max-width: 300px)')).toBeNull();
    expect(widthRanges('(not (min-width: 768px))')).toBeNull();
    expect(widthRanges('print and (min-width: 768px)')).toBeNull();
    expect(widthRanges('(max-width: 600px), print')).toBeNull();
    expect(widthRanges('(max-width: 50vw)')).toBeNull();
    expect(widthRanges('(max-width: calc(600px + 2em))')).toBeNull();
    expect(widthRanges('(max-width: 600)')).toBeNull();
    expect(widthRanges('(min-width: 768px) and')).toBeNull();
    expect(widthRanges('(min-width: 768px')).toBeNull();
    // A nested condition about something else leaves the width as it is.
    expect(widthRanges('(min-width: 768px) and (not (hover: none))')).toEqual([{ min: 768, max: null }]);
  });

  it('agrees with the breakpoints the agent reports', () => {
    for (const text of ['(max-width: 767.98px)', '(min-width: 48em)', '(400px <= width < 800px)', '(width > 768px)']) {
      const edges = (widthRanges(text) ?? []).flatMap((range) => [
        ...(range.min === null ? [] : [range.min]),
        ...(range.max === null ? [] : [range.max + 1]),
      ]);
      expect(
        edges.sort((a, b) => a - b),
        text,
      ).toEqual(mediaQueryEdges(text));
    }
  });
});

describe('breakpointProblems', () => {
  it('finds a gap between a max-width and a min-width', () => {
    expect(breakpointProblems(['(max-width: 767px)', '(min-width: 769px)'])).toEqual([
      { type: 'gap', from: 768, to: 768, below: '(max-width: 767px)', above: '(min-width: 769px)' },
    ]);
    expect(breakpointProblems(['(max-width: 767px)', '(min-width: 771px)'])).toEqual([
      { type: 'gap', from: 768, to: 770, below: '(max-width: 767px)', above: '(min-width: 771px)' },
    ]);
  });

  it('finds an overlap where both apply', () => {
    expect(breakpointProblems(['(min-width: 768px)', '(max-width: 768px)'])).toEqual([
      { type: 'overlap', from: 768, to: 768, below: '(max-width: 768px)', above: '(min-width: 768px)' },
    ]);
    expect(breakpointProblems(['(max-width: 50em)', '(width >= 798px)'])).toEqual([
      { type: 'overlap', from: 798, to: 800, below: '(max-width: 50em)', above: '(width >= 798px)' },
    ]);
  });

  it('accepts queries that meet exactly, and leaves out pairs more than 4 px apart', () => {
    expect(breakpointProblems(['(max-width: 767.98px)', '(min-width: 768px)'])).toEqual([]);
    expect(breakpointProblems(['(width < 768px)', '(width >= 768px)'])).toEqual([]);
    expect(breakpointProblems(['(max-width: 767px)', '(min-width: 772px)'])).toEqual([]);
    expect(breakpointProblems(['(max-width: 773px)', '(min-width: 768px)'])).toEqual([]);
    expect(breakpointProblems(['(max-width: 772px)', '(min-width: 768px)'])).toHaveLength(1);
    expect(breakpointProblems(['(max-width: 639px)', '(min-width: 1024px)'])).toEqual([]);
  });

  it('only compares queries with one range and one bound', () => {
    expect(
      breakpointProblems([
        '(min-width: 600px) and (max-width: 767px)',
        '(min-width: 769px)',
        '(max-width: 600px), (min-width: 900px)',
        '(prefers-color-scheme: dark)',
        'print and (max-width: 767px)',
      ]),
    ).toEqual([]);
  });

  it('dedupes by kind and widths, and sorts by width', () => {
    const problems = breakpointProblems([
      '(max-width: 1024px)',
      '(min-width: 1024px)',
      '(max-width: 767px)',
      'screen and (max-width: 767px)',
      '(min-width: 769px)',
      '(max-width: 767px)',
    ]);
    expect(problems.map(({ type, from, to }) => [type, from, to])).toEqual([
      ['gap', 768, 768],
      ['overlap', 1024, 1024],
    ]);
    expect(problems[0]).toMatchObject({ below: '(max-width: 767px)', above: '(min-width: 769px)' });
  });

  it('writes the widths as one or a range', () => {
    expect(problemWidths({ from: 768, to: 768 }, t)).toBe('768 px');
    expect(problemWidths({ from: 768, to: 770 }, t)).toBe('768–770 px');
  });
});

const report = (queries: MediaQueryReport['queries'], unreadable = 0): MediaQueryReport => ({ queries, unreadable });

const phone = report(
  [
    { text: '(min-width: 768px)', kind: 'media', rules: 40, matches: false },
    { text: '(prefers-color-scheme: dark)', kind: 'media', rules: 12, matches: false },
    { text: '(max-width: 767px)', kind: 'media', rules: 20, matches: true },
    { text: '(min-width: 400px)', kind: 'container', rules: 3, matches: null },
    { text: '(min-width: 769px)', kind: 'media', rules: 5, matches: false },
  ],
  1,
);
const desktop = report([
  { text: '(min-width: 768px)', kind: 'media', rules: 42, matches: true },
  { text: '(max-width: 767px)', kind: 'media', rules: 20, matches: false },
  { text: '(min-width: 769px)', kind: 'media', rules: 5, matches: true },
  { text: '(hover: hover)', kind: 'media', rules: 8, matches: true },
]);

describe('mergeMediaRows', () => {
  const rows = mergeMediaRows([
    { id: 'p', report: phone },
    { id: 'd', report: desktop },
    { id: 'x', report: null },
    { id: 'y', report: undefined },
  ]);

  it('lists each query once: width queries by breakpoint, then the others', () => {
    expect(rows.map((row) => row.text)).toEqual([
      '(max-width: 767px)',
      '(min-width: 768px)',
      '(min-width: 769px)',
      '(prefers-color-scheme: dark)',
      '(hover: hover)',
      '(min-width: 400px)',
    ]);
    expect(rows.map((row) => row.kind)).toEqual(['media', 'media', 'media', 'media', 'media', 'container']);
  });

  it('keeps the most rules, the width ranges and where each applies', () => {
    const min768 = rows.find((row) => row.text === '(min-width: 768px)')!;
    expect(min768.rules).toBe(42);
    expect(min768.ranges).toEqual([{ min: 768, max: null }]);
    expect(min768.matches).toEqual({ p: false, d: true });
    // A preview without a query doesn't use it; one not measured isn't listed.
    expect(rows.find((row) => row.text === '(hover: hover)')!.matches).toEqual({ p: false, d: true });
    const container = rows.find((row) => row.kind === 'container')!;
    expect(container.ranges).toBeNull();
    expect(container.matches).toEqual({ p: null, d: null });
  });

  it('counts breakpoints, problems and unreadable sheets', () => {
    expect(mediaBreakpoints(rows)).toEqual([768, 769]);
    expect(mediaProblems(rows)).toEqual([
      { type: 'gap', from: 768, to: 768, below: '(max-width: 767px)', above: '(min-width: 769px)' },
    ]);
    expect(unreadableSheets([phone, desktop, null, undefined])).toBe(1);
    expect(unreadableSheets([])).toBe(0);
  });

  it('orders the queries for narrower windows first at the same width', () => {
    const merged = mergeMediaRows([
      {
        id: 'a',
        report: report([
          { text: '(min-width: 1024px)', kind: 'media', rules: 1, matches: false },
          { text: '(min-width: 640px) and (max-width: 1023px)', kind: 'media', rules: 1, matches: true },
          { text: '(min-width: 640px)', kind: 'media', rules: 1, matches: true },
          { text: '(max-width: 639px)', kind: 'media', rules: 1, matches: false },
        ]),
      },
    ]);
    expect(merged.map((row) => row.text)).toEqual([
      '(max-width: 639px)',
      '(min-width: 640px)',
      '(min-width: 640px) and (max-width: 1023px)',
      '(min-width: 1024px)',
    ]);
  });
});

describe('mediaMarkdown', () => {
  const columns = [
    { id: 'p', name: 'Phone', width: 390, height: 844, media: phone },
    { id: 'd', name: 'Desktop', width: 1440, height: 900, media: desktop },
    { id: 'x', name: 'Tablet', width: 820, height: 1180, media: null },
  ];

  it('writes a table with every query in every preview, then the gaps and overlaps', () => {
    const markdown = mediaMarkdown('https://example.com/', columns, t);
    expect(markdown).toContain('**Media queries** · https://example.com/');
    expect(markdown).toContain('| Query | Rules | Phone (390px) | Desktop (1440px) | Tablet (820px) |');
    expect(markdown).toContain('| `(max-width: 767px)` | 20 | ✓ | – | — |');
    expect(markdown).toContain('| `(min-width: 768px)` | 42 | – | ✓ | — |');
    expect(markdown).toContain('| `@container (min-width: 400px)` | 3 | — | — | — |');
    expect(markdown).toContain('**Possible breakpoint mistakes**');
    expect(markdown).toContain(
      '- Gap at 768 px · Neither query applies at these widths: `(max-width: 767px)` · `(min-width: 769px)`',
    );
    expect(markdown).toContain('Container queries (—) depend on the size of their container');
    expect(markdown).toContain('1 stylesheet from another site can’t be read');
    expect(markdown.endsWith('\n')).toBe(true);
  });

  it('escapes pipes and says when there are no queries', () => {
    const pipe = report([{ text: '(min-width: 1px) | x', kind: 'media', rules: 1, matches: true }]);
    expect(mediaMarkdown('p', [{ id: 'a', name: 'A', width: 1, height: 1, media: pipe }], t)).toContain(
      '`(min-width: 1px) \\| x`',
    );
    expect(mediaMarkdown('p', [{ id: 'a', name: 'A', width: 1, height: 1, media: report([]) }], t)).toBe(
      '**Media queries** · p\n\nThis page’s stylesheets have no media queries.\n',
    );
  });

  it('leaves out the problems and notes when there are none', () => {
    const clean = report([
      { text: '(max-width: 767.98px)', kind: 'media', rules: 4, matches: false },
      { text: '(min-width: 768px)', kind: 'media', rules: 9, matches: true },
    ]);
    const markdown = mediaMarkdown('p', [{ id: 'd', name: 'Desktop', width: 1440, height: 900, media: clean }], t);
    expect(markdown).toContain('| `(max-width: 767.98px)` | 4 | – |');
    expect(markdown).not.toContain('Possible breakpoint mistakes');
    expect(markdown).not.toContain('Container queries');
    expect(markdown).not.toContain('can’t be read');
  });
});
