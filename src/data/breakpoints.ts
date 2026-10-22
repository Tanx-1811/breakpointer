import type { Breakpoint, BreakpointSetId, FrameworkSetId } from '../types';
import { MAX_DIMENSION, MIN_DIMENSION } from '../utils/constants';

type BreakpointSet = { base: string; breakpoints: Breakpoint[] };

/** The frameworks in the order they are offered (most used first). */
export const FRAMEWORK_SET_IDS: readonly FrameworkSetId[] = [
  'tailwind',
  'bootstrap',
  'mui',
  'chakra',
  'antd',
  'bulma',
  'foundation',
];

/**
 * Default min-width breakpoints of popular CSS frameworks, as their docs give
 * them (em values at 16px). `base` names the range below the first one.
 */
export const FRAMEWORK_BREAKPOINTS: Record<FrameworkSetId, BreakpointSet> = {
  tailwind: {
    base: 'base',
    breakpoints: [
      { name: 'sm', min: 640 },
      { name: 'md', min: 768 },
      { name: 'lg', min: 1024 },
      { name: 'xl', min: 1280 },
      { name: '2xl', min: 1536 },
    ],
  },
  bootstrap: {
    base: 'xs',
    breakpoints: [
      { name: 'sm', min: 576 },
      { name: 'md', min: 768 },
      { name: 'lg', min: 992 },
      { name: 'xl', min: 1200 },
      { name: 'xxl', min: 1400 },
    ],
  },
  // Material UI (MUI): xs 0, sm 600, md 900, lg 1200, xl 1536.
  mui: {
    base: 'xs',
    breakpoints: [
      { name: 'sm', min: 600 },
      { name: 'md', min: 900 },
      { name: 'lg', min: 1200 },
      { name: 'xl', min: 1536 },
    ],
  },
  // Chakra UI: sm 30em, md 48em, lg 62em, xl 80em, 2xl 96em.
  chakra: {
    base: 'base',
    breakpoints: [
      { name: 'sm', min: 480 },
      { name: 'md', min: 768 },
      { name: 'lg', min: 992 },
      { name: 'xl', min: 1280 },
      { name: '2xl', min: 1536 },
    ],
  },
  // Ant Design: xs below 576, then sm, md, lg, xl, xxl.
  antd: {
    base: 'xs',
    breakpoints: [
      { name: 'sm', min: 576 },
      { name: 'md', min: 768 },
      { name: 'lg', min: 992 },
      { name: 'xl', min: 1200 },
      { name: 'xxl', min: 1600 },
    ],
  },
  // Bulma: mobile up to 768, tablet from 769.
  bulma: {
    base: 'mobile',
    breakpoints: [
      { name: 'tablet', min: 769 },
      { name: 'desktop', min: 1024 },
      { name: 'widescreen', min: 1216 },
      { name: 'fullhd', min: 1408 },
    ],
  },
  // Foundation for Sites 6: small 0, medium 40em, large 64em, xlarge 75em, xxlarge 90em.
  foundation: {
    base: 'small',
    breakpoints: [
      { name: 'medium', min: 640 },
      { name: 'large', min: 1024 },
      { name: 'xlarge', min: 1200 },
      { name: 'xxlarge', min: 1440 },
    ],
  },
};

/**
 * The page's own breakpoints (widths found in its media queries) as a set:
 * "≥768" from 768px, "<640" below the first one. Null until some are known.
 */
export function siteBreakpointSet(widths: number[]): BreakpointSet | null {
  const list = [...new Set(widths)].filter((width) => width >= MIN_DIMENSION && width <= MAX_DIMENSION);
  if (list.length === 0) return null;
  list.sort((a, b) => a - b);
  return { base: `<${list[0]}`, breakpoints: list.map((min) => ({ name: `≥${min}`, min })) };
}

/**
 * The breakpoints in use, or null when labels are off. `custom` is the user's
 * own list; `site` the widths detected in the previewed page's stylesheets.
 */
export function breakpointSet(
  set: BreakpointSetId,
  custom: Breakpoint[] = [],
  site: number[] = [],
): BreakpointSet | null {
  if (set === 'none') return null;
  if (set === 'custom') return { base: 'base', breakpoints: [...custom].sort((a, b) => a.min - b.min) };
  if (set === 'site') return siteBreakpointSet(site);
  return FRAMEWORK_BREAKPOINTS[set];
}

/** The active breakpoint for a viewport width, e.g. "md", or null when disabled. */
export function breakpointFor(
  set: BreakpointSetId,
  width: number,
  custom: Breakpoint[] = [],
  site: number[] = [],
): string | null {
  const active = breakpointSet(set, custom, site);
  if (!active) return null;
  let name = active.base;
  for (const breakpoint of active.breakpoints) {
    if (width >= breakpoint.min) name = breakpoint.name;
  }
  return name;
}

/**
 * Viewports on both sides of each breakpoint (e.g. 767 and 768), the widths
 * where layouts most often break. Uses Tailwind's when labels are off; at most
 * `limit` viewports, all within the allowed viewport widths.
 */
export function breakpointEdges(
  set: BreakpointSetId,
  custom: Breakpoint[],
  limit: number,
  site: number[] = [],
): { name: string; width: number }[] {
  const active = breakpointSet(set === 'none' ? 'tailwind' : set, custom, site);
  const edges: { name: string; width: number }[] = [];
  for (const breakpoint of active?.breakpoints ?? []) {
    const below = breakpoint.min - 1;
    // The site's breakpoints are named by their width already.
    const names =
      set === 'site'
        ? { below: `${below}px`, at: `${breakpoint.min}px` }
        : { below: `< ${breakpoint.name} · ${below}`, at: `${breakpoint.name} · ${breakpoint.min}` };
    const pair = [
      ...(below >= MIN_DIMENSION ? [{ name: names.below, width: below }] : []),
      ...(breakpoint.min <= MAX_DIMENSION ? [{ name: names.at, width: breakpoint.min }] : []),
    ];
    if (edges.length + pair.length > limit) break;
    edges.push(...pair);
  }
  return edges;
}
