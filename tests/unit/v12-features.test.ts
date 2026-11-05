import { describe, expect, it } from 'vitest';
import { imageFormat } from '../../src/agent/page-utils';
import type { ImageSample } from '../../src/agent/protocol';
import { gridAt, gridCss, validGrid, type GridSpec } from '../../src/state/grid-calc';
import { fileFor, imageMarkup, shownWidth, sizesFor, srcsetWidths } from '../../src/state/image-markup';
import { imageAdvice, type ImageAt } from '../../src/state/images';
import { testMedia, type MediaViewport } from '../../src/state/media-test';
import {
  dayOf,
  hasScore,
  MAX_HISTORY_DAYS,
  MAX_HISTORY_PAGES,
  parseScoreHistory,
  recordScore,
  scoreTrend,
  sparkline,
} from '../../src/state/score-history';

const grid = (patch: Partial<GridSpec> = {}): GridSpec => ({
  minColumn: 240,
  gap: 24,
  padding: 24,
  maxWidth: 1200,
  maxColumns: null,
  mode: 'auto-fit',
  items: 6,
  ...patch,
});

describe('grid calculator', () => {
  it('fits as many columns as the container allows', () => {
    // 375 − 48 = 327: one column.
    expect(gridAt(grid(), 375)).toMatchObject({ container: 327, tracks: 1, columns: 1, itemWidth: 327, rows: 6 });
    // 768 − 48 = 720: (720 + 24) / 264 = 2.8 → 2 columns of 348.
    expect(gridAt(grid(), 768)).toMatchObject({ tracks: 2, columns: 2, itemWidth: 348, rows: 3 });
    // Capped at 1200: (1224) / 264 = 4.6 → 4 columns.
    expect(gridAt(grid(), 1920)).toMatchObject({ container: 1200, tracks: 4, columns: 4, rows: 2 });
  });

  it('stretches few items with auto-fit and keeps empty tracks with auto-fill', () => {
    expect(gridAt(grid({ items: 2 }), 1920)).toMatchObject({ tracks: 4, columns: 2, itemWidth: 588 });
    expect(gridAt(grid({ items: 2, mode: 'auto-fill' }), 1920)).toMatchObject({
      tracks: 4,
      columns: 4,
      itemWidth: 282,
    });
  });

  it('caps the columns and marks a container narrower than one column', () => {
    expect(gridAt(grid({ maxColumns: 3 }), 1920).columns).toBe(3);
    expect(gridAt(grid({ minColumn: 400 }), 320)).toMatchObject({ columns: 1, squeezed: true, itemWidth: 272 });
  });

  it('writes the CSS, with min(100%, …) and the cap when there is one', () => {
    const css = gridCss(grid());
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));');
    expect(css).toContain('max-width: 1200px;');
    expect(css).toContain('padding-inline: 24px;');
    expect(gridCss(grid({ maxColumns: 3, maxWidth: null, padding: 0 }))).toContain(
      'minmax(min(100%, max(240px, (100% - 2 * 24px) / 3)), 1fr)',
    );
    expect(validGrid(grid({ minColumn: 0 }))).toBe(false);
    expect(validGrid(grid({ items: 0 }))).toBe(false);
  });
});

describe('responsive image markup', () => {
  const column = { kind: 'column' as const, padding: 24, maxWidth: 1200 };

  it('knows how wide the image is shown and writes sizes', () => {
    expect(shownWidth(column, 375)).toBe(327);
    expect(shownWidth(column, 1920)).toBe(1200);
    expect(shownWidth({ kind: 'vw', share: 50 }, 1000)).toBe(500);
    expect(sizesFor(column)).toBe('(min-width: 1248px) 1200px, calc(100vw - 48px)');
    expect(sizesFor({ kind: 'full' })).toBe('100vw');
    expect(sizesFor({ kind: 'fixed', width: 400 })).toBe('400px');
  });

  it('suggests widths for 1× and 2× screens, merged and capped', () => {
    expect(srcsetWidths(column, [375, 768, 1440])).toEqual([330, 720, 1200, 1440, 2400]);
    expect(srcsetWidths({ kind: 'full' }, [300, 320, 340])).toEqual([340, 680]);
    // Widths 30% apart don't merge: at most eight are kept.
    expect(
      srcsetWidths(
        { kind: 'full' },
        Array.from({ length: 12 }, (_, index) => Math.round(200 * 1.3 ** index)),
      ),
    ).toHaveLength(8);
  });

  it('names files from a pattern', () => {
    expect(fileFor('photo-{w}.jpg', 640)).toBe('photo-640.jpg');
    expect(fileFor('hero.png', 640)).toBe('hero-640.png');
    expect(fileFor('photo-{w}.jpg', 640, '.avif')).toBe('photo-640.avif');
    expect(fileFor('  ', 10)).toBe('image-10.jpg');
  });

  it('writes an <img> or a <picture>, with space reserved and loading set', () => {
    const spec = {
      layout: column,
      pattern: 'photo-{w}.jpg',
      ratio: { width: 16, height: 9 },
      alt: 'A "team" photo',
      lazy: true,
      modern: false,
    };
    const img = imageMarkup(spec, [330, 720]);
    expect(img).toContain('src="photo-720.jpg"');
    expect(img).toContain('photo-330.jpg 330w,');
    expect(img).toContain('width="720" height="405"');
    expect(img).toContain('alt="A &quot;team&quot; photo" loading="lazy" decoding="async">');
    const picture = imageMarkup({ ...spec, modern: true, lazy: false }, [330, 720]);
    expect(picture.startsWith('<picture>')).toBe(true);
    expect(picture).toContain('<source type="image/avif"');
    expect(picture).toContain('photo-720.webp 720w');
    expect(picture).toContain('fetchpriority="high"');
    expect(imageMarkup(spec, [])).toBe('');
  });
});

describe('media query tester', () => {
  const phone = { width: 375, height: 667 };
  const desktop = { width: 1440, height: 900 };
  const matches = (query: string, viewport: MediaViewport = phone) => testMedia(query, viewport).matches;

  it('answers width, height, orientation and aspect ratio', () => {
    expect(matches('(min-width: 768px)')).toBe(false);
    expect(matches('(min-width: 768px)', desktop)).toBe(true);
    expect(matches('(max-width: 23.4375em)')).toBe(true);
    expect(matches('(orientation: portrait)')).toBe(true);
    expect(matches('(orientation: landscape)', desktop)).toBe(true);
    expect(matches('(min-aspect-ratio: 16/10)', desktop)).toBe(true);
    expect(matches('(min-height: 700px)')).toBe(false);
  });

  it('reads range syntax, lists, types and not', () => {
    expect(matches('(640px <= width < 1024px)', { width: 800, height: 600 })).toBe(true);
    expect(matches('(width >= 1024px)')).toBe(false);
    expect(matches('(1024px < width)', desktop)).toBe(true);
    expect(matches('print, (max-width: 400px)')).toBe(true);
    expect(matches('only screen and (min-width: 300px)')).toBe(true);
    expect(matches('not screen and (min-width: 300px)')).toBe(false);
    expect(matches('@media (min-width: 300px) {')).toBe(true);
    expect(matches('((min-width: 300px) and (max-width: 400px)) or (orientation: landscape)')).toBe(true);
  });

  it('leaves what depends on the browser unknown, unless the preview says', () => {
    const hover = testMedia('(hover: hover) and (min-width: 300px)', phone);
    expect(hover).toEqual({ matches: null, invalid: false, unknown: ['hover'] });
    expect(matches('(hover: hover) and (min-width: 768px)')).toBe(false);
    expect(matches('(prefers-color-scheme: dark)', { ...phone, colorScheme: 'dark' })).toBe(true);
    expect(matches('(prefers-color-scheme: dark)')).toBeNull();
  });

  it('says when a query can’t be read', () => {
    for (const query of ['(min-widht: 300px)', '(min-width: 300)', '(min-width 300px', '', 'min-width: 300px'])
      expect(testMedia(query, phone).invalid, query).toBe(true);
  });
});

describe('score history', () => {
  const entry = (day: string, score: number) => ({ day, score, sizes: 3 });

  it('keeps one score a day per page, the latest days only', () => {
    let history = recordScore({}, 'abcdef0123456789', entry('2026-11-01', 70));
    history = recordScore(history, 'abcdef0123456789', entry('2026-11-01', 75));
    history = recordScore(history, 'abcdef0123456789', entry('2026-11-03', 90));
    expect(history.abcdef0123456789).toEqual([entry('2026-11-01', 75), entry('2026-11-03', 90)]);
    expect(hasScore(history, 'abcdef0123456789', entry('2026-11-03', 90))).toBe(true);
    for (let day = 1; day <= 40; day++)
      history = recordScore(history, 'abcdef0123456789', entry(`2026-10-${String(day).padStart(2, '0')}`, 50));
    expect(history.abcdef0123456789).toHaveLength(MAX_HISTORY_DAYS);
  });

  it('drops the page checked longest ago beyond the limit', () => {
    let history = {};
    for (let page = 0; page <= MAX_HISTORY_PAGES; page++)
      history = recordScore(
        history,
        `page${String(page).padStart(8, '0')}`,
        entry(page === 0 ? '2026-01-01' : '2026-11-01', 80),
      );
    expect(Object.keys(history)).toHaveLength(MAX_HISTORY_PAGES);
    expect(history).not.toHaveProperty('page00000000');
  });

  it('reads stored history as untrusted', () => {
    expect(parseScoreHistory(null)).toEqual({});
    expect(parseScoreHistory([])).toEqual({});
    expect(
      parseScoreHistory({
        'NOT A KEY': [entry('2026-11-01', 50)],
        abcdef0123456789: [entry('2026-11-01', 150), { day: 'yesterday', score: 3 }, { day: '2026-11-02', score: 'x' }],
      }),
    ).toEqual({ abcdef0123456789: [{ day: '2026-11-01', score: 100, sizes: 3 }] });
  });

  it('gives the trend and a sparkline', () => {
    expect(scoreTrend([entry('2026-11-01', 60)])).toBeNull();
    const trend = scoreTrend([entry('2026-11-01', 60), entry('2026-11-02', 95), entry('2026-11-03', 88)]);
    expect(trend).toMatchObject({ change: 28, best: 95, grade: 'B' });
    expect(sparkline([entry('2026-11-01', 0), entry('2026-11-02', 100)], 64, 20)).toBe('0,20 64,0');
    expect(dayOf(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
  });
});

describe('image advice', () => {
  const sample = (patch: Partial<ImageSample>): ImageSample => ({
    selector: 'img:nth-of-type(1)',
    label: 'img',
    file: 'hero.jpg',
    width: 800,
    height: 450,
    naturalWidth: 1600,
    naturalHeight: 900,
    dpr: 2,
    responsive: true,
    loading: 'eager',
    firstScreen: true,
    format: 'jpg',
    dimensions: true,
    ...patch,
  });
  const row = (...samples: ImageSample[]) => ({
    sizes: samples.map((item, index): ImageAt => ({ cardId: `c${index}`, viewport: 400 + index * 400, sample: item })),
  });
  const kinds = (...samples: ImageSample[]) => imageAdvice(row(...samples)).map((tip) => tip.kind);

  it('suggests modern formats for large legacy files only', () => {
    expect(imageAdvice(row(sample({})))).toEqual([{ kind: 'format', format: 'jpg' }]);
    expect(kinds(sample({ format: 'webp' }))).toEqual([]);
    expect(kinds(sample({ width: 120 }))).toEqual([]);
  });

  it('flags lazy images in the first screen and eager ones below it everywhere', () => {
    expect(kinds(sample({ format: 'avif', loading: 'lazy' }), sample({ format: 'avif', firstScreen: false }))).toEqual([
      'lazyAbove',
    ]);
    expect(
      kinds(sample({ format: 'avif', firstScreen: false }), sample({ format: 'avif', firstScreen: false })),
    ).toEqual(['eagerBelow']);
    expect(kinds(sample({ format: 'avif', firstScreen: false, loading: 'lazy' }))).toEqual([]);
  });

  it('flags missing width and height, and says nothing for older agents', () => {
    expect(kinds(sample({ format: 'avif', dimensions: false }))).toEqual(['dimensions']);
    expect(
      kinds(sample({ format: undefined, loading: undefined, firstScreen: undefined, dimensions: undefined })),
    ).toEqual([]);
  });

  it('tells formats from file names and data URLs', () => {
    expect(imageFormat('https://cdn.example.com/a/photo.JPEG?w=200')).toBe('jpg');
    expect(imageFormat('https://example.com/hero.avif')).toBe('avif');
    expect(imageFormat('data:image/png;base64,AAAA')).toBe('png');
    expect(imageFormat('https://example.com/image')).toBe('');
    expect(imageFormat('not a url')).toBe('');
  });
});
