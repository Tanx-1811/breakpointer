import type { Breakpoint } from '../types';

/** Where something sits on the map, from 0 (the left end) to 1 (the right end). */
export type MapTick = Breakpoint & { at: number; labelled: boolean };
export type MapMarker<T> = { item: T; width: number; at: number };

export type BreakpointMap<T> = {
  /** The widths at both ends (CSS pixels). */
  start: number;
  end: number;
  ticks: MapTick[];
  markers: MapMarker<T>[];
};

/** The narrowest range the map shows: phones to a common desktop. */
const MIN_START = 320;
const MIN_END = 1920;
/** Labels closer than this (a share of the map) would overlap: only the first is written. */
const LABEL_GAP = 0.09;

/**
 * A ruler of widths for the viewports sidebar: each breakpoint as a tick and
 * each viewport as a marker, so you see which side of a breakpoint every
 * viewport is on. The range covers 320–1920 at least, and every width shown,
 * rounded out to hundreds.
 */
export function breakpointMap<T>(items: { item: T; width: number }[], breakpoints: Breakpoint[]): BreakpointMap<T> {
  const widths = [...items.map((entry) => entry.width), ...breakpoints.map((breakpoint) => breakpoint.min)];
  const start = Math.floor(Math.min(MIN_START, ...widths) / 100) * 100;
  const end = Math.ceil(Math.max(MIN_END, ...widths) / 100) * 100;
  const at = (width: number) => (width - start) / (end - start);

  let lastLabel = -Infinity;
  const ticks = [...breakpoints]
    .sort((a, b) => a.min - b.min)
    .map((breakpoint) => {
      const position = at(breakpoint.min);
      const labelled = position - lastLabel >= LABEL_GAP;
      if (labelled) lastLabel = position;
      return { ...breakpoint, at: position, labelled };
    });
  const markers = items.map((entry) => ({ ...entry, at: at(entry.width) }));
  return { start, end, ticks, markers };
}

/** "390–1440" for the widths shown, or null when there are none. */
export function widthRange(widths: number[]): string | null {
  if (widths.length === 0) return null;
  const low = Math.min(...widths);
  const high = Math.max(...widths);
  return low === high ? String(low) : `${low}–${high}`;
}
