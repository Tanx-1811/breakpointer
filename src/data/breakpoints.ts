import type { BreakpointSetId } from '../types';

type Breakpoint = { name: string; min: number };

type BreakpointSet = { base: string; breakpoints: Breakpoint[] };

/** Default min-width breakpoints of popular CSS frameworks. */
export const BREAKPOINT_SETS: Record<Exclude<BreakpointSetId, 'none'>, BreakpointSet> = {
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

/** The active breakpoint for a viewport width, e.g. "md", or null when disabled. */
export function breakpointFor(set: BreakpointSetId, width: number): string | null {
  if (set === 'none') return null;
  const { base, breakpoints } = BREAKPOINT_SETS[set];
  let active = base;
  for (const breakpoint of breakpoints) {
    if (width >= breakpoint.min) active = breakpoint.name;
  }
  return active;
}
