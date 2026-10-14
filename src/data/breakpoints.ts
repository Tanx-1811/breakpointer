import type { Breakpoint, BreakpointSetId } from '../types';
import { MAX_DIMENSION, MIN_DIMENSION } from '../utils/constants';

type BreakpointSet = { base: string; breakpoints: Breakpoint[] };

/** Default min-width breakpoints of popular CSS frameworks. */
export const FRAMEWORK_BREAKPOINTS: Record<'tailwind' | 'bootstrap', BreakpointSet> = {
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
export function breakpointSet(set: BreakpointSetId, custom: Breakpoint[] = [], site: number[] = []): BreakpointSet | null {
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
