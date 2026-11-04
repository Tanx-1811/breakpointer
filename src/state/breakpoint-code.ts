import type { Breakpoint } from '../types';
import { cssNumber } from './fluid';

/**
 * The breakpoints in use written as code, for the CSS toolkit: media queries
 * (mobile first, desktop first or range syntax), a Sass map with mixins,
 * Tailwind's screens, `@custom-media` and JavaScript.
 */
export const CODE_FORMATS = [
  'css-min',
  'css-max',
  'css-range',
  'scss',
  'tailwind4',
  'tailwind3',
  'custom-media',
  'js',
] as const;
export type CodeFormat = (typeof CODE_FORMATS)[number];

export type QueryUnit = 'px' | 'em';

export type NamedBreakpoint = { name: string; id: string; min: number };

/**
 * Names usable as identifiers: the set's own names in lower case (`sm`,
 * `2xl`), or `bp-<width>` for names that aren't (the site's `≥768`); each once.
 */
export function namedBreakpoints(breakpoints: readonly Breakpoint[]): NamedBreakpoint[] {
  const used = new Set<string>();
  return [...breakpoints]
    .filter((breakpoint) => Number.isFinite(breakpoint.min) && breakpoint.min > 0)
    .sort((a, b) => a.min - b.min)
    .map((breakpoint) => {
      const slug = breakpoint.name
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      let id = /[a-z]/.test(slug) ? slug : `bp-${breakpoint.min}`;
      if (used.has(id)) id = `${id}-${breakpoint.min}`;
      used.add(id);
      return { name: breakpoint.name, id, min: breakpoint.min };
    });
}

/** `768px`, or `48em` (at 16 px, as media queries read em). */
const width = (px: number, unit: QueryUnit) => (unit === 'em' ? `${cssNumber(px / 16)}em` : `${cssNumber(px, 2)}px`);

/** The width just below a breakpoint for `max-width` queries (0.02 px less, as Bootstrap does, so no width is in both). */
const below = (px: number, unit: QueryUnit) => width(px - 0.02, unit);

/** A JavaScript key: bare when it is an identifier, quoted otherwise (`'2xl'`). */
const jsKey = (id: string) => (/^[a-z_$][\w$]*$/i.test(id) ? id : `'${id}'`);

export type CodeOptions = { unit: QueryUnit; base: string };

export function breakpointCode(format: CodeFormat, list: readonly NamedBreakpoint[], options: CodeOptions): string {
  const { unit } = options;
  const base = options.base || 'base';
  if (list.length === 0) return '';
  switch (format) {
    case 'css-min':
      return [
        `/* Mobile first: styles outside any query are for ${base}, below ${list[0]!.min}px. */`,
        ...list.map((bp) => `@media (min-width: ${width(bp.min, unit)}) {\n  /* ${bp.name} and up */\n}`),
      ].join('\n\n');
    case 'css-max':
      return [
        `/* Desktop first: styles outside any query are for ${list[list.length - 1]!.name} and up. */`,
        ...[...list].reverse().map((bp, index, reversed) => {
          const name = reversed[index + 1]?.name ?? base;
          return `@media (max-width: ${below(bp.min, unit)}) {\n  /* ${name} and down */\n}`;
        }),
      ].join('\n\n');
    case 'css-range':
      return [
        `@media (width < ${width(list[0]!.min, unit)}) {\n  /* ${base} */\n}`,
        ...list.map((bp, index) => {
          const next = list[index + 1];
          const condition = next
            ? `(${width(bp.min, unit)} <= width < ${width(next.min, unit)})`
            : `(width >= ${width(bp.min, unit)})`;
          return `@media ${condition} {\n  /* ${bp.name} */\n}`;
        }),
      ].join('\n\n');
    case 'scss':
      return [
        "@use 'sass:map';",
        '',
        '$breakpoints: (',
        ...list.map((bp, index) => `  '${bp.id}': ${width(bp.min, unit)}${index < list.length - 1 ? ',' : ''}`),
        ');',
        '',
        `/// Styles from this breakpoint up: @include up('${list[0]!.id}') { … }`,
        '@mixin up($name) {',
        '  @media (min-width: map.get($breakpoints, $name)) {',
        '    @content;',
        '  }',
        '}',
        '',
        `/// Styles below this breakpoint: @include down('${list[0]!.id}') { … }`,
        '@mixin down($name) {',
        `  @media (max-width: map.get($breakpoints, $name) - ${unit === 'em' ? '0.00125em' : '0.02px'}) {`,
        '    @content;',
        '  }',
        '}',
      ].join('\n');
    case 'tailwind4':
      return [
        '@import "tailwindcss";',
        '',
        '@theme {',
        '  --breakpoint-*: initial;',
        ...list.map((bp) => `  --breakpoint-${bp.id}: ${cssNumber(bp.min / 16)}rem; /* ${cssNumber(bp.min, 2)}px */`),
        '}',
      ].join('\n');
    case 'tailwind3':
      return [
        "/** @type {import('tailwindcss').Config} */",
        'module.exports = {',
        '  theme: {',
        '    screens: {',
        ...list.map((bp) => `      ${jsKey(bp.id)}: '${cssNumber(bp.min, 2)}px',`),
        '    },',
        '  },',
        '};',
      ].join('\n');
    case 'custom-media':
      return [
        '/* Needs PostCSS (postcss-custom-media) or a browser with @custom-media. */',
        ...list.map((bp) => `@custom-media --${bp.id}-up (min-width: ${width(bp.min, unit)});`),
        ...list.map((bp) => `@custom-media --${bp.id}-down (max-width: ${below(bp.min, unit)});`),
        '',
        `@media (--${list[0]!.id}-up) {\n  /* … */\n}`,
      ].join('\n');
    case 'js':
      return [
        'export const breakpoints = {',
        ...list.map((bp) => `  ${jsKey(bp.id)}: ${cssNumber(bp.min, 2)},`),
        '};',
        '',
        '/** Media queries from each breakpoint up. */',
        'export const up = {',
        ...list.map((bp) => `  ${jsKey(bp.id)}: '(min-width: ${width(bp.min, unit)})',`),
        '};',
        '',
        `// window.matchMedia(up${/^[a-z_$][\w$]*$/i.test(list[0]!.id) ? `.${list[0]!.id}` : `['${list[0]!.id}']`}).matches`,
      ].join('\n');
  }
}
