import type { BreakpointSetId } from '../types';
import type { CodeFormat, QueryUnit } from './breakpoint-code';
import type { FluidUnit } from './fluid';
import type { CssUnit } from './units';

/**
 * The CSS toolkit's fields, kept by the workspace for the session so the
 * dialog reopens where it was left. Numbers stay as typed (drafts) and are
 * read with `readNumber`.
 */
export const TOOLKIT_TABS = ['fluid', 'units', 'code', 'colors', 'aspect', 'grid', 'images', 'queries'] as const;
export type ToolkitTab = (typeof TOOLKIT_TABS)[number];

export type ToolkitState = {
  fluid: {
    mode: 'single' | 'scale';
    minViewport: string;
    maxViewport: string;
    unit: FluidUnit;
    root: string;
    minSize: string;
    maxSize: string;
    property: string;
    minBase: string;
    maxBase: string;
    minRatio: string;
    maxRatio: string;
    stepsDown: string;
    stepsUp: string;
  };
  units: { value: string; from: CssUnit; root: string; parent: string };
  /** `source` null: the breakpoints the toolbar labels with (Tailwind's when labels are off). */
  code: { source: BreakpointSetId | null; format: CodeFormat; unit: QueryUnit };
  colors: { value: string; recent: string[] };
  aspect: { width: string; height: string; share: string };
  /** v0.12: an auto-fit grid; empty max width or columns mean none. */
  grid: {
    minColumn: string;
    gap: string;
    padding: string;
    maxWidth: string;
    maxColumns: string;
    items: string;
    mode: 'auto-fit' | 'auto-fill';
  };
  /** v0.12: responsive image markup. */
  images: {
    layout: 'full' | 'column' | 'vw' | 'fixed';
    padding: string;
    maxWidth: string;
    share: string;
    width: string;
    pattern: string;
    ratioWidth: string;
    ratioHeight: string;
    alt: string;
    lazy: boolean;
    modern: boolean;
  };
  /** v0.12: the media query tester. */
  queries: { query: string };
};

export const DEFAULT_TOOLKIT: ToolkitState = {
  fluid: {
    mode: 'single',
    minViewport: '360',
    maxViewport: '1440',
    unit: 'rem',
    root: '16',
    minSize: '16',
    maxSize: '20',
    property: 'font-size',
    minBase: '16',
    maxBase: '18',
    minRatio: '1.2',
    maxRatio: '1.25',
    stepsDown: '2',
    stepsUp: '5',
  },
  units: { value: '24', from: 'px', root: '16', parent: '16' },
  code: { source: null, format: 'css-min', unit: 'px' },
  colors: { value: '#4f46e5', recent: [] },
  aspect: { width: '16', height: '9', share: '100' },
  grid: { minColumn: '240', gap: '24', padding: '24', maxWidth: '1200', maxColumns: '', items: '6', mode: 'auto-fit' },
  images: {
    layout: 'column',
    padding: '24',
    maxWidth: '1200',
    share: '50',
    width: '400',
    pattern: 'photo-{w}.jpg',
    ratioWidth: '16',
    ratioHeight: '9',
    alt: '',
    lazy: true,
    modern: true,
  },
  queries: { query: '(min-width: 768px) and (orientation: landscape)' },
};

/** At most this many recent colours are kept. */
export const MAX_RECENT_COLORS = 12;

/** A number as typed ("1,5" too); null when it isn't one. */
export function readNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Adds a colour to the front of the recent ones (each once, case-insensitive). */
export function addRecentColor(recent: readonly string[], color: string): string[] {
  const value = color.trim();
  if (!value) return [...recent];
  return [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX_RECENT_COLORS);
}
