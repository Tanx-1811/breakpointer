import { describe, expect, it } from 'vitest';
import type { ColorSample, ImageSample, PageStats } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import { defaultSettings, parseSettings } from '../../src/services/storage';
import {
  EMPTY_BUDGETS,
  budgetBreaches,
  budgetLimit,
  budgetValue,
  hasBudgets,
  overBudget,
  parseBudgets,
} from '../../src/state/budgets';
import { COLOR_ROLE_KEYS, mergePalettes, paletteCss, paletteMarkdown, paletteSize } from '../../src/state/colors';
import { auditJson } from '../../src/state/export';
import { gapBetween, gapChanges, gapText } from '../../src/state/gap';
import {
  imageFit,
  imageRows,
  imagesMarkdown,
  neededWidth,
  srcsetText,
  suggestSizes,
  suggestSrcset,
  type ImageAt,
} from '../../src/state/images';
import { comparisonMarkdown } from '../../src/state/inspector';
import { PRO_FEATURES } from '../../src/state/plan';
import { settingsReducer } from '../../src/state/settings-reducer';
import { placeTourCard } from '../../src/state/tour';

const t = createTranslator('en');

const image = (width: number, naturalWidth: number, extra: Partial<ImageSample> = {}): ImageSample => ({
  selector: 'main > img',
  label: 'main > img.hero',
  file: 'hero.jpg',
  width,
  height: Math.round(width / 2),
  naturalWidth,
  naturalHeight: Math.round(naturalWidth / 2),
  dpr: 1,
  responsive: false,
  ...extra,
});

const at = (viewport: number, sample: ImageSample, cardId = `card-${viewport}`): ImageAt => ({
  cardId,
  viewport,
  sample,
});

const stats = (values: Partial<PageStats>): PageStats => ({
  requests: 10,
  transferred: 100_000,
  unknownSize: 0,
  images: 0,
  imagePixels: 0,
  shownPixels: 0,
  dpr: 1,
  elements: 100,
  height: 1000,
  lcp: 1000,
  cls: 0,
  fonts: 0,
  ...values,
});

describe('responsive images', () => {
  it('compares the file with what the screen needs', () => {
    expect(neededWidth({ width: 375, dpr: 2 })).toBe(750);
    expect(imageFit({ width: 375, dpr: 2, naturalWidth: 2400 })).toBe('large');
    expect(imageFit({ width: 375, dpr: 2, naturalWidth: 700 })).toBe('ok');
    expect(imageFit({ width: 375, dpr: 2, naturalWidth: 600 })).toBe('small');
    // Twice too wide but only a few pixels: not worth a warning.
    expect(imageFit({ width: 100, dpr: 1, naturalWidth: 200 })).toBe('ok');
  });

  it('suggests sizes in vw where the image follows the viewport and px where it stops', () => {
    const sizes = [
      at(375, image(375, 2400)),
      at(768, image(768, 2400)),
      at(1280, image(1200, 2400)),
      at(1440, image(1200, 2400)),
    ];
    expect(suggestSizes(sizes)).toBe('(max-width: 1279px) 100vw, 1200px');
    expect(suggestSizes([at(375, image(343, 800)), at(768, image(704, 800))])).toBe('91vw');
    expect(suggestSizes([at(1280, image(300, 600))])).toBe('300px');
    expect(suggestSizes([])).toBe('100vw');
  });

  it('suggests srcset widths for 1× and 2× screens, merged and at most six', () => {
    const sizes = [
      at(375, image(375, 2400)),
      at(768, image(768, 2400)),
      at(1280, image(1200, 2400)),
      at(1440, image(1200, 2400)),
    ];
    expect(suggestSrcset(sizes)).toEqual([380, 770, 1200, 1540, 2400]);
    const many = [200, 320, 480, 640, 800, 960, 1120, 1280].map((width) => at(width, image(width, 2000)));
    expect(suggestSrcset(many).length).toBeLessThanOrEqual(6);
    expect(srcsetText('hero.jpg', [380, 770])).toBe('hero-380.jpg 380w, hero-770.jpg 770w');
    expect(srcsetText('', [100])).toBe('image-100 100w');
  });

  it('groups each image across the previews, the most wasteful first', () => {
    const small = image(100, 100, { selector: 'footer > img', file: 'logo.png' });
    const rows = imageRows([
      at(375, small),
      at(375, image(375, 2400)),
      at(1280, image(1200, 2400, { responsive: true })),
      at(1280, small),
      // The same preview twice counts once.
      at(375, image(375, 2400)),
    ]);
    expect(rows.map((row) => row.file)).toEqual(['hero.jpg', 'logo.png']);
    expect(rows[0]!.sizes.map((size) => size.viewport)).toEqual([375, 1280]);
    expect(rows[0]!.responsive).toBe(true);
    const markdown = imagesMarkdown('https://example.com/', rows, 'Images', ['Image', 'Shown', 'Sizes', 'Srcset']);
    expect(markdown).toContain('Images · https://example.com/');
    expect(markdown).toContain('| hero.jpg | 375: 375px (2400px), 1280: 1200px (2400px) |');
  });
});

describe('colour palette', () => {
  const sample = (text: [string, number][], background: [string, number][] = []): ColorSample => ({
    text: text.map(([hex, count]) => ({ hex, count })),
    background: background.map(([hex, count]) => ({ hex, count })),
    border: [],
  });

  it('merges the previews, counting each colour as in the preview that uses it most', () => {
    const palette = mergePalettes([
      sample(
        [
          ['#1F2430', 40],
          ['#0066cc', 4],
        ],
        [['#ffffff', 12]],
      ),
      sample(
        [
          ['#1f2430', 55],
          ['nope', 99],
        ],
        [
          ['#ffffff', 9],
          ['#f5f5f5', 3],
        ],
      ),
      null,
      undefined,
    ]);
    expect(palette.text).toEqual([
      { hex: '#1f2430', count: 55 },
      { hex: '#0066cc', count: 4 },
    ]);
    expect(palette.background.map((color) => color.hex)).toEqual(['#ffffff', '#f5f5f5']);
    expect(paletteSize(palette)).toBe(4);
    expect(
      mergePalettes(
        [
          sample([
            ['#000000', 1],
            ['#111111', 1],
            ['#222222', 1],
          ]),
        ],
        2,
      ).text,
    ).toHaveLength(2);
  });

  it('copies as CSS custom properties and as a Markdown table', () => {
    const palette = mergePalettes([sample([['#1f2430', 40]], [['#ffffff', 12]])]);
    expect(paletteCss(palette)).toBe(
      ':root {\n  --text-1: #1f2430; /* 40 */\n  --background-1: #ffffff; /* 12 */\n}\n',
    );
    const markdown = paletteMarkdown(
      'https://example.com/',
      palette,
      'Colours',
      ['Used for', 'Colour', 'Elements'],
      (role) => t(COLOR_ROLE_KEYS[role]),
    );
    expect(markdown).toContain('| Text | `#1f2430` | 40 |');
    expect(markdown).toContain('| Backgrounds | `#ffffff` | 12 |');
  });
});

describe('performance budgets', () => {
  it('reads limits as typed or stored, and refuses the rest', () => {
    expect(budgetValue('transferred', '500')).toBe(500);
    expect(budgetValue('transferred', ' ')).toBeNull();
    expect(budgetValue('requests', -1)).toBeNull();
    expect(budgetValue('lcp', 99_999_999)).toBe(60_000);
    expect(budgetValue('cls', '0,256')).toBe(0.26);
    expect(budgetValue('requests', 40.4)).toBe(40);
    expect(parseBudgets({ transferred: '800', requests: 'many', lcp: null, cls: 0.1 })).toEqual({
      transferred: 800,
      requests: null,
      lcp: null,
      cls: 0.1,
    });
    expect(parseBudgets('nope')).toEqual(EMPTY_BUDGETS);
    expect(hasBudgets(EMPTY_BUDGETS)).toBe(false);
  });

  it('marks previews over a limit', () => {
    const budgets = { transferred: 500, requests: 40, lcp: 2500, cls: null };
    expect(budgetLimit('transferred', budgets)).toBe(500_000);
    expect(budgetLimit('cls', budgets)).toBeNull();
    expect(budgetLimit('elements', budgets)).toBeNull();
    expect(overBudget(stats({ transferred: 600_000 }), 'transferred', budgets)).toBe(true);
    expect(overBudget(stats({ transferred: 500_000 }), 'transferred', budgets)).toBe(false);
    // A largest contentful paint the page didn't report is never over.
    expect(overBudget(stats({ lcp: null }), 'lcp', budgets)).toBe(false);
    expect(budgetBreaches([stats({ requests: 41 }), stats({ requests: 90, lcp: 3000 }), stats({})], budgets)).toEqual([
      { metric: 'requests', previews: 2 },
      { metric: 'lcp', previews: 1 },
    ]);
  });

  it('are stored with the settings and changed one at a time', () => {
    expect(defaultSettings().budgets).toEqual(EMPTY_BUDGETS);
    expect(parseSettings({ budgets: { transferred: 300, cls: 'x' } }).budgets).toEqual({
      ...EMPTY_BUDGETS,
      transferred: 300,
    });
    const state = settingsReducer(defaultSettings(), { type: 'setBudgets', budgets: { lcp: 2500 } });
    expect(state.budgets).toEqual({ ...EMPTY_BUDGETS, lcp: 2500 });
    expect(settingsReducer(state, { type: 'setBudgets', budgets: { lcp: null } }).budgets).toEqual(EMPTY_BUDGETS);
  });

  it('are a Pro feature', () => {
    expect(PRO_FEATURES).toContain('budgets');
  });
});

describe('distance between two elements', () => {
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
  const words = { overlap: 'Overlapping', inside: (insets: string) => `Inside: ${insets}` };

  it('measures the space between their edges', () => {
    const a = box(0, 0, 100, 50);
    expect(gapBetween(a, box(130, 0, 100, 50))).toEqual({ relation: 'apart', horizontal: 30, vertical: null });
    expect(gapText(gapBetween(a, box(130, 0, 100, 50)), words)).toBe('↔ 30 px');
    expect(gapText(gapBetween(box(0, 80, 100, 20), a), words)).toBe('↕ 30 px');
    expect(gapText(gapBetween(a, box(120, 70, 10, 10)), words)).toBe('↔ 20 px · ↕ 20 px');
    // Touching: side by side, or stacked.
    expect(gapText(gapBetween(a, box(100, 0, 10, 10)), words)).toBe('↔ 0 px');
    expect(gapText(gapBetween(a, box(0, 50, 100, 20)), words)).toBe('↕ 0 px');
    expect(gapBetween(a, box(10.25, 60, 10, 10))).toEqual({ relation: 'apart', horizontal: null, vertical: 10 });
  });

  it('measures from each edge when one is inside the other, and tells overlaps', () => {
    const outer = box(0, 0, 200, 100);
    const inner = box(10, 20, 100, 30);
    expect(gapBetween(inner, outer)).toEqual({ relation: 'inside', top: 20, right: 90, bottom: 50, left: 10 });
    expect(gapText(gapBetween(outer, inner), words)).toBe('Inside: 20 px 90 px 50 px 10 px');
    expect(gapText(gapBetween(box(0, 0, 100, 100), box(50, 50, 100, 100)), words)).toBe('Overlapping');
  });

  it('notices when the distance changes between sizes', () => {
    const near = gapBetween(box(0, 0, 10, 10), box(20, 0, 10, 10));
    const far = gapBetween(box(0, 0, 10, 10), box(40, 0, 10, 10));
    expect(gapChanges([near, near, null, undefined])).toBe(false);
    expect(gapChanges([near, far])).toBe(true);
  });

  it('adds a column to the comparison table', () => {
    const labels = {
      viewport: 'Viewport',
      missing: 'Not on the page',
      hidden: 'Hidden',
      waiting: 'Waiting…',
      size: 'Size',
      display: 'Display',
      font: 'Font',
      margin: 'Margin',
      padding: 'Padding',
      layout: 'Layout',
      position: 'Position',
    };
    const markdown = comparisonMarkdown(
      'main > h1',
      [
        { name: 'Phone', width: 375, info: null, gap: { relation: 'apart', horizontal: null, vertical: 24 } },
        { name: 'Desktop', width: 1440, info: null, gap: null },
      ],
      labels,
      { heading: 'Distance to p.lead', missing: 'Not both shown', words },
    );
    expect(markdown).toContain(
      '| Viewport | Size | Display | Font | Margin | Padding | Layout | Position | Distance to p.lead |',
    );
    expect(markdown).toContain('↕ 24 px |');
    expect(markdown).toContain('Not both shown |');
    expect(comparisonMarkdown('main > h1', [], labels)).not.toContain('Distance');
  });
});

describe('tour', () => {
  const window = { width: 1280, height: 800 };
  const card = { width: 320, height: 150 };

  it('puts the card below the control, inside the window', () => {
    expect(placeTourCard({ x: 100, y: 10, width: 40, height: 30 }, card, window)).toEqual({
      top: 52,
      left: 12,
      placement: 'below',
    });
    expect(placeTourCard({ x: 1250, y: 10, width: 30, height: 30 }, card, window).left).toBe(948);
  });

  it('puts it above when there is no room below', () => {
    expect(placeTourCard({ x: 600, y: 760, width: 40, height: 30 }, card, window)).toEqual({
      top: 598,
      left: 460,
      placement: 'above',
    });
  });
});

describe('audit export', () => {
  it('includes each preview’s images and colours', () => {
    const json = JSON.parse(
      auditJson(
        'https://example.com/',
        [
          {
            name: 'Phone',
            width: 375,
            height: 667,
            report: null,
            images: [image(375, 2400)],
            colors: { text: [{ hex: '#000000', count: 3 }], background: [], border: [] },
          },
        ],
        '0.8.0',
      ),
    );
    expect(json.previews[0].images[0].file).toBe('hero.jpg');
    expect(json.previews[0].colors.text[0].hex).toBe('#000000');
  });
});
