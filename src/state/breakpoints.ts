import type { Breakpoint } from '../types';
import { MAX_BREAKPOINT_NAME, MAX_CUSTOM_BREAKPOINTS, MAX_DIMENSION, MIN_DIMENSION } from '../utils/constants';
import { isValidDimension } from './viewports';

/** A breakpoint row as typed in Settings (the width is still text). */
export type BreakpointDraft = { name: string; min: string };

export function toDrafts(list: Breakpoint[]): BreakpointDraft[] {
  return list.map(({ name, min }) => ({ name, min: String(min) }));
}

/**
 * The breakpoints the rows describe, sorted by width, or null if any row is
 * invalid: every row needs a name (up to 12 characters) and its own whole
 * width within the viewport limits; names must differ too.
 */
export function validateBreakpoints(drafts: BreakpointDraft[]): Breakpoint[] | null {
  if (drafts.length > MAX_CUSTOM_BREAKPOINTS) return null;
  const names = new Set<string>();
  const widths = new Set<number>();
  const list: Breakpoint[] = [];
  for (const draft of drafts) {
    const name = draft.name.trim();
    const raw = draft.min.trim();
    const min = Number(raw);
    if (!name || name.length > MAX_BREAKPOINT_NAME || raw === '' || !isValidDimension(min)) return null;
    if (names.has(name.toLowerCase()) || widths.has(min)) return null;
    names.add(name.toLowerCase());
    widths.add(min);
    list.push({ name, min });
  }
  return list.sort((a, b) => a.min - b.min);
}

/** A sensible new row: a little wider than the widest one, with an unused name. */
export function suggestBreakpoint(list: Breakpoint[]): Breakpoint {
  const widths = new Set(list.map((item) => item.min));
  let min = list.length ? Math.max(...list.map((item) => item.min)) + 256 : 640;
  if (min > MAX_DIMENSION) min = MIN_DIMENSION;
  while (widths.has(min) && min < MAX_DIMENSION) min += 1;
  const names = new Set(list.map((item) => item.name.toLowerCase()));
  let index = list.length + 1;
  while (names.has(`bp${index}`)) index += 1;
  return { name: `bp${index}`, min };
}
