import { describe, expect, it } from 'vitest';
import { FRAMEWORK_BREAKPOINTS } from '../../src/data/breakpoints';
import { aspectCss, aspectRatio, heightAt, ratioText } from '../../src/state/aspect';
import { badgeFileName, BADGE_COLORS, scoreBadgeSvg, textWidth } from '../../src/state/badge';
import { breakpointCode, CODE_FORMATS, namedBreakpoints } from '../../src/state/breakpoint-code';
import {
  allFormats,
  contrastOnWhiteAndBlack,
  formatColor,
  hslToRgb,
  parseAnyColor,
  rgbToHsl,
  rgbToOklch,
} from '../../src/state/color-formats';
import {
  cssNumber,
  fluidAt,
  fluidClamp,
  fluidDeclaration,
  typeScale,
  typeScaleCss,
  validFluid,
  zoomRisk,
  type FluidSpec,
} from '../../src/state/fluid';
import { addRecentColor, MAX_RECENT_COLORS, readNumber } from '../../src/state/toolkit';
import { convertLength, formatUnit, parseLength, unitMarkdown, unitTable } from '../../src/state/units';

const spec = (patch: Partial<FluidSpec> = {}): FluidSpec => ({
  minSize: 16,
  maxSize: 24,
  minViewport: 320,
  maxViewport: 1280,
  unit: 'rem',
  root: 16,
  ...patch,
});

describe('fluid sizes', () => {
  it('writes a clamp() with a rem part, in rem or px', () => {
    // slope = 8 / 960 = 0.008333…; intercept = 16 − 0.008333 × 320 = 13.333 px.
    expect(fluidClamp(spec()).css).toBe('clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)');
    expect(fluidClamp(spec({ unit: 'px' })).css).toBe('clamp(16px, 13.33px + 0.8333vw, 24px)');
  });

  it('gives the size at each viewport, held at both ends', () => {
    expect(fluidAt(spec(), 200)).toBe(16);
    expect(fluidAt(spec(), 800)).toBeCloseTo(20);
    expect(fluidAt(spec(), 1920)).toBe(24);
  });

  it('handles sizes that shrink, equal sizes and a line through 0', () => {
    const shrinking = spec({ minSize: 24, maxSize: 16 });
    expect(fluidClamp(shrinking).css).toMatch(/^clamp\(1rem, 1\.6667rem - 0\.8333vw, 1\.5rem\)$/);
    expect(fluidAt(shrinking, 1280)).toBe(16);
    expect(fluidClamp(spec({ maxSize: 16 })).css).toBe('1rem');
    expect(fluidClamp(spec({ minSize: 10, maxSize: 20, minViewport: 500, maxViewport: 1000 })).css).toBe(
      'clamp(0.625rem, 2vw, 1.25rem)',
    );
  });

  it('says when the numbers are unusable or zoom may not double the text', () => {
    expect(validFluid(spec())).toBe(true);
    expect(validFluid(spec({ minViewport: 1280 }))).toBe(false);
    expect(validFluid(spec({ minSize: 0 }))).toBe(false);
    expect(validFluid(spec({ root: Number.NaN }))).toBe(false);
    expect(zoomRisk(spec())).toBe(false);
    expect(zoomRisk(spec({ maxSize: 48 }))).toBe(true);
  });

  it('writes declarations and clean numbers', () => {
    expect(fluidDeclaration('  ', spec())).toMatch(/^font-size: clamp\(/);
    expect(fluidDeclaration('padding-inline', spec())).toMatch(/^padding-inline: /);
    expect(cssNumber(-0.00001)).toBe('0');
    expect(cssNumber(1.23456789)).toBe('1.2346');
    expect(cssNumber(2.5, 2)).toBe('2.5');
  });

  it('builds a type scale from the largest step down, with custom properties', () => {
    const scale = {
      minBase: 16,
      maxBase: 20,
      minRatio: 1.2,
      maxRatio: 1.25,
      minViewport: 360,
      maxViewport: 1440,
      stepsDown: 2,
      stepsUp: 3,
      unit: 'rem' as const,
      root: 16,
    };
    const steps = typeScale(scale);
    expect(steps.map((step) => step.name)).toEqual([
      '--step-3',
      '--step-2',
      '--step-1',
      '--step-0',
      '--step--1',
      '--step--2',
    ]);
    const zero = steps.find((step) => step.step === 0)!;
    expect([zero.min, zero.max]).toEqual([16, 20]);
    expect(steps[0]!.min).toBeCloseTo(16 * 1.2 ** 3);
    expect(steps[0]!.max).toBeCloseTo(20 * 1.25 ** 3);
    const css = typeScaleCss(scale, steps);
    expect(css).toContain(':root {');
    expect(css).toContain('  --step-0: clamp(1rem, ');
    expect(css.trim().endsWith('}')).toBe(true);
    // Step counts are kept within reason.
    expect(typeScale({ ...scale, stepsUp: 99, stepsDown: -3 })).toHaveLength(9);
  });
});

describe('units', () => {
  const context = { root: 16, parent: 20 };
  const phone = { width: 375, height: 667 };

  it('converts between every unit through px', () => {
    expect(convertLength(24, 'px', 'rem', context, phone)).toBe(1.5);
    expect(convertLength(1.5, 'em', 'px', context, phone)).toBe(30);
    expect(convertLength(12, 'pt', 'px', context, phone)).toBe(16);
    expect(convertLength(10, 'vw', 'px', context, phone)).toBe(37.5);
    expect(convertLength(100, 'vh', 'vmax', context, phone)).toBe(100);
    expect(convertLength(10, 'vmin', 'px', context, phone)).toBe(37.5);
    expect(convertLength(1, 'rem', 'px', { root: 0, parent: 16 }, phone)).toBeNull();
  });

  it('tables a value at every viewport, marking units that change', () => {
    const rows = unitTable(16, 'px', context, [phone, { width: 1440, height: 900 }]);
    const row = (unit: string) => rows.find((item) => item.unit === unit)!;
    expect(row('rem').values).toEqual([1, 1]);
    expect(row('rem').varies).toBe(false);
    expect(row('vw').varies).toBe(true);
    expect(formatUnit(row('vw').values[0]!, 'vw')).toBe('4.267vw');
    expect(formatUnit(16, 'px')).toBe('16px');
  });

  it('reads typed lengths', () => {
    expect(parseLength('24')).toEqual({ value: 24, unit: null });
    expect(parseLength(' 1.5rem ')).toEqual({ value: 1.5, unit: 'rem' });
    expect(parseLength('4,2VW')).toEqual({ value: 4.2, unit: 'vw' });
    expect(parseLength('.5em')).toEqual({ value: 0.5, unit: 'em' });
    expect(parseLength('-8px')).toEqual({ value: -8, unit: 'px' });
    expect(parseLength('12%')).toBeNull();
    expect(parseLength('abc')).toBeNull();
    expect(parseLength('')).toBeNull();
  });

  it('writes the table as Markdown', () => {
    const markdown = unitMarkdown(24, 'px', context, [{ ...phone, name: 'Phone' }], { unit: 'Unit' });
    expect(markdown).toContain('**24px**');
    expect(markdown).toContain('| Unit | Phone (375×667) |');
    expect(markdown).toContain('| rem | 1.5rem |');
  });
});

describe('breakpoints as code', () => {
  const tailwind = namedBreakpoints(FRAMEWORK_BREAKPOINTS.tailwind.breakpoints);

  it('names breakpoints as identifiers, once each, smallest first', () => {
    expect(tailwind.map((bp) => bp.id)).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
    const site = namedBreakpoints([
      { name: '≥1024', min: 1024 },
      { name: '≥768', min: 768 },
    ]);
    expect(site.map((bp) => bp.id)).toEqual(['bp-768', 'bp-1024']);
    expect(
      namedBreakpoints([
        { name: 'Tablet', min: 768 },
        { name: 'tablet', min: 900 },
      ]).map((bp) => bp.id),
    ).toEqual(['tablet', 'tablet-900']);
  });

  it('writes mobile-first, desktop-first and range queries', () => {
    const min = breakpointCode('css-min', tailwind, { unit: 'px', base: 'base' });
    expect(min).toContain('@media (min-width: 640px) {');
    expect(min).toContain('below 640px');
    const max = breakpointCode('css-max', tailwind, { unit: 'px', base: 'base' });
    expect(max).toContain('@media (max-width: 1535.98px) {\n  /* xl and down */');
    expect(max).toContain('@media (max-width: 639.98px) {\n  /* base and down */');
    const range = breakpointCode('css-range', tailwind, { unit: 'em', base: 'base' });
    expect(range).toContain('@media (width < 40em)');
    expect(range).toContain('@media (40em <= width < 48em)');
    expect(range).toContain('@media (width >= 96em)');
  });

  it('writes Sass, Tailwind, custom media and JavaScript', () => {
    const scss = breakpointCode('scss', tailwind, { unit: 'px', base: 'base' });
    expect(scss).toContain("'2xl': 1536px");
    expect(scss).toContain('@mixin up($name)');
    expect(scss).toContain('map.get($breakpoints, $name) - 0.02px');
    expect(breakpointCode('tailwind4', tailwind, { unit: 'px', base: 'base' })).toContain('--breakpoint-md: 48rem;');
    expect(breakpointCode('tailwind3', tailwind, { unit: 'px', base: 'base' })).toContain("'2xl': '1536px',");
    expect(breakpointCode('custom-media', tailwind, { unit: 'px', base: 'base' })).toContain(
      '@custom-media --md-up (min-width: 768px);',
    );
    const js = breakpointCode('js', tailwind, { unit: 'px', base: 'base' });
    expect(js).toContain("  '2xl': 1536,");
    expect(js).toContain('  md: 768,');
    expect(js).toContain('window.matchMedia(up.sm).matches');
  });

  it('writes nothing for an empty set, something for every format otherwise', () => {
    expect(breakpointCode('css-min', [], { unit: 'px', base: 'base' })).toBe('');
    for (const format of CODE_FORMATS)
      expect(breakpointCode(format, tailwind, { unit: 'px', base: 'base' }).length, format).toBeGreaterThan(20);
  });
});

describe('colour formats', () => {
  const indigo = { r: 79, g: 70, b: 229, a: 1 };

  it('converts to HSL and back', () => {
    const hsl = rgbToHsl(indigo);
    expect(Math.round(hsl.h)).toBe(243);
    expect(Math.round(hsl.s)).toBe(75);
    expect(Math.round(hsl.l)).toBe(59);
    expect(hslToRgb(hsl.h, hsl.s, hsl.l)).toEqual(indigo);
    expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, l: expect.closeTo(50.2, 1) });
  });

  it('converts to OKLCH like CSS Color 4', () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255, a: 1 });
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeLessThan(0.0001);
    const red = rgbToOklch({ r: 255, g: 0, b: 0, a: 1 });
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.c).toBeCloseTo(0.2577, 2);
    expect(red.h).toBeCloseTo(29.23, 0);
  });

  it('writes every format, with alpha when translucent', () => {
    expect(formatColor(indigo, 'hex')).toBe('#4f46e5');
    expect(formatColor(indigo, 'rgb')).toBe('rgb(79 70 229)');
    expect(formatColor(indigo, 'hsl')).toMatch(/^hsl\(243(\.\d)? 75(\.\d)?% 58\.6%\)$/);
    expect(formatColor(indigo, 'oklch')).toMatch(/^oklch\(\d+(\.\d)?% 0\.\d+ \d+(\.\d)?\)$/);
    expect(formatColor({ ...indigo, a: 0.5 }, 'hex')).toBe('#4f46e580');
    expect(formatColor({ ...indigo, a: 0.5 }, 'rgb')).toBe('rgb(79 70 229 / 0.5)');
    expect(allFormats(indigo).split('\n')).toHaveLength(4);
  });

  it('reads HEX, rgb(), hsl(), oklch() and names through the browser', () => {
    expect(parseAnyColor('#4f46e5')).toEqual(indigo);
    expect(parseAnyColor('rgb(79, 70, 229)')).toEqual(indigo);
    expect(parseAnyColor('hsl(0 100% 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseAnyColor('hsla(0, 100%, 50%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    const oklch = parseAnyColor('oklch(62.8% 0.2577 29.23)');
    expect(oklch && Math.round(oklch.r)).toBe(255);
    expect(parseAnyColor('rebeccapurple', () => 'rgb(102, 51, 153)')).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(parseAnyColor('nonsense', () => null)).toBeNull();
    expect(parseAnyColor('')).toBeNull();
  });

  it('measures contrast on white and black', () => {
    const { white, black } = contrastOnWhiteAndBlack({ r: 0, g: 0, b: 0, a: 1 });
    expect(white).toBeCloseTo(21);
    expect(black).toBeCloseTo(1);
  });

  it('keeps recent colours once each, newest first, within the limit', () => {
    expect(addRecentColor(['#fff', '#000'], '#FFF')).toEqual(['#FFF', '#000']);
    expect(addRecentColor([], '  ')).toEqual([]);
    const many = Array.from({ length: 20 }, (_, index) => `#${index}`);
    expect(addRecentColor(many, '#new')).toHaveLength(MAX_RECENT_COLORS);
  });

  it('reads typed numbers with a comma or a point', () => {
    expect(readNumber('1,5')).toBe(1.5);
    expect(readNumber(' 16 ')).toBe(16);
    expect(readNumber('16px')).toBeNull();
    expect(readNumber('')).toBeNull();
  });
});

describe('aspect ratios', () => {
  it('simplifies, and names the common ratio nearby', () => {
    expect(aspectRatio(1920, 1080)).toMatchObject({ width: 16, height: 9, near: null });
    const laptop = aspectRatio(1366, 768)!;
    expect([laptop.width, laptop.height]).toEqual([683, 384]);
    expect(laptop.near).toEqual({ width: 16, height: 9 });
    expect(ratioText(laptop)).toBe('1.779:1');
    expect(ratioText(aspectRatio(4, 3)!)).toBe('4:3');
    expect(aspectRatio(2.39, 1)).toMatchObject({ width: 239, height: 100 });
    expect(aspectRatio(0, 9)).toBeNull();
  });

  it('writes the CSS and the height of a box at a viewport', () => {
    const wide = aspectRatio(16, 9)!;
    expect(aspectCss(wide)).toContain('aspect-ratio: 16 / 9;');
    expect(aspectCss(wide)).toContain('padding-top: 56.25%;');
    expect(heightAt(375, 100, wide)).toBe(210.94);
    expect(heightAt(1440, 50, wide)).toBe(405);
  });
});

describe('score badge', () => {
  it('is an SVG with the score, the grade’s colour and an accessible name', () => {
    const svg = scoreBadgeSvg({ score: 92, grade: 'A' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="responsive: 92 (A)"');
    expect(svg).toContain('>92 · A</text>');
    expect(svg).toContain(BADGE_COLORS.A);
    expect(scoreBadgeSvg({ score: 40, grade: 'F' }, 'a<b')).toContain('a&lt;b');
  });

  it('estimates text widths and names the file after the site', () => {
    expect(textWidth('WWW')).toBeGreaterThan(textWidth('iii'));
    expect(badgeFileName('https://www.example.com/page')).toBe('responsive-score-example.com.svg');
    expect(badgeFileName(null)).toBe('responsive-score.svg');
    expect(badgeFileName('not a url')).toBe('responsive-score.svg');
  });
});
