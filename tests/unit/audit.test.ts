import { describe, expect, it } from 'vitest';
import {
  cumulativeLayoutShift,
  cutOff,
  distributeTracks,
  firstFontFamily,
  formatShift,
  gridTracks,
  isLargeText,
  isVectorImage,
} from '../../src/agent/page-utils';
import { CHECK_KINDS, type CheckReport, type PageStats } from '../../src/agent/protocol';
import { shortcutFor } from '../../src/hooks/useShortcuts';
import { createTranslator } from '../../src/i18n/translate';
import { defaultSettings, parseSettings } from '../../src/services/storage';
import {
  formatBytes,
  formatMegapixels,
  formatMs,
  formatStat,
  groupIssues,
  imageDensityRatio,
  issueCell,
  issuesMarkdown,
  statWarning,
  statsMarkdown,
  typeMarkdown,
  typeRows,
  typeValue,
} from '../../src/state/audit';
import { CHECK_HINT_KEYS, CHECK_KIND_KEYS, issueDetail, issueValue, withoutKinds } from '../../src/state/checks';
import { settingsReducer } from '../../src/state/settings-reducer';
import { buildCommands, type CommandActions, type CommandContext } from '../../src/viewer/commands';

const t = createTranslator('en');
const vi = createTranslator('vi');

const key = (code: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key: '', code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...extra }) as
    Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>;

describe('layout shift score', () => {
  it('is the largest session window, as in Core Web Vitals', () => {
    // Two shifts 0.5 s apart form one window; one 3 s later starts another.
    expect(
      cumulativeLayoutShift([
        { startTime: 100, value: 0.05 },
        { startTime: 600, value: 0.04 },
        { startTime: 3600, value: 0.07 },
      ]),
    ).toEqual({ value: 0.09, window: [0, 1] });
    expect(cumulativeLayoutShift([])).toEqual({ value: 0, window: [] });
  });

  it('closes a window after 5 s even when shifts keep coming', () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({ startTime: index * 900, value: 0.01 }));
    const { value, window } = cumulativeLayoutShift(entries);
    // 0, 900 … 4500: six shifts fit in the first five seconds.
    expect(window).toEqual([0, 1, 2, 3, 4, 5]);
    expect(value).toBeCloseTo(0.06, 6);
  });

  it('is written with up to three decimals', () => {
    expect(formatShift(0.30219)).toBe('0.302');
    expect(formatShift(0.24)).toBe('0.24');
    expect(formatShift(0.1)).toBe('0.1');
  });
});

describe('page helpers for the new checks', () => {
  it('knows large text as WCAG defines it', () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.66, 600)).toBe(false);
    expect(isLargeText(23.9, 400)).toBe(false);
  });

  it('reads the tracks of a grid', () => {
    expect(gridTracks('200px [main-start] 186.5px 200px')).toEqual([200, 186.5, 200]);
    expect(gridTracks('none')).toBeNull();
    expect(gridTracks('subgrid [a] [b]')).toBeNull();
    expect(gridTracks('minmax(0px, 1fr)')).toBeNull();
    expect(gridTracks('')).toBeNull();
  });

  it('places tracks like justify-content and align-content', () => {
    expect(distributeTracks('normal', 100, 3)).toEqual([0, 0]);
    expect(distributeTracks('center', 100, 3)).toEqual([50, 0]);
    expect(distributeTracks('end', 100, 3)).toEqual([100, 0]);
    expect(distributeTracks('safe end', 100, 3)).toEqual([100, 0]);
    expect(distributeTracks('right', 100, 3)).toEqual([100, 0]);
    // In right-to-left, the physical left is the end.
    expect(distributeTracks('left', 100, 3, true)).toEqual([100, 0]);
    expect(distributeTracks('space-between', 100, 3)).toEqual([0, 50]);
    expect(distributeTracks('space-between', 100, 1)).toEqual([0, 0]);
    expect(distributeTracks('space-around', 90, 3)).toEqual([15, 30]);
    expect(distributeTracks('space-evenly', 100, 3)).toEqual([25, 25]);
    // Tracks that overflow their grid start at the start edge.
    expect(distributeTracks('center', -20, 3)).toEqual([0, 0]);
  });

  it('names the first font of a stack', () => {
    expect(firstFontFamily('"Inter Var", system-ui, sans-serif')).toBe('Inter Var');
    expect(firstFontFamily("'Segoe UI'")).toBe('Segoe UI');
    expect(firstFontFamily('system-ui')).toBe('system-ui');
  });

  it('measures text that a box cuts off, but not text fully outside it', () => {
    const box = { left: 0, top: 0, right: 100, bottom: 40 };
    expect(cutOff({ left: 10, top: 10, right: 90, bottom: 30 }, box)).toBeNull();
    expect(cutOff({ left: 10, top: 10, right: 260, bottom: 30 }, box)).toEqual({ x: 160, y: 0 });
    expect(cutOff({ left: 10, top: 30, right: 90, bottom: 52 }, box)).toEqual({ x: 0, y: 12 });
    // Another slide of a carousel, or lines past a "read more" cut: hidden on purpose.
    expect(cutOff({ left: 104, top: 10, right: 300, bottom: 30 }, box)).toBeNull();
    expect(cutOff({ left: 10, top: 40, right: 90, bottom: 60 }, box)).toBeNull();
  });

  it('knows vector images', () => {
    expect(isVectorImage('https://example.com/logo.svg')).toBe(true);
    expect(isVectorImage('https://example.com/logo.SVG?v=2')).toBe(true);
    expect(isVectorImage('data:image/svg+xml,%3Csvg%3E')).toBe(true);
    expect(isVectorImage('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
    expect(isVectorImage('https://example.com/photo.jpg')).toBe(false);
    expect(isVectorImage('https://example.com/svg/photo.png')).toBe(false);
  });
});

describe('check texts', () => {
  it('names and explains every check in both languages', () => {
    for (const kind of CHECK_KINDS) {
      expect(t(CHECK_KIND_KEYS[kind])).not.toBe(CHECK_KIND_KEYS[kind]);
      expect(vi(CHECK_HINT_KEYS[kind])).not.toBe(t(CHECK_HINT_KEYS[kind]));
    }
  });

  it('describes the new issues', () => {
    expect(issueDetail({ kind: 'low-contrast', count: 3, detail: '2.85', samples: [] }, t)).toBe(
      '3 elements · lowest 2.85:1 (AA needs 4.5:1, or 3:1 for large text)',
    );
    expect(issueDetail({ kind: 'low-contrast', count: 1, detail: '1.98', samples: [] }, t)).toBe(
      '1 element · 1.98:1 (AA needs 4.5:1, or 3:1 for large text)',
    );
    expect(issueDetail({ kind: 'layout-shift', count: 2, detail: '0.302', samples: [] }, t)).toContain(
      'Cumulative layout shift 0.302',
    );
    expect(issueDetail({ kind: 'clipped-text', count: 2, samples: [] }, t)).toBe('2 elements');
  });

  it('has short values for lists that name the check', () => {
    expect(issueValue({ kind: 'overflow', count: 1, detail: '184px', samples: [] }, t)).toBe('184px too wide');
    expect(issueValue({ kind: 'viewport-meta', count: 1, detail: '', samples: [] }, t)).toBe('Missing');
    expect(issueValue({ kind: 'viewport-meta', count: 1, detail: 'width=1024', samples: [] }, t)).toBe(
      '“width=1024”',
    );
    expect(issueValue({ kind: 'layout-shift', count: 4, detail: '0.24', samples: [] }, t)).toBe('CLS 0.24');
    expect(issueValue({ kind: 'low-contrast', count: 2, detail: '3.1', samples: [] }, t)).toBe('2 elements · 3.1:1');
    expect(issueValue({ kind: 'fixed-cover', count: 1, detail: '45%', samples: [] }, vi)).toBe('45% màn hình');
  });

  it('leaves out the checks switched off', () => {
    const report: CheckReport = {
      width: 375,
      issues: [
        { kind: 'overflow', count: 1, detail: '20px', samples: [] },
        { kind: 'low-contrast', count: 1, detail: '2.1', samples: [] },
      ],
    };
    expect(withoutKinds(report, [])).toBe(report);
    expect(withoutKinds(report, ['small-text'])).toBe(report);
    expect(withoutKinds(report, ['low-contrast'])?.issues.map((issue) => issue.kind)).toEqual(['overflow']);
    expect(withoutKinds(null, ['overflow'])).toBeNull();
  });
});

describe('checks switched off in Settings', () => {
  it('are read from storage as known checks only, in order', () => {
    expect(defaultSettings().disabledChecks).toEqual([]);
    expect(
      parseSettings({ disabledChecks: ['layout-shift', 'nonsense', 'overflow', 'overflow', 4] }).disabledChecks,
    ).toEqual(['overflow', 'layout-shift']);
    expect(parseSettings({ disabledChecks: 'overflow' }).disabledChecks).toEqual([]);
  });

  it('are switched one by one', () => {
    let state = defaultSettings();
    state = settingsReducer(state, { type: 'setCheckKind', kind: 'low-contrast', enabled: false });
    state = settingsReducer(state, { type: 'setCheckKind', kind: 'low-contrast', enabled: false });
    expect(state.disabledChecks).toEqual(['low-contrast']);
    state = settingsReducer(state, { type: 'setCheckKind', kind: 'low-contrast', enabled: true });
    expect(state.disabledChecks).toEqual([]);
  });
});

const columns = [
  { id: 'a', name: 'Phone', width: 375, height: 667 },
  { id: 'b', name: 'Tablet', width: 768, height: 1024 },
  { id: 'c', name: 'Laptop', width: 1366, height: 768 },
];

describe('audit: issues across previews', () => {
  const reports: (CheckReport | null)[] = [
    {
      width: 375,
      issues: [
        { kind: 'overflow', count: 1, detail: '184px', samples: [{ selector: 'div.hero' }] },
        { kind: 'low-contrast', count: 2, detail: '2.85', samples: [] },
      ],
    },
    { width: 768, issues: [{ kind: 'low-contrast', count: 1, detail: '2.85', samples: [] }] },
    null,
  ];
  const rows = columns.map((column, index) => ({ ...column, report: reports[index]! }));

  it('groups issues by kind in display order', () => {
    const groups = groupIssues(rows);
    expect(groups.map((group) => group.kind)).toEqual(['overflow', 'low-contrast']);
    expect(groups[1]!.hits.map((hit) => hit.column.name)).toEqual(['Phone', 'Tablet']);
  });

  it('writes short cells', () => {
    expect(issueCell({ kind: 'overflow', count: 1, detail: '184px', samples: [] })).toBe('+184px');
    expect(issueCell({ kind: 'low-contrast', count: 2, detail: '2.85', samples: [] })).toBe('2 · 2.85:1');
    expect(issueCell({ kind: 'layout-shift', count: 2, detail: '0.3', samples: [] })).toBe('CLS 0.3');
    expect(issueCell({ kind: 'viewport-meta', count: 1, samples: [] })).toBe('!');
    expect(issueCell({ kind: 'small-text', count: 7, samples: [] })).toBe('7');
  });

  it('copies every check as a Markdown table', () => {
    const markdown = issuesMarkdown('https://example.com/', rows, ['overflow', 'low-contrast', 'small-text'], t);
    expect(markdown).toBe(
      [
        '**Responsive checks** · https://example.com/',
        '',
        '| Check | Phone (375px) | Tablet (768px) | Laptop (1366px) |',
        '| --- | --- | --- | --- |',
        '| Content wider than the screen | ⚠ +184px | ✓ | — |',
        '| Low-contrast text | ⚠ 2 · 2.85:1 | ⚠ 1 · 2.85:1 | — |',
        '| Text smaller than 12px | ✓ | ✓ | — |',
        '',
      ].join('\n'),
    );
  });
});

const stats = (patch: Partial<PageStats>): PageStats => ({
  requests: 12,
  transferred: 1_480_000,
  unknownSize: 2,
  images: 4,
  imagePixels: 4_000_000,
  shownPixels: 250_000,
  dpr: 2,
  elements: 840,
  height: 3210,
  lcp: 1800,
  cls: 0.02,
  fonts: 3,
  ...patch,
});

describe('audit: page stats', () => {
  it('formats sizes, times and pixels for the language', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(18_400)).toBe('18 kB');
    expect(formatBytes(1_480_000)).toBe('1.5 MB');
    expect(formatBytes(1_480_000, 'vi')).toBe('1,5 MB');
    expect(formatMs(850)).toBe('850 ms');
    expect(formatMs(1830)).toBe('1.8 s');
    expect(formatMegapixels(3_100_000)).toBe('3.1 MP');
    expect(formatMegapixels(40_000)).toBe('< 0.1 MP');
    expect(formatMegapixels(0)).toBe('0.0 MP');
    expect(formatStat('lcp', stats({ lcp: null }))).toBe('—');
    expect(formatStat('height', stats({}), 'en')).toBe('3,210 px');
    expect(formatStat('cls', stats({ cls: 0.123 }))).toBe('0.12');
  });

  it('compares image files with what the screen needs', () => {
    // 4 MP for 0.25 MP shown is 4× the pixels per side; a 2× screen needs 2×.
    expect(imageDensityRatio(stats({}))).toBeCloseTo(2, 5);
    expect(imageDensityRatio(stats({ images: 0 }))).toBeNull();
    expect(statWarning(stats({ imagePixels: 9_000_000 }), 'imagePixels')).toBe(true);
    expect(statWarning(stats({}), 'imagePixels')).toBe(false);
  });

  it('flags Core Web Vitals that need improvement', () => {
    expect(statWarning(stats({ lcp: 2600 }), 'lcp')).toBe(true);
    expect(statWarning(stats({ lcp: 2500 }), 'lcp')).toBe(false);
    expect(statWarning(stats({ cls: 0.11 }), 'cls')).toBe(true);
    expect(statWarning(stats({ cls: 0.1 }), 'cls')).toBe(false);
    expect(statWarning(stats({ requests: 900 }), 'requests')).toBe(false);
  });

  it('copies the stats as a Markdown table', () => {
    const markdown = statsMarkdown(
      'https://example.com/',
      [
        { ...columns[0]!, stats: stats({ transferred: 480_000 }) },
        { ...columns[1]!, stats: null },
      ],
      t,
    );
    expect(markdown).toContain('| Metric | Phone (375px) | Tablet (768px) |');
    expect(markdown).toContain('| Page weight | 480 kB | — |');
    expect(markdown).toContain('| Largest contentful paint | 1.8 s | — |');
  });
});

describe('audit: type scale', () => {
  const sample = (tag: string, fontSize: number, lineHeight: number | null = null) => ({
    tag,
    count: 1,
    fontSize,
    lineHeight,
    fontWeight: '700',
    fontFamily: 'Inter',
  });

  it('writes a sample as size / line height · weight', () => {
    expect(typeValue(sample('h1', 32, 40))).toBe('32px / 40px · 700');
    expect(typeValue(sample('p', 15.996))).toBe('16px · 700');
  });

  it('lines up each kind of element and marks what changes', () => {
    const rows = typeRows([
      { ...columns[0]!, samples: [sample('p', 16, 24), sample('h1', 28, 34)] },
      { ...columns[1]!, samples: [sample('h1', 40, 48), sample('p', 16, 24)] },
      { ...columns[2]!, samples: null },
    ]);
    expect(rows.map((row) => row.tag)).toEqual(['h1', 'p']);
    expect(rows[0]!.changes).toBe(true);
    expect(rows[1]!.changes).toBe(false);
    expect(rows[0]!.samples[2]).toBeUndefined();
  });

  it('copies the type scale as a Markdown table', () => {
    const markdown = typeMarkdown(
      'https://example.com/',
      [
        { ...columns[0]!, samples: [sample('h1', 28, 34)] },
        { ...columns[1]!, samples: [sample('h1', 40, 48)] },
      ],
      t,
    );
    expect(markdown).toContain('| `h1` | 28px / 34px · 700 | 40px / 48px · 700 |');
  });
});

describe('audit: shortcut and commands', () => {
  it('E opens the audit', () => {
    expect(shortcutFor(key('KeyE'))).toBe('audit');
    expect(shortcutFor(key('KeyE', { metaKey: true }))).toBeNull();
  });

  it('the palette opens the audit on each tab', () => {
    const opened: (string | undefined)[] = [];
    const actions = new Proxy({} as CommandActions, {
      get: (_, name) => (name === 'audit' ? (tab?: string) => opened.push(tab ?? 'toggle') : () => {}),
    });
    const ctx: CommandContext = {
      t,
      en: t,
      settings: defaultSettings(),
      hasUrl: true,
      canAdd: true,
      focusedId: null,
      outlines: false,
      hideScrollbars: false,
      annotate: { images: false, tabOrder: false, layout: true },
      liveCss: false,
      inspecting: false,
      auditing: true,
      actions,
    };
    const commands = buildCommands(ctx);
    const audit = commands.find((command) => command.id === 'audit')!;
    expect(audit.checked).toBe(true);
    expect(audit.shortcut).toBe('E');
    commands.find((command) => command.id === 'audit-performance')!.run();
    commands.find((command) => command.id === 'audit-type')!.run();
    audit.run();
    expect(opened).toEqual(['performance', 'type', 'toggle']);
    expect(commands.find((command) => command.id === 'tool-gridFlex')?.checked).toBe(true);
  });
});
