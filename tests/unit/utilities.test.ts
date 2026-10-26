import { describe, expect, it, vi } from 'vitest';
import { mentionsReducedMotion, pseudoLocalize, swapReducedMotion } from '../../src/agent/page-utils';
import { shortcutFor } from '../../src/hooks/useShortcuts';
import { createTranslator } from '../../src/i18n/translate';
import { createSettingsExport, defaultSettings, parseSettings, parseSettingsImport } from '../../src/services/storage';
import { CHECK_KIND_KEYS, canHighlight, issueDetail } from '../../src/state/checks';
import {
  compareCardId,
  compareLabel,
  compareUrl,
  isCompareCardId,
  mirrorBack,
  parseCompareInput,
  swapCompare,
  viewportIdOf,
} from '../../src/state/compare';
import { contrastPasses, contrastRatio, formatRatio, parseColor, toHex } from '../../src/state/contrast';
import { comparisonMarkdown, type ComparisonLabels } from '../../src/state/inspector';
import { constrainToLine, edgeDistances, rectBetween, toPagePoint } from '../../src/state/measure';
import { settingsReducer } from '../../src/state/settings-reducer';
import { BLUR_PX, VISION_MATRICES, isVisionMode, visionFilter } from '../../src/state/vision';
import type { ElementInfo } from '../../src/agent/protocol';
import { MAX_CSS_SNIPPETS, MAX_SNIPPET_NAME } from '../../src/utils/constants';
import { buildCommands, type CommandActions, type CommandContext } from '../../src/viewer/commands';

const t = createTranslator('en');

describe('colour contrast', () => {
  it('reads hex and rgb() colours', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('1F2430')).toEqual({ r: 31, g: 36, b: 48, a: 1 });
    expect(parseColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 0.502 });
    expect(parseColor('rgb(31, 36, 48)')).toEqual({ r: 31, g: 36, b: 48, a: 1 });
    expect(parseColor('rgba(255 0 0 / 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(parseColor('rgba(0, 0, 0, .25)')).toEqual({ r: 0, g: 0, b: 0, a: 0.25 });
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    for (const bad of ['', 'red', '#12', '#12345', 'rgb(1, 2)', 'rgb(1, 2, 3, 4, 5)', 'rgb(a, b, c)'])
      expect(parseColor(bad)).toBeNull();
  });

  it('writes #rrggbb', () => {
    expect(toHex({ r: 31, g: 36, b: 48, a: 1 })).toBe('#1f2430');
    expect(toHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#000000');
  });

  it('computes WCAG contrast ratios', () => {
    const white = parseColor('#fff')!;
    const black = parseColor('#000')!;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    // #767676 on white is the classic "just passes AA" grey.
    expect(formatRatio(contrastRatio(parseColor('#767676')!, white))).toBe('4.54');
    // Translucent text is blended over the background first.
    expect(contrastRatio(parseColor('#00000080')!, white)).toBeLessThan(contrastRatio(black, white));
  });

  it('never rounds a ratio up past a threshold', () => {
    expect(formatRatio(4.499)).toBe('4.49');
    expect(formatRatio(4.5)).toBe('4.50');
    expect(formatRatio(21)).toBe('21.00');
    expect(contrastPasses(4.499).aaNormal).toBe(false);
    expect(contrastPasses(4.5)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true, ui: true });
    expect(contrastPasses(2.9)).toEqual({
      aaNormal: false,
      aaLarge: false,
      aaaNormal: false,
      aaaLarge: false,
      ui: false,
    });
  });
});

describe('vision simulation', () => {
  it('keeps white white and black black (each colour row sums to 1)', () => {
    for (const matrix of Object.values(VISION_MATRICES)) {
      expect(matrix).toHaveLength(20);
      for (const row of [0, 1, 2]) {
        const sum = matrix.slice(row * 5, row * 5 + 3).reduce((total, value) => total + value, 0);
        expect(sum).toBeCloseTo(1, 2);
      }
      expect(matrix.slice(15)).toEqual([0, 0, 0, 1, 0]);
    }
  });

  it('turns a mode into a CSS filter', () => {
    expect(visionFilter('none')).toBeNull();
    expect(visionFilter('blurred')).toBe(`blur(${BLUR_PX}px)`);
    expect(visionFilter('deuteranopia')).toBe('url(#bp-vision-deuteranopia)');
    expect(isVisionMode('tritanopia')).toBe(true);
    expect(isVisionMode('none')).toBe(true);
    expect(isVisionMode('sepia')).toBe(false);
  });
});

describe('measuring', () => {
  const viewport = { width: 375, height: 667 };

  it('converts screen points to page pixels through the zoom, inside the viewport', () => {
    expect(toPagePoint({ x: 50, y: 100 }, 0.5, viewport)).toEqual({ x: 100, y: 200 });
    expect(toPagePoint({ x: 33.4, y: 10 }, 1, viewport)).toEqual({ x: 33, y: 10 });
    expect(toPagePoint({ x: -20, y: 9999 }, 0.5, viewport)).toEqual({ x: 0, y: 667 });
  });

  it('measures whichever way the pointer was dragged', () => {
    expect(rectBetween({ x: 120, y: 80 }, { x: 20, y: 30 })).toEqual({ x: 20, y: 30, width: 100, height: 50 });
  });

  it('keeps a Shift-drag on one axis', () => {
    expect(constrainToLine({ x: 10, y: 10 }, { x: 110, y: 30 })).toEqual({ x: 110, y: 10 });
    expect(constrainToLine({ x: 10, y: 10 }, { x: 20, y: 90 })).toEqual({ x: 10, y: 90 });
  });

  it('reports the distance to every edge', () => {
    expect(edgeDistances({ x: 20, y: 30, width: 100, height: 50 }, viewport)).toEqual({
      left: 20,
      top: 30,
      right: 255,
      bottom: 587,
    });
  });
});

describe('comparing two addresses', () => {
  const mirror = { mode: 'mirror', origin: 'https://staging.example.com' } as const;
  const fixed = { mode: 'fixed', url: 'https://example.com/new' } as const;

  it('gives B previews their own card ids', () => {
    const id = compareCardId('default-mobile-m');
    expect(isCompareCardId(id)).toBe(true);
    expect(isCompareCardId('default-mobile-m')).toBe(false);
    expect(viewportIdOf(id)).toBe('default-mobile-m');
    expect(viewportIdOf('default-mobile-m')).toBe('default-mobile-m');
    // Viewport ids are letters, digits, _ and - only, so a B id never clashes with one.
    expect(/^[\w-]+$/.test(id)).toBe(false);
  });

  it('shows the same page on the other site, or one fixed address', () => {
    expect(compareUrl(mirror, 'https://example.com/shop?q=1#top')).toBe('https://staging.example.com/shop?q=1#top');
    expect(compareUrl(fixed, 'https://example.com/old')).toBe('https://example.com/new');
    expect(compareUrl(mirror, 'not a url')).toBeNull();
  });

  it('maps a page B moved to back to A’s site', () => {
    expect(mirrorBack(mirror, 'https://staging.example.com/cart', 'https://example.com/shop')).toBe(
      'https://example.com/cart',
    );
    expect(mirrorBack(mirror, 'https://elsewhere.com/cart', 'https://example.com')).toBeNull();
    expect(mirrorBack(fixed, 'https://example.com/cart', 'https://example.com')).toBeNull();
  });

  it('reads the address typed in the dialog', () => {
    expect(parseCompareInput('staging.example.com/whatever', 'mirror', 'https://example.com/')).toEqual({
      ok: true,
      target: { mode: 'mirror', origin: 'https://staging.example.com' },
    });
    expect(parseCompareInput('localhost:5173', 'mirror', null)).toEqual({
      ok: true,
      target: { mode: 'mirror', origin: 'http://localhost:5173' },
    });
    expect(parseCompareInput('example.com/b', 'fixed', 'https://example.com/a')).toEqual({
      ok: true,
      target: { mode: 'fixed', url: 'https://example.com/b' },
    });
    expect(parseCompareInput('', 'mirror', null)).toEqual({ ok: false, error: 'empty' });
    expect(parseCompareInput('ftp://example.com', 'mirror', null)).toEqual({
      ok: false,
      error: 'unsupported-scheme',
    });
    expect(parseCompareInput('example.com', 'mirror', 'https://example.com/shop')).toEqual({
      ok: false,
      error: 'same',
    });
  });

  it('swaps A and B', () => {
    expect(swapCompare(mirror, 'https://example.com/shop')).toEqual({
      page: 'https://staging.example.com/shop',
      target: { mode: 'mirror', origin: 'https://example.com' },
    });
    expect(swapCompare(fixed, 'https://example.com/old')).toEqual({
      page: 'https://example.com/new',
      target: { mode: 'fixed', url: 'https://example.com/old' },
    });
  });

  it('names the B side', () => {
    expect(compareLabel(mirror)).toBe('staging.example.com');
    expect(compareLabel({ mode: 'mirror', origin: 'http://localhost:5173' })).toBe('localhost:5173');
    expect(compareLabel(fixed)).toBe('example.com/new');
  });
});

describe('layout stress tests', () => {
  it('makes text about 40% longer, accented and in brackets', () => {
    const text = 'Settings and privacy';
    const result = pseudoLocalize(text);
    expect(result.startsWith('[')).toBe(true);
    expect(result.endsWith(']')).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(Math.ceil(text.length * 1.4));
    expect(result).toMatch(/Š/);
    expect(result).not.toMatch(/[a-z]/i);
  });

  it('grows short words too and keeps surrounding whitespace', () => {
    expect(pseudoLocalize('Go')).toBe('[Ĝöö]');
    expect(pseudoLocalize('Sign in')).toBe('[Šîîĝñ îñ]');
    expect(pseudoLocalize('  Next\n')).toBe('  [Ñééẋţ]\n');
    expect(pseudoLocalize('Hmm')).toMatch(/^\[Ĥɱɱ·+\]$/);
  });

  it('leaves text without letters alone', () => {
    for (const text of ['', '   ', '42', '© 2026 — 3.5%', '→']) expect(pseudoLocalize(text)).toBe(text);
  });

  it('answers prefers-reduced-motion queries the other way', () => {
    expect(swapReducedMotion('(prefers-reduced-motion: reduce)')).toBe('(prefers-reduced-motion: no-preference)');
    expect(swapReducedMotion('(prefers-reduced-motion:no-preference)')).toBe('(prefers-reduced-motion: reduce)');
    expect(swapReducedMotion('(prefers-reduced-motion)')).toBe('(prefers-reduced-motion: no-preference)');
    expect(swapReducedMotion('screen and (PREFERS-REDUCED-MOTION: REDUCE)')).toBe(
      'screen and (PREFERS-REDUCED-MOTION: no-preference)',
    );
    expect(swapReducedMotion('(min-width: 768px)')).toBe('(min-width: 768px)');
    expect(mentionsReducedMotion('not all and (prefers-reduced-motion)')).toBe(true);
    expect(mentionsReducedMotion('(prefers-color-scheme: dark)')).toBe(false);
  });
});

describe('inspector comparison table', () => {
  const info = (patch: Partial<ElementInfo>): ElementInfo => ({
    label: 'h1',
    width: 343,
    height: 80,
    top: 100,
    left: 16,
    visible: true,
    display: 'block',
    position: 'static',
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: '700',
    margin: '0',
    padding: '0 16px',
    layout: '',
    ...patch,
  });
  const labels: ComparisonLabels = {
    viewport: 'Viewport',
    missing: 'Not on this page',
    hidden: 'Hidden at this size',
    waiting: 'Waiting…',
    size: 'Size',
    display: 'Display',
    font: 'Font',
    margin: 'Margin',
    padding: 'Padding',
    layout: 'Layout',
    position: 'Position',
  };

  it('has a row per viewport and a column per property', () => {
    const markdown = comparisonMarkdown(
      'main > h1:nth-of-type(1)',
      [
        { name: 'Phone', width: 375, info: info({}) },
        { name: 'Desktop', width: 1366, info: info({ width: 960, fontSize: '48px', layout: 'flex row | wrap' }) },
        { name: 'Tablet', width: 768, info: info({ visible: false }) },
        { name: 'Laptop', width: 1280, info: null },
        { name: 'Watch', width: 200, info: undefined },
      ],
      labels,
    );
    const lines = markdown.trim().split('\n');
    expect(lines[0]).toBe('`main > h1:nth-of-type(1)`');
    expect(lines[2]).toBe('| Viewport | Size | Display | Font | Margin | Padding | Layout | Position |');
    expect(lines[3]).toBe('| --- | --- | --- | --- | --- | --- | --- | --- |');
    expect(lines[4]).toBe('| Phone (375px) | 343 × 80 | block | 32px / 40px · 700 | 0 | 0 16px | — | — |');
    // Pipes inside values can't break the table.
    expect(lines[5]).toContain('flex row \\| wrap');
    expect(lines[6]).toContain('| Tablet (768px) | Hidden at this size |');
    expect(lines[7]).toContain('| Laptop (1280px) | Not on this page |');
    expect(lines[8]).toContain('| Watch (200px) | Waiting… |');
  });
});

describe('saved CSS snippets', () => {
  it('validates stored snippets', () => {
    const settings = parseSettings({
      cssSnippets: [
        { id: 'a', name: '  Hide   banner ', css: ' .banner { display: none } ' },
        { id: 'a', name: 'Same id', css: 'b {}' },
        { id: 'bad id!', name: 'Unsafe id', css: 'i {}' },
        { name: '', css: 'x {}' },
        { name: 'Empty', css: '   ' },
        { name: 'x'.repeat(100), css: 'y {}' },
        'nope',
        null,
      ],
    });
    expect(settings.cssSnippets.map((snippet) => snippet.name)).toEqual([
      'Hide banner',
      'Same id',
      'Unsafe id',
      'x'.repeat(MAX_SNIPPET_NAME),
    ]);
    expect(settings.cssSnippets[0]).toEqual({ id: 'a', name: 'Hide banner', css: '.banner { display: none }' });
    const ids = settings.cssSnippets.map((snippet) => snippet.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[\w-]{1,64}$/.test(id))).toBe(true);
  });

  it('keeps at most the maximum and defaults to none', () => {
    const many = Array.from({ length: MAX_CSS_SNIPPETS + 5 }, (_, index) => ({ name: `s${index}`, css: 'a {}' }));
    expect(parseSettings({ cssSnippets: many }).cssSnippets).toHaveLength(MAX_CSS_SNIPPETS);
    expect(parseSettings({}).cssSnippets).toEqual([]);
    expect(defaultSettings().cssSnippets).toEqual([]);
  });

  it('are exported, and an older export keeps the current ones', () => {
    const current = { ...defaultSettings(), cssSnippets: [{ id: 'keep', name: 'Keep', css: 'a {}' }] };
    expect(createSettingsExport(current).settings.cssSnippets).toEqual(current.cssSnippets);
    const older = { app: 'Breakpointer', kind: 'settings', version: 1, settings: { theme: 'dark' } };
    expect(parseSettingsImport(older, current)?.cssSnippets).toEqual(current.cssSnippets);
  });

  it('saves, replaces by name, deletes and restores', () => {
    let state = defaultSettings();
    state = settingsReducer(state, { type: 'saveCssSnippet', snippet: { id: 's1', name: 'Hide', css: 'a {}' } });
    state = settingsReducer(state, { type: 'saveCssSnippet', snippet: { id: 's2', name: 'Debug', css: 'b {}' } });
    // The same name (in any case) replaces it and keeps its id and place.
    state = settingsReducer(state, { type: 'saveCssSnippet', snippet: { id: 's3', name: 'hide', css: 'c {}' } });
    expect(state.cssSnippets).toEqual([
      { id: 's1', name: 'hide', css: 'c {}' },
      { id: 's2', name: 'Debug', css: 'b {}' },
    ]);
    const removed = state.cssSnippets[0]!;
    state = settingsReducer(state, { type: 'deleteCssSnippet', id: 's1' });
    expect(state.cssSnippets.map((snippet) => snippet.id)).toEqual(['s2']);
    state = settingsReducer(state, { type: 'restoreCssSnippet', snippet: removed, index: 0 });
    state = settingsReducer(state, { type: 'restoreCssSnippet', snippet: removed, index: 0 });
    expect(state.cssSnippets.map((snippet) => snippet.id)).toEqual(['s1', 's2']);
  });

  it('doesn’t save more than the maximum', () => {
    let state = defaultSettings();
    for (let index = 0; index < MAX_CSS_SNIPPETS + 3; index++)
      state = settingsReducer(state, {
        type: 'saveCssSnippet',
        snippet: { id: `s${index}`, name: `Snippet ${index}`, css: 'a {}' },
      });
    expect(state.cssSnippets).toHaveLength(MAX_CSS_SNIPPETS);
  });
});

describe('new responsive checks', () => {
  it('have names, details and highlights', () => {
    expect(t(CHECK_KIND_KEYS['upscaled-images'])).toBe('Images shown larger than their real size');
    expect(t(CHECK_KIND_KEYS['fixed-cover'])).toBe('Fixed elements cover much of the screen');
    expect(issueDetail({ kind: 'fixed-cover', count: 1, detail: '48%', samples: [] }, t)).toBe(
      'Fixed or sticky elements cover 48% of the screen.',
    );
    expect(issueDetail({ kind: 'upscaled-images', count: 3, samples: [] }, t)).toBe('3 elements');
    expect(canHighlight('upscaled-images')).toBe(true);
    expect(canHighlight('fixed-cover')).toBe(true);
    expect(canHighlight('viewport-meta')).toBe(false);
  });
});

describe('new shortcuts', () => {
  const key = (code: string, value: string, modifiers: Partial<KeyboardEvent> = {}) => ({
    code,
    key: value,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...modifiers,
  });

  it('measure, contrast, outlines, cycle focus and 100%', () => {
    expect(shortcutFor(key('KeyX', 'x'))).toBe('measure');
    expect(shortcutFor(key('KeyC', 'c'))).toBe('contrast');
    expect(shortcutFor(key('KeyO', 'o'))).toBe('outlines');
    expect(shortcutFor(key('BracketLeft', '['))).toBe('prevViewport');
    expect(shortcutFor(key('BracketRight', ']'))).toBe('nextViewport');
    expect(shortcutFor(key('Digit0', '0'))).toBe('actualSize');
    expect(shortcutFor(key('Numpad0', '0'))).toBe('actualSize');
    // Copy and paste stay with the browser.
    expect(shortcutFor(key('KeyC', 'c', { metaKey: true }))).toBeNull();
    expect(shortcutFor(key('KeyX', 'x', { ctrlKey: true }))).toBeNull();
  });
});

describe('command palette', () => {
  const baseActions = (): CommandActions => ({
    reloadAll: vi.fn(),
    openInTab: vi.fn(),
    scrollTop: vi.fn(),
    navigate: vi.fn(),
    addPreset: vi.fn(),
    openAdd: vi.fn(),
    applyGroup: vi.fn(),
    saveGroup: vi.fn(),
    manageGroups: vi.fn(),
    toggleVisible: vi.fn(),
    showAll: vi.fn(),
    focus: vi.fn(),
    fit: vi.fn(),
    zoomTo: vi.fn(),
    setLayout: vi.fn(),
    rotateAll: vi.fn(),
    sortByWidth: vi.fn(),
    edges: vi.fn(),
    toggleTool: vi.fn(),
    toggleRulers: vi.fn(),
    setBreakpoints: vi.fn(),
    liveCss: vi.fn(),
    inspect: vi.fn(),
    capture: vi.fn(),
    report: vi.fn(),
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
    openSettings: vi.fn(),
    siteAccess: vi.fn(),
    help: vi.fn(),
    exportSettings: vi.fn(),
  });
  const context = (patch: Partial<CommandContext> = {}): CommandContext => ({
    t,
    en: t,
    settings: {
      ...defaultSettings(),
      cssSnippets: [{ id: 'hide', name: 'Hide banner', css: '.banner{display:none}' }],
    },
    hasUrl: true,
    canAdd: true,
    focusedId: null,
    outlines: false,
    hideScrollbars: false,
    liveCss: false,
    inspecting: false,
    actions: baseActions(),
    ...patch,
  });
  const ids = (ctx: CommandContext) => buildCommands(ctx).map((command) => command.id);

  it('lists the utilities only when the workspace provides them', () => {
    expect(ids(context())).not.toContain('measure');
    expect(ids(context())).not.toContain('vision-protanopia');
    expect(ids(context())).not.toContain('snippet-hide');
  });

  it('lists measure, contrast, compare, vision, stress tests and snippets', () => {
    const actions = {
      ...baseActions(),
      scrollBottom: vi.fn(),
      copyAddress: vi.fn(),
      cycleFocus: vi.fn(),
      measure: vi.fn(),
      contrast: vi.fn(),
      compare: vi.fn(),
      stopCompare: vi.fn(),
      swapCompare: vi.fn(),
      setVision: vi.fn(),
      toggleSimulate: vi.fn(),
      applySnippet: vi.fn(),
    };
    const simulate = {
      vision: 'tritanopia',
      reduceMotion: true,
      moreContrast: false,
      print: false,
      spacing: false,
      textZoom: false,
      pauseAnimations: false,
      pseudo: false,
      rtl: false,
    } as const;
    const commands = buildCommands(context({ actions, simulate, measuring: true }));
    const byId = (id: string) => commands.find((command) => command.id === id);
    for (const id of [
      'scroll-bottom',
      'copy-address',
      'focus-prev',
      'focus-next',
      'measure',
      'contrast',
      'compare',
      'vision-none',
      'vision-blurred',
      'simulate-pseudo',
      'simulate-rtl',
      'simulate-reduceMotion',
      'simulate-pauseAnimations',
      'snippet-hide',
    ])
      expect(byId(id), id).toBeDefined();
    expect(byId('measure')?.checked).toBe(true);
    expect(byId('vision-tritanopia')?.current).toBe(true);
    expect(byId('vision-none')?.current).toBe(false);
    expect(byId('simulate-reduceMotion')?.checked).toBe(true);
    expect(byId('vision-deuteranopia')?.title).toBe('Vision: No green (deuteranopia)');

    byId('snippet-hide')?.run();
    expect(actions.applySnippet).toHaveBeenCalledWith('.banner{display:none}');
    byId('focus-next')?.run();
    expect(actions.cycleFocus).toHaveBeenCalledWith(1);
    byId('vision-blurred')?.run();
    expect(actions.setVision).toHaveBeenCalledWith('blurred');

    // While comparing: swap, change and stop instead of starting.
    const comparing = ids(context({ actions, simulate, comparing: true }));
    expect(comparing).toEqual(expect.arrayContaining(['compare-swap', 'compare-change', 'compare-stop']));
    expect(comparing).not.toContain('compare');
  });
});
