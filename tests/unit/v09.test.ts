import { describe, expect, it } from 'vitest';
import type { PageMeta } from '../../src/agent/protocol';
import { collectMeta } from '../../src/agent/page-utils';
import { shortcutFor } from '../../src/hooks/useShortcuts';
import { createTranslator } from '../../src/i18n/translate';
import { defaultSettings, parseSettings } from '../../src/services/storage';
import { breakpointMap, widthRange } from '../../src/state/breakpoint-map';
import { auditJson } from '../../src/state/export';
import { fitZoomForAll } from '../../src/state/fit';
import {
  breadcrumb,
  headingOutline,
  headingSummary,
  metaChecks,
  metaMarkdown,
  metaSummary,
  metaValue,
  truncate,
} from '../../src/state/meta';
import { minimapScale, scrollForPoint } from '../../src/state/minimap';
import { settingsReducer } from '../../src/state/settings-reducer';
import type { ViewportConfig } from '../../src/types';
import { buildCommands, type CommandActions } from '../../src/viewer/commands';

const t = createTranslator('en');

const meta = (extra: Partial<PageMeta> = {}): PageMeta => ({
  title: 'Pricing — Brightside: plans for teams of every size',
  lang: 'en',
  tags: [
    { key: 'description', value: 'Start free for teams up to five people, then add shared boards and guests when you need them.' },
    { key: 'viewport', value: 'width=device-width, initial-scale=1' },
    { key: 'og:title', value: 'Pricing — Brightside' },
    { key: 'og:image', value: 'https://brightside.example/og.png' },
    { key: 'twitter:card', value: 'summary_large_image' },
  ],
  canonical: 'https://brightside.example/pricing',
  icons: [
    { rel: 'icon', href: 'https://brightside.example/favicon.png', sizes: '32x32' },
    { rel: 'apple-touch-icon', href: 'https://brightside.example/touch.png', sizes: '180x180' },
  ],
  alternates: 0,
  headings: [
    { level: 1, text: 'Plans for teams of every size', hidden: false },
    { level: 2, text: 'Choose a plan', hidden: false },
    { level: 3, text: 'Team', hidden: false },
  ],
  ...extra,
});

const statusOf = (page: PageMeta, id: string) => metaChecks(page, 'https://brightside.example/pricing').find((check) => check.id === id)!;

describe('appearance and panel settings', () => {
  it('defaults to indigo, dots, the status bar and the minimap, without the sidebar', () => {
    const settings = defaultSettings();
    expect(settings.accent).toBe('indigo');
    expect(settings.canvas).toBe('dots');
    expect(settings.panels).toEqual({ sidebar: false, statusBar: true, minimap: true });
  });

  it('reads stored values and falls back on anything unknown', () => {
    const parsed = parseSettings({
      accent: 'teal',
      canvas: 'grid',
      layout: 'stack',
      panels: { sidebar: true, statusBar: false, minimap: 'yes' },
    });
    expect(parsed.accent).toBe('teal');
    expect(parsed.canvas).toBe('grid');
    expect(parsed.layout).toBe('stack');
    expect(parsed.panels).toEqual({ sidebar: true, statusBar: false, minimap: true });
    const bad = parseSettings({ accent: 'neon', canvas: 'stripes', layout: 'grid', panels: 'all' });
    expect(bad.accent).toBe('indigo');
    expect(bad.canvas).toBe('dots');
    expect(bad.layout).toBe('wrap');
    expect(bad.panels).toEqual({ sidebar: false, statusBar: true, minimap: true });
  });

  it('changes them through the reducer', () => {
    let state = defaultSettings();
    state = settingsReducer(state, { type: 'setAccent', accent: 'rose' });
    state = settingsReducer(state, { type: 'setCanvas', canvas: 'plain' });
    state = settingsReducer(state, { type: 'setPanels', panels: { sidebar: true } });
    expect(state.accent).toBe('rose');
    expect(state.canvas).toBe('plain');
    expect(state.panels).toEqual({ sidebar: true, statusBar: true, minimap: true });
  });

  it('toggles the sidebar with the backslash key', () => {
    const key = (code: string, extra = {}) =>
      shortcutFor({ key: '\\', code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...extra });
    expect(key('Backslash')).toBe('sidebar');
    expect(key('IntlBackslash')).toBe('sidebar');
    expect(key('Backslash', { metaKey: true })).toBeNull();
  });
});

describe('stack layout', () => {
  const vp = (width: number, height: number): ViewportConfig => ({
    id: `${width}`,
    name: `${width}`,
    width,
    height,
    orientation: width > height ? 'landscape' : 'portrait',
    zoom: 1,
    hidden: false,
  });
  const metrics = { chromeHeight: 64, chromeWidth: 2, stageExtraHeight: 0, minCardWidth: 220, gap: 20 };

  it('fits the widest viewport to the width and lets the column scroll down', () => {
    const zoom = fitZoomForAll([vp(390, 844), vp(1440, 900)], { width: 1000, height: 600 }, 'stack', metrics);
    // (1000 - 2) / 1440 = 0.693…: the height doesn't count.
    expect(zoom).toBe(0.69);
  });
});

describe('breakpoint map', () => {
  it('places breakpoints and viewports on a 320–1920 ruler', () => {
    const map = breakpointMap(
      [
        { item: 'phone', width: 390 },
        { item: 'laptop', width: 1440 },
      ],
      [
        { name: 'md', min: 768 },
        { name: 'sm', min: 640 },
        { name: 'lg', min: 1024 },
      ],
    );
    expect([map.start, map.end]).toEqual([320, 1920]);
    expect(map.ticks.map((tick) => tick.name)).toEqual(['sm', 'md', 'lg']);
    expect(map.ticks[0]!.at).toBeCloseTo(0.2);
    expect(map.markers.map((marker) => marker.at)).toEqual([(390 - 320) / 1600, (1440 - 320) / 1600]);
  });

  it('widens to every width shown and only labels ticks that have room', () => {
    const map = breakpointMap([{ item: '4k', width: 3840 }], [
      { name: 'a', min: 700 },
      { name: 'b', min: 720 },
      { name: 'c', min: 2000 },
    ]);
    expect(map.end).toBe(3840);
    expect(map.ticks.map((tick) => tick.labelled)).toEqual([true, false, true]);
  });

  it('writes the range of widths', () => {
    expect(widthRange([1440, 390, 768])).toBe('390–1440');
    expect(widthRange([768])).toBe('768');
    expect(widthRange([])).toBeNull();
  });
});

describe('minimap', () => {
  it('scales the workspace into the minimap and scrolls to a point', () => {
    expect(minimapScale({ width: 2000, height: 1000 }, { width: 184, height: 120 })).toBeCloseTo(0.092);
    expect(minimapScale({ width: 0, height: 100 }, { width: 184, height: 120 })).toBe(0);
    const view = { x: 0, y: 0, width: 800, height: 600 };
    expect(scrollForPoint({ x: 1000, y: 500 }, view, { width: 2000, height: 1000 })).toEqual({ left: 600, top: 200 });
    // Never past either end.
    expect(scrollForPoint({ x: 10, y: 990 }, view, { width: 2000, height: 1000 })).toEqual({ left: 0, top: 400 });
  });
});

describe('meta tags', () => {
  it('passes a page that sets everything', () => {
    const checks = metaChecks(meta(), 'https://brightside.example/pricing');
    expect(checks.map((check) => check.status)).toEqual([
      'ok', // title
      'ok', // description
      'ok', // social title
      'ok', // social image
      'ok', // X card
      'ok', // canonical
      'ok', // lang
      'ok', // viewport
      'info', // robots: not set
      'ok', // icons
    ]);
    expect(metaSummary(checks, meta().headings)).toEqual({ fix: 0, look: 0 });
  });

  it('flags what is missing, too long or blocking', () => {
    const page = meta({
      title: '',
      lang: '',
      canonical: 'https://brightside.example/',
      icons: [],
      tags: [
        { key: 'description', value: 'x'.repeat(200) },
        { key: 'viewport', value: 'width=device-width, maximum-scale=1' },
        { key: 'robots', value: 'noindex, follow' },
      ],
    });
    expect(statusOf(page, 'title')).toMatchObject({ status: 'bad', note: 'meta.missing' });
    expect(statusOf(page, 'description')).toMatchObject({ status: 'warn', params: { count: 200, max: 160 } });
    expect(statusOf(page, 'socialImage').status).toBe('warn');
    expect(statusOf(page, 'socialTitle').status).toBe('info');
    expect(statusOf(page, 'canonical')).toMatchObject({ status: 'info', note: 'meta.canonicalOther' });
    expect(statusOf(page, 'lang').status).toBe('warn');
    expect(statusOf(page, 'viewport')).toMatchObject({ status: 'warn', note: 'meta.viewportZoom' });
    expect(statusOf(page, 'robots')).toMatchObject({ status: 'warn', note: 'meta.noindex' });
    expect(statusOf(page, 'icons').status).toBe('warn');
    expect(statusOf(meta({ tags: [] }), 'viewport').status).toBe('bad');
  });

  it('finds the first tag that is set', () => {
    const page = meta({ tags: [{ key: 'twitter:title', value: 'From X' }] });
    expect(metaValue(page, 'og:title', 'twitter:title')).toBe('From X');
    expect(metaValue(page, 'og:description')).toBe('');
  });

  it('cuts text like search results do, and writes addresses as breadcrumbs', () => {
    expect(truncate('Plans for teams of every size and every budget', 20)).toBe('Plans for teams of …');
    expect(truncate('Short', 20)).toBe('Short');
    expect(breadcrumb('https://brightside.example/pricing/teams?x=1')).toBe('https://brightside.example › pricing › teams');
  });

  it('outlines headings, with skipped levels and extra h1s (hidden ones aside)', () => {
    const headings = [
      { level: 2, text: 'Intro', hidden: false },
      { level: 1, text: 'Title', hidden: false },
      { level: 4, text: 'Deep', hidden: false },
      { level: 1, text: 'Again', hidden: false },
      { level: 6, text: 'Menu', hidden: true },
    ];
    expect(headingOutline(headings).map((heading) => heading.issue)).toEqual([null, null, 'skip', 'extraH1', null]);
    expect(headingSummary(headings)).toEqual({ noH1: false, skips: 1, extraH1: 1 });
    expect(headingSummary([{ level: 2, text: 'No title', hidden: false }]).noH1).toBe(true);
  });

  it('copies the tab as Markdown', () => {
    const markdown = metaMarkdown('https://brightside.example/pricing', meta(), t);
    expect(markdown).toContain('## Meta tags and headings');
    expect(markdown).toContain('| Title | OK · 51 characters | `Pricing — Brightside: plans for teams of every size` |');
    expect(markdown).toContain('  - H2 Choose a plan');
  });

  it('is part of the audit JSON', () => {
    const json = JSON.parse(
      auditJson('https://brightside.example/', [{ name: 'Phone', width: 390, height: 844, report: null, meta: meta() }], '0.9.0'),
    );
    expect(json.previews[0].meta.canonical).toBe('https://brightside.example/pricing');
  });
});

describe('collecting meta tags in a page', () => {
  it('reads tags, makes addresses absolute and outlines headings', () => {
    document.documentElement.setAttribute('lang', 'vi');
    document.head.innerHTML = `
      <title>  Bảng   giá </title>
      <meta name="Description" content="Mô tả">
      <meta property="og:image" content="/og.png">
      <meta name="viewport" content="width=device-width">
      <meta charset="utf-8">
      <link rel="canonical" href="/pricing">
      <link rel="icon" href="/favicon.svg" sizes="any">
      <link rel="alternate" hreflang="en" href="/en/pricing">`;
    document.body.innerHTML = '<h1>Giá</h1><h3 class="hidden">Ẩn</h3>';
    const page = collectMeta(document, (element) => element.classList.contains('hidden'));
    const origin = location.origin;
    expect(page.title).toBe('Bảng giá');
    expect(page.lang).toBe('vi');
    expect(page.tags).toEqual([
      { key: 'description', value: 'Mô tả' },
      { key: 'og:image', value: `${origin}/og.png` },
      { key: 'viewport', value: 'width=device-width' },
    ]);
    expect(page.canonical).toBe(`${origin}/pricing`);
    expect(page.icons).toEqual([{ rel: 'icon', href: `${origin}/favicon.svg`, sizes: 'any' }]);
    expect(page.alternates).toBe(1);
    expect(page.headings).toEqual([
      { level: 1, text: 'Giá', hidden: false },
      { level: 3, text: 'Ẩn', hidden: true },
    ]);
  });
});

describe('palette commands for the workspace', () => {
  it('lists the stack layout, the panels, accents, canvases and the Meta tab', () => {
    const noop = () => {};
    const actions = new Proxy({} as CommandActions, { get: () => noop });
    const settings = { ...defaultSettings(), panels: { sidebar: true, statusBar: true, minimap: false } };
    const commands = buildCommands({
      t,
      en: t,
      settings,
      hasUrl: true,
      canAdd: true,
      focusedId: null,
      outlines: false,
      hideScrollbars: false,
      liveCss: false,
      inspecting: false,
      actions,
    });
    const byId = (id: string) => commands.find((command) => command.id === id);
    expect(byId('layout-stack')?.title).toBe('Layout: stack (one column)');
    expect(byId('panel-sidebar')?.checked).toBe(true);
    expect(byId('panel-minimap')?.checked).toBe(false);
    expect(byId('accent-indigo')?.current).toBe(true);
    expect(byId('accent-teal')?.title).toBe('Accent colour: Teal');
    expect(byId('canvas-grid')?.title).toBe('Canvas: Grid');
    expect(byId('audit-meta')?.title).toBe('Audit: meta & social previews');
  });
});
