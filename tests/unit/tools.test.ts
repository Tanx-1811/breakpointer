import { describe, expect, it } from 'vitest';
import type { CheckReport } from '../../src/agent/protocol';
import { gridColumnsFor } from '../../src/components/GridOverlay/GridOverlay';
import { breakpointEdges, breakpointFor } from '../../src/data/breakpoints';
import { createTranslator } from '../../src/i18n/translate';
import { frameName, parseFrameName } from '../../src/services/frame-agents';
import { defaultSettings, parseSettings } from '../../src/services/storage';
import { suggestBreakpoint, validateBreakpoints } from '../../src/state/breakpoints';
import { issueDetail } from '../../src/state/checks';
import { isOneTimeUrl, pageOf } from '../../src/state/follow';
import { buildReportHtml, escapeHtml, type ReportCard } from '../../src/state/report';
import { settingsReducer } from '../../src/state/settings-reducer';
import { createViewport, rotateVisible } from '../../src/state/viewports';
import { MAX_CUSTOM_BREAKPOINTS, MAX_SAVED_PAGES } from '../../src/utils/constants';
import { shortHash } from '../../src/utils/hash';

const t = createTranslator('en');
const custom = [
  { name: 'tablet', min: 700 },
  { name: 'desk', min: 1100 },
];

describe('custom breakpoints', () => {
  it('labels widths with the custom list', () => {
    expect(breakpointFor('custom', 360, custom)).toBe('base');
    expect(breakpointFor('custom', 700, custom)).toBe('tablet');
    expect(breakpointFor('custom', 1440, custom)).toBe('desk');
    expect(breakpointFor('custom', 900, [])).toBe('base');
    expect(breakpointFor('none', 900, custom)).toBeNull();
  });

  it('validates rows: names, unique widths, limits', () => {
    expect(
      validateBreakpoints([
        { name: ' lg ', min: '1024' },
        { name: 'sm', min: '640' },
      ]),
    ).toEqual([
      { name: 'sm', min: 640 },
      { name: 'lg', min: 1024 },
    ]);
    expect(validateBreakpoints([])).toEqual([]);
    for (const rows of [
      [{ name: '', min: '640' }],
      [{ name: 'sm', min: '' }],
      [{ name: 'sm', min: '64.5' }],
      [{ name: 'sm', min: '100' }],
      [{ name: 'sm', min: '5000' }],
      [{ name: 'a-very-long-name', min: '640' }],
      [
        { name: 'sm', min: '640' },
        { name: 'md', min: '640' },
      ],
      [
        { name: 'sm', min: '640' },
        { name: 'SM', min: '768' },
      ],
    ]) {
      expect(validateBreakpoints(rows)).toBeNull();
    }
    const tooMany = Array.from({ length: MAX_CUSTOM_BREAKPOINTS + 1 }, (_, i) => ({
      name: `b${i}`,
      min: `${300 + i}`,
    }));
    expect(validateBreakpoints(tooMany)).toBeNull();
  });

  it('suggests a new row with an unused name and width', () => {
    expect(suggestBreakpoint([])).toEqual({ name: 'bp1', min: 640 });
    const next = suggestBreakpoint([
      { name: 'bp2', min: 640 },
      { name: 'x', min: 3800 },
    ]);
    expect(next.name).toBe('bp3');
    expect(next.min).toBeGreaterThanOrEqual(200);
    expect([640, 3800]).not.toContain(next.min);
  });

  it('parses stored lists defensively', () => {
    const settings = parseSettings({
      customBreakpoints: [
        { name: 'md', min: 768 },
        { name: 'MD', min: 900 },
        { name: 'dup', min: 768 },
        { name: '  ', min: 500 },
        { name: 'sm', min: 640.4 },
        'junk',
      ],
    });
    expect(settings.customBreakpoints).toEqual([
      { name: 'sm', min: 640 },
      { name: 'md', min: 768 },
    ]);
    expect(parseSettings({ customBreakpoints: 'x' }).customBreakpoints).toEqual(defaultSettings().customBreakpoints);
  });
});

describe('breakpoint edges', () => {
  it('puts a viewport on both sides of each breakpoint', () => {
    const edges = breakpointEdges('tailwind', [], 8);
    expect(edges.map((edge) => edge.width)).toEqual([639, 640, 767, 768, 1023, 1024, 1279, 1280]);
    expect(edges[0]!.name).toBe('< sm · 639');
    expect(edges[1]!.name).toBe('sm · 640');
  });

  it('uses Tailwind when labels are off, respects the limit and the minimum width', () => {
    expect(breakpointEdges('none', [], 4).map((edge) => edge.width)).toEqual([639, 640, 767, 768]);
    expect(breakpointEdges('bootstrap', [], 3).map((edge) => edge.width)).toEqual([575, 576]);
    expect(breakpointEdges('custom', [{ name: 'tiny', min: 200 }], 8)).toEqual([{ name: 'tiny · 200', width: 200 }]);
    expect(breakpointEdges('custom', [], 8)).toEqual([]);
  });
});

describe('rotate all', () => {
  it('rotates visible, non-square viewports only', () => {
    const phone = createViewport({ name: 'Phone', width: 375, height: 812 });
    const square = createViewport({ name: 'Square', width: 600, height: 600 });
    const hidden = { ...createViewport({ name: 'Hidden', width: 1280, height: 800 }), hidden: true };
    const [a, b, c] = rotateVisible([phone, square, hidden]);
    expect(a).toMatchObject({ width: 812, height: 375, orientation: 'landscape' });
    expect(b).toBe(square);
    expect(c).toBe(hidden);
  });
});

describe('grid', () => {
  it('picks 4 / 8 / 12 columns automatically', () => {
    expect(gridColumnsFor('auto', 375)).toBe(4);
    expect(gridColumnsFor('auto', 600)).toBe(8);
    expect(gridColumnsFor('auto', 1023)).toBe(8);
    expect(gridColumnsFor('auto', 1024)).toBe(12);
    expect(gridColumnsFor(6, 1440)).toBe(6);
  });

  it('sanitizes stored grid settings', () => {
    expect(parseSettings({ grid: { show: true, columns: 7, gutter: -4, margin: 999, baseline: 5 } }).grid).toEqual({
      show: true,
      columns: 'auto',
      gutter: 0,
      margin: 200,
      // Only the offered baseline steps are kept.
      baseline: 0,
    });
    expect(parseSettings({ grid: { baseline: 8 } }).grid.baseline).toBe(8);
    expect(parseSettings({ grid: { columns: 12, gutter: 32.6 } }).grid).toMatchObject({
      show: false,
      columns: 12,
      gutter: 33,
    });
  });
});

describe('tool settings', () => {
  it('defaults sync and checks on, and keeps them off once turned off', () => {
    const defaults = parseSettings(undefined);
    expect(defaults.sync).toEqual({ scroll: true, navigation: true, interactions: false });
    expect(defaults.checks).toBe(true);
    const off = parseSettings({ sync: { scroll: false, navigation: false }, checks: false });
    expect(off.sync).toEqual({ scroll: false, navigation: false, interactions: false });
    expect(off.checks).toBe(false);
  });

  it('updates sync, grid and checks partially', () => {
    let state = defaultSettings();
    state = settingsReducer(state, { type: 'setSync', sync: { scroll: false } });
    expect(state.sync).toEqual({ scroll: false, navigation: true, interactions: false });
    state = settingsReducer(state, { type: 'setGrid', grid: { show: true } });
    expect(state.grid).toMatchObject({ show: true, columns: 'auto' });
    state = settingsReducer(state, { type: 'setChecks', checks: false });
    expect(state.checks).toBe(false);
    state = settingsReducer(state, { type: 'setCustomBreakpoints', breakpoints: custom });
    expect(state.customBreakpoints).toEqual(custom);
  });
});

describe('saved pages', () => {
  it('stars and unstars pages, newest first, up to the limit', () => {
    let state = defaultSettings();
    state = settingsReducer(state, { type: 'toggleSavedPage', url: 'https://a.example/' });
    state = settingsReducer(state, { type: 'toggleSavedPage', url: 'https://b.example/' });
    expect(state.savedPages).toEqual(['https://b.example/', 'https://a.example/']);
    state = settingsReducer(state, { type: 'toggleSavedPage', url: 'https://b.example/' });
    expect(state.savedPages).toEqual(['https://a.example/']);
    state = settingsReducer(state, { type: 'removeSavedPage', url: 'https://a.example/' });
    expect(state.savedPages).toEqual([]);
    for (let i = 0; i < MAX_SAVED_PAGES + 5; i += 1)
      state = settingsReducer(state, { type: 'toggleSavedPage', url: `https://site${i}.example/` });
    expect(state.savedPages).toHaveLength(MAX_SAVED_PAGES);
    expect(state.savedPages[0]).toBe(`https://site${MAX_SAVED_PAGES + 4}.example/`);
  });

  it('keeps only safe, unique web addresses from storage', () => {
    const settings = parseSettings({
      savedPages: ['https://ok.example/', 'javascript:alert(1)', 'https://ok.example/', 42, 'http://x.test/a'],
    });
    expect(settings.savedPages).toEqual(['https://ok.example/', 'http://x.test/a']);
  });
});

describe('synced navigation', () => {
  it('ignores fragments and never follows one-time links', () => {
    expect(pageOf('https://a.example/x#top')).toBe('https://a.example/x');
    for (const url of [
      'https://app.example/callback?code=abc&state=xyz',
      'https://app.example/#access_token=abc&token_type=bearer',
      'https://shop.example/reset?Token=1',
      'https://cdn.example/file?X-Amz-Signature=1&signature=2',
      'not a url',
    ])
      expect(isOneTimeUrl(url)).toBe(true);
    for (const url of [
      'https://a.example/pricing?plan=pro#faq',
      'https://a.example/blog/code-review',
      'https://a.example/#key-ideas',
    ])
      expect(isOneTimeUrl(url)).toBe(false);
  });
});

describe('stored ids', () => {
  it('replaces ids that could break selectors or frame names', () => {
    const settings = parseSettings({
      viewports: [
        { id: 'ok_id-1', name: 'A', width: 375, height: 667 },
        { id: 'x:y', name: 'B', width: 375, height: 667 },
        { id: 'a"]b', name: 'C', width: 375, height: 667 },
      ],
    });
    const [a, b, c] = settings.viewports.map((vp) => vp.id);
    expect(a).toBe('ok_id-1');
    expect(b).toMatch(/^[\w-]+$/);
    expect(c).toMatch(/^[\w-]+$/);
    expect(b).not.toBe('x:y');
  });
});

describe('frame names', () => {
  it('ties a frame to its card and generation', () => {
    const name = frameName('card-1', shortHash('https://example.com/#0.0'));
    expect(parseFrameName(name)).toEqual({ cardId: 'card-1', generation: shortHash('https://example.com/#0.0') });
    expect(parseFrameName('some-page-name')).toBeNull();
    expect(shortHash('a')).toBe(shortHash('a'));
    expect(shortHash('a')).not.toBe(shortHash('b'));
  });
});

const report: CheckReport = {
  width: 375,
  issues: [
    { kind: 'overflow', count: 1, detail: '120px', samples: [{ selector: 'div.hero > <img>', detail: '+120px' }] },
    { kind: 'viewport-meta', count: 1, detail: '', samples: [] },
    { kind: 'small-text', count: 3, samples: [] },
  ],
};

describe('responsive check text', () => {
  it('explains each issue', () => {
    expect(issueDetail(report.issues[0]!, t)).toBe('The page scrolls sideways by 120px.');
    expect(issueDetail(report.issues[1]!, t)).toContain('<meta name="viewport"');
    expect(issueDetail({ kind: 'viewport-meta', count: 1, detail: 'width=1024', samples: [] }, t)).toContain(
      'width=1024',
    );
    expect(issueDetail(report.issues[2]!, t)).toBe('3 elements');
    expect(issueDetail({ kind: 'tap-targets', count: 1, samples: [] }, t)).toBe('1 element');
  });
});

describe('report', () => {
  const card = (patch: Partial<ReportCard>): ReportCard => ({
    name: 'Phone',
    width: 375,
    height: 812,
    zoom: 0.5,
    breakpoint: 'base',
    image: null,
    checks: null,
    ...patch,
  });

  it('escapes text', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('builds a self-contained page with every viewport and its issues', () => {
    const html = buildReportHtml(
      {
        url: 'https://example.com/?q=<b>',
        title: 'Shop <Home>',
        created: new Date(2026, 9, 13, 9, 30),
        version: '0.2.0',
        language: 'en',
        cards: [
          card({ name: '<script>alert(1)</script>', checks: report, image: 'data:image/jpeg;base64,AAAA' }),
          card({ name: 'Desktop', width: 1440, height: 900, checks: { width: 1440, issues: [] } }),
          card({ name: 'Unchecked', image: 'javascript:alert(1)' }),
        ],
      },
      t,
    );
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Shop &lt;Home&gt;');
    expect(html).toContain('href="https://example.com/?q=&lt;b&gt;"');
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('div.hero &gt; &lt;img&gt;');
    expect(html).toContain('Content wider than the screen');
    expect(html).toContain('No issues found');
    expect(html).toContain('Not checked');
    expect(html).toContain('⚠ 3');
    expect(html).toContain('id="vp-3"');
  });

  it('is translated', () => {
    const html = buildReportHtml(
      {
        url: 'https://example.com/',
        title: '',
        created: new Date(),
        version: '0.2.0',
        language: 'vi',
        cards: [card({})],
      },
      createTranslator('vi'),
    );
    expect(html).toContain('<html lang="vi">');
    expect(html).toContain('Báo cáo responsive');
    expect(html).toContain('<h1>https://example.com/</h1>');
  });
});
