import { describe, expect, it } from 'vitest';
import type { ElementInfo } from '../../src/agent/protocol';
import { compressBox, cssPath, describeElement, mediaQueryEdges, swapColorScheme } from '../../src/agent/page-utils';
import { breakpointEdges, breakpointFor, siteBreakpointSet } from '../../src/data/breakpoints';
import { isPaletteChord, shortcutFor } from '../../src/hooks/useShortcuts';
import { defaultViewports, parseSettings } from '../../src/services/storage';
import { matchScore, normalizeText, searchCommands } from '../../src/state/commands';
import { layoutSheet } from '../../src/state/composite';
import { changingProperties, propertyValue, visibilityChanges } from '../../src/state/inspector';
import { keyboardResize, resolveDrag } from '../../src/state/resize';
import { sizeClassOf } from '../../src/state/size-class';
import {
  createViewport,
  isSortedByWidth,
  nextZoom,
  sortByWidth,
  toTemplate,
  updateViewport,
} from '../../src/state/viewports';
import { MAX_DIMENSION, MIN_DIMENSION } from '../../src/utils/constants';

describe('media query breakpoints', () => {
  it('finds where min-width and max-width queries switch', () => {
    expect(mediaQueryEdges('(min-width: 768px)')).toEqual([768]);
    expect(mediaQueryEdges('(max-width: 767px)')).toEqual([768]);
    expect(mediaQueryEdges('(max-width: 767.98px)')).toEqual([768]);
    expect(mediaQueryEdges('(min-width: 767.5px)')).toEqual([768]);
    expect(mediaQueryEdges('screen and (min-width: 768px) and (max-width: 1023px)')).toEqual([768, 1024]);
    expect(mediaQueryEdges('(min-width:48em)')).toEqual([768]);
    expect(mediaQueryEdges('(max-width: 40rem)')).toEqual([641]);
  });

  it('reads range syntax both ways round', () => {
    expect(mediaQueryEdges('(width >= 768px)')).toEqual([768]);
    expect(mediaQueryEdges('(width > 767px)')).toEqual([768]);
    expect(mediaQueryEdges('(width < 640px)')).toEqual([640]);
    expect(mediaQueryEdges('(width <= 639.98px)')).toEqual([640]);
    expect(mediaQueryEdges('(768px <= width)')).toEqual([768]);
    expect(mediaQueryEdges('(640px <= width < 1024px)')).toEqual([640, 1024]);
  });

  it('handles lists, print-only queries and unrelated features', () => {
    expect(mediaQueryEdges('(max-width: 599px), (min-width: 1200px)')).toEqual([600, 1200]);
    expect(mediaQueryEdges('print and (max-width: 600px)')).toEqual([]);
    expect(mediaQueryEdges('not print and (max-width: 600px)')).toEqual([601]);
    expect(mediaQueryEdges('(min-device-width: 768px)')).toEqual([]);
    expect(mediaQueryEdges('(min-height: 600px), (orientation: landscape), (prefers-color-scheme: dark)')).toEqual([]);
    expect(mediaQueryEdges('')).toEqual([]);
  });

  it('swaps the preferred colour scheme in media text', () => {
    expect(swapColorScheme('(prefers-color-scheme: dark)')).toBe('(prefers-color-scheme: light)');
    expect(swapColorScheme('screen and (prefers-color-scheme:light)')).toBe('screen and (prefers-color-scheme:dark)');
    expect(swapColorScheme('(min-width: 600px)')).toBe('(min-width: 600px)');
  });
});

describe('page helpers', () => {
  it('compresses four sides like CSS shorthand', () => {
    expect(compressBox(['0px', '0px', '0px', '0px'])).toBe('0');
    expect(compressBox(['8px', '16px', '8px', '16px'])).toBe('8px 16px');
    expect(compressBox(['0px', '16px', '24px', '16px'])).toBe('0 16px 24px');
    expect(compressBox(['1px', '2px', '3px', '4px'])).toBe('1px 2px 3px 4px');
  });

  it('builds selectors that find the element again', () => {
    document.body.innerHTML = `
      <main><section class="hero"><h1>Title</h1><p>One</p><p class="x y z">Two</p></section></main>
      <div id="unique"><span>In</span></div><div id="twice"></div><div id="twice"><b>Bold</b></div>`;
    const second = document.querySelectorAll('p')[1]!;
    const path = cssPath(second);
    expect(document.querySelector(path)).toBe(second);
    expect(path).toBe('body > main:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(2)');
    expect(cssPath(document.querySelector('#unique span')!)).toBe('#unique > span:nth-of-type(1)');
    // A repeated id isn't trusted.
    const bold = document.querySelector('b')!;
    expect(document.querySelector(cssPath(bold))).toBe(bold);
    expect(describeElement(second)).toBe('main > section.hero > p.x.y');
  });
});

describe('site breakpoints', () => {
  it('labels widths with the page’s own breakpoints', () => {
    const site = [1024, 768, 768];
    expect(siteBreakpointSet(site)).toEqual({
      base: '<768',
      breakpoints: [
        { name: '≥768', min: 768 },
        { name: '≥1024', min: 1024 },
      ],
    });
    expect(breakpointFor('site', 375, [], site)).toBe('<768');
    expect(breakpointFor('site', 800, [], site)).toBe('≥768');
    expect(breakpointFor('site', 1366, [], site)).toBe('≥1024');
    expect(breakpointFor('site', 1366, [], [])).toBeNull();
    expect(siteBreakpointSet([50, 99_999])).toBeNull();
  });

  it('tests both sides of the site’s breakpoints', () => {
    expect(breakpointEdges('site', [], 8, [768, 1024])).toEqual([
      { name: '767px', width: 767 },
      { name: '768px', width: 768 },
      { name: '1023px', width: 1023 },
      { name: '1024px', width: 1024 },
    ]);
  });
});

describe('command search', () => {
  const items = [
    { title: 'Reload all previews' },
    { title: 'Add Tablet', keywords: 'Classic iPad size 768x1024' },
    { title: 'Vừa màn hình', keywords: 'Fit' },
    { title: 'Rotate all' },
  ];

  it('ignores case and Vietnamese accents', () => {
    expect(normalizeText('Vừa Màn Hình Đẹp')).toBe('vua man hinh dep');
    expect(searchCommands(items, 'vua man').map((item) => item.title)).toEqual(['Vừa màn hình']);
  });

  it('matches every word, ranking titles above keywords', () => {
    expect(searchCommands(items, 'ipad').map((item) => item.title)).toEqual(['Add Tablet']);
    expect(searchCommands(items, 'fit').map((item) => item.title)).toEqual(['Vừa màn hình']);
    expect(searchCommands(items, 'rel all')[0]!.title).toBe('Reload all previews');
    expect(searchCommands(items, 'zzz')).toEqual([]);
    expect(searchCommands(items, '')).toHaveLength(4);
    expect(matchScore('re', { title: 'Reload all previews' })).toBeGreaterThan(
      matchScore('re', { title: 'Rotate all' }),
    );
  });

  it('finds letters in order as a last resort', () => {
    expect(searchCommands(items, 'rtal').map((item) => item.title)).toEqual(['Rotate all']);
  });
});

describe('resizing by dragging', () => {
  it('snaps to nearby breakpoints, rounds to steps and stays in range', () => {
    expect(resolveDrag(763.4, { targets: [768, 1024], threshold: 8 })).toEqual({ value: 768, snapped: 768 });
    expect(resolveDrag(740, { targets: [768], threshold: 8 })).toEqual({ value: 740, snapped: null });
    expect(resolveDrag(763, { targets: [768], threshold: 8, step: 10 })).toEqual({ value: 760, snapped: null });
    expect(resolveDrag(-50).value).toBe(MIN_DIMENSION);
    expect(resolveDrag(99_999).value).toBe(MAX_DIMENSION);
  });

  it('moves by 1px or 10px from the keyboard', () => {
    expect(keyboardResize(375, 'ArrowRight', false)).toBe(376);
    expect(keyboardResize(375, 'ArrowLeft', true)).toBe(365);
    expect(keyboardResize(375, 'Home', false)).toBe(MIN_DIMENSION);
    expect(keyboardResize(375, 'End', false)).toBe(MAX_DIMENSION);
    expect(keyboardResize(375, 'Enter', false)).toBeNull();
  });
});

describe('all viewports in one image', () => {
  it('lays images out in rows with room for labels', () => {
    const options = { maxRowWidth: 1000, gap: 10, padding: 20, headerHeight: 50, labelHeight: 30 };
    const layout = layoutSheet(
      [
        { width: 400, height: 300 },
        { width: 500, height: 200 },
        { width: 600, height: 100 },
      ],
      options,
    );
    expect(layout.items).toEqual([
      { x: 20, y: 70, width: 400, height: 300 },
      { x: 430, y: 70, width: 500, height: 200 },
      { x: 20, y: 410, width: 600, height: 100 },
    ]);
    expect(layout.width).toBe(950);
    expect(layout.height).toBe(20 + 50 + 300 + 30 + 10 + 100 + 30 + 20);
    // A single image wider than a row still fits.
    expect(layoutSheet([{ width: 1500, height: 10 }], options).width).toBe(1540);
  });
});

describe('inspector', () => {
  const info = (patch: Partial<ElementInfo>): ElementInfo => ({
    label: 'h1',
    width: 300,
    height: 40,
    top: 0,
    left: 0,
    visible: true,
    display: 'block',
    position: 'static',
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: '700',
    margin: '0',
    padding: '0',
    layout: '',
    ...patch,
  });

  it('reports what changes between sizes', () => {
    const changing = changingProperties([
      info({ width: 343, fontSize: '24px' }),
      info({ width: 700, fontSize: '40px', lineHeight: '48px', height: 48 }),
      undefined,
    ]);
    expect([...changing].sort()).toEqual(['font', 'size']);
    expect(changingProperties([info({ width: 300 }), info({ width: 900 })]).size).toBe(0);
    expect(propertyValue(info({}), 'font')).toBe('24px / 32px · 700');
    expect(propertyValue(info({}), 'position')).toBe('');
    expect(visibilityChanges([info({}), info({ visible: false })])).toBe(true);
    expect(visibilityChanges([info({}), null])).toBe(true);
    expect(visibilityChanges([info({}), undefined])).toBe(false);
  });
});

describe('viewports', () => {
  it('classifies sizes for icons', () => {
    expect(sizeClassOf(375, 667)).toBe('phone');
    expect(sizeClassOf(844, 390)).toBe('phone');
    expect(sizeClassOf(768, 1024)).toBe('tablet');
    expect(sizeClassOf(1024, 768)).toBe('tablet');
    expect(sizeClassOf(1366, 768)).toBe('laptop');
    expect(sizeClassOf(1920, 1080)).toBe('desktop');
  });

  it('keeps a colour scheme per viewport, in groups and in storage', () => {
    const [phone] = [createViewport({ name: 'Phone', width: 375, height: 667, colorScheme: 'dark' })];
    expect(phone!.colorScheme).toBe('dark');
    expect(toTemplate(phone!)).toMatchObject({ colorScheme: 'dark' });
    const cleared = updateViewport([phone!], phone!.id, { colorScheme: null })[0]!;
    expect(cleared).not.toHaveProperty('colorScheme');
    expect(updateViewport([cleared], phone!.id, { colorScheme: 'light' })[0]!.colorScheme).toBe('light');
    const parsed = parseSettings({
      breakpoints: 'site',
      viewports: [
        { id: 'a', width: 375, height: 667, colorScheme: 'dark' },
        { id: 'b', width: 375, height: 667, colorScheme: 'sepia' },
      ],
    });
    expect(parsed.breakpoints).toBe('site');
    expect(parsed.viewports.map((vp) => vp.colorScheme)).toEqual(['dark', undefined]);
  });

  it('sorts by width without losing identity', () => {
    const list = [
      createViewport({ name: 'Laptop', width: 1366, height: 768 }),
      createViewport({ name: 'Phone', width: 375, height: 667 }),
      createViewport({ name: 'Small', width: 375, height: 600 }),
    ];
    const sorted = sortByWidth(list);
    expect(sorted.map((vp) => vp.name)).toEqual(['Small', 'Phone', 'Laptop']);
    expect(sorted[2]).toBe(list[0]);
    expect(isSortedByWidth(list)).toBe(false);
    expect(isSortedByWidth(sorted)).toBe(true);
  });

  it('steps zoom from any value', () => {
    expect(nextZoom(0.48, 1)).toBe(0.5);
    expect(nextZoom(0.48, -1)).toBe(0.33);
    expect(nextZoom(1, 1)).toBe(1);
  });

  it('creates the same first-run viewports in every tab', () => {
    expect(defaultViewports().map((vp) => vp.id)).toEqual(defaultViewports().map((vp) => vp.id));
    expect(defaultViewports()[0]!.id).toBe('default-mobile-m');
  });
});

describe('shortcuts', () => {
  const key = (code: string, value: string, extra: Partial<KeyboardEvent> = {}) =>
    ({
      code,
      key: value,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      isComposing: false,
      ...extra,
    }) as KeyboardEvent;

  it('opens the palette with Ctrl/⌘ + K or K, inspects with I and stops with Escape', () => {
    expect(shortcutFor(key('KeyK', 'k', { metaKey: true }))).toBe('palette');
    expect(shortcutFor(key('KeyK', 'k', { ctrlKey: true }))).toBe('palette');
    expect(isPaletteChord(key('KeyK', 'k', { ctrlKey: true }))).toBe(true);
    expect(isPaletteChord(key('KeyK', 'k', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(shortcutFor(key('KeyK', 'k'))).toBe('palette');
    expect(shortcutFor(key('KeyI', 'i'))).toBe('inspect');
    expect(shortcutFor(key('Escape', 'Escape'))).toBe('escape');
    expect(shortcutFor(key('KeyI', 'i', { altKey: true }))).toBeNull();
  });
});

describe('review fixes', () => {
  it('tells addresses from numbers', async () => {
    const { looksLikeAddress } = await import('../../src/utils/url');
    for (const text of [
      'example.com',
      'https://example.com',
      'localhost:5173',
      '127.0.0.1:8080/demo',
      'shop.example.com/a?b',
    ])
      expect(looksLikeAddress(text), text).toBe(true);
    for (const text of ['768', '375', '1.5', 'tablet', 'fit all', '.com', 'example.', ''])
      expect(looksLikeAddress(text), text).toBe(false);
  });

  it('anchors selectors of elements outside <body> at the root', () => {
    const extra = document.createElement('div');
    document.documentElement.append(extra);
    expect(cssPath(extra)).toMatch(/^:root > div:nth-of-type\(\d+\)$/);
    expect(document.querySelector(cssPath(extra))).toBe(extra);
    extra.remove();
  });

  it('lists every command when nothing is typed', () => {
    const many = Array.from({ length: 150 }, (_, index) => ({ title: `Command ${index}` }));
    expect(searchCommands(many, '')).toHaveLength(150);
    expect(searchCommands(many, 'command', 60)).toHaveLength(60);
  });

  it('never postpones a scan that is already due', async () => {
    const { vi } = await import('vitest');
    const { scheduler } = await import('../../src/agent/page-utils');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    try {
      const task = vi.fn();
      const schedule = scheduler(task);
      schedule(100);
      // A page that keeps changing asks again and again (until 90 ms, for 490 ms)…
      for (let step = 0; step < 3; step++) {
        vi.advanceTimersByTime(30);
        schedule(400);
      }
      // …the first run still happens on time…
      vi.advanceTimersByTime(10);
      expect(task).toHaveBeenCalledTimes(1);
      // …and once more for the latest request.
      vi.advanceTimersByTime(389);
      expect(task).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(task).toHaveBeenCalledTimes(2);
      // A sooner request runs first; the later one still runs afterwards.
      schedule(1000);
      schedule(50);
      vi.advanceTimersByTime(50);
      expect(task).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(950);
      expect(task).toHaveBeenCalledTimes(4);
      vi.advanceTimersByTime(5000);
      expect(task).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
