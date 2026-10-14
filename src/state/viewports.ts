import type { ColorScheme, Orientation, ViewportConfig, ViewportTemplate } from '../types';
import {
  DEFAULT_ZOOM,
  MAX_DIMENSION,
  MAX_NAME_LENGTH,
  MAX_VIEWPORTS,
  MAX_ZOOM,
  MIN_DIMENSION,
  MIN_ZOOM,
  ZOOM_OPTIONS,
} from '../utils/constants';
import { createId } from '../utils/id';

export function orientationOf(width: number, height: number): Orientation {
  return width > height ? 'landscape' : 'portrait';
}

export function isValidDimension(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION;
}

export function clampDimension(value: number): number {
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

export function normalizeName(name: string, width: number, height: number): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed || `${width} × ${height}`;
}

/** A starting zoom so a new viewport isn't huge on screen. */
export function suggestedZoom(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (longest <= 940) return 0.75;
  if (longest <= 1400) return 0.5;
  if (longest <= 2000) return 0.33;
  return 0.25;
}

export type NewViewport = { name: string; width: number; height: number; zoom?: number; colorScheme?: ColorScheme };

export function createViewport({ name, width, height, zoom, colorScheme }: NewViewport): ViewportConfig {
  const w = clampDimension(width);
  const h = clampDimension(height);
  return {
    id: createId(),
    name: normalizeName(name, w, h),
    width: w,
    height: h,
    orientation: orientationOf(w, h),
    zoom: clampZoom(zoom ?? suggestedZoom(w, h)),
    hidden: false,
    ...(colorScheme ? { colorScheme } : {}),
  };
}

export function canAddViewport(list: ViewportConfig[]): boolean {
  return list.length < MAX_VIEWPORTS;
}

export function addViewport(list: ViewportConfig[], input: NewViewport): ViewportConfig[] {
  if (!canAddViewport(list)) return list;
  return [...list, createViewport(input)];
}

/** Inserts a copy right after the original. */
export function duplicateViewport(list: ViewportConfig[], id: string): ViewportConfig[] {
  const index = list.findIndex((vp) => vp.id === id);
  if (index < 0 || !canAddViewport(list)) return list;
  const original = list[index]!;
  const next = [...list];
  next.splice(index + 1, 0, { ...original, id: createId(), hidden: false });
  return next;
}

export function removeViewport(list: ViewportConfig[], id: string): ViewportConfig[] {
  return list.filter((vp) => vp.id !== id);
}

/**
 * Puts a removed viewport back at (or near) its old position, leaving every
 * other change made since then intact. No-op if it is already there or the
 * list is full.
 */
export function restoreViewport(list: ViewportConfig[], viewport: ViewportConfig, index: number): ViewportConfig[] {
  if (list.some((vp) => vp.id === viewport.id) || !canAddViewport(list)) return list;
  const next = [...list];
  next.splice(Math.min(Math.max(0, index), next.length), 0, viewport);
  return next;
}

export type ViewportPatch = Partial<Pick<ViewportConfig, 'name' | 'width' | 'height' | 'zoom' | 'hidden'>> & {
  /** null goes back to following the browser. */
  colorScheme?: ColorScheme | null;
};

export function updateViewport(list: ViewportConfig[], id: string, patch: ViewportPatch): ViewportConfig[] {
  return list.map((vp) => {
    if (vp.id !== id) return vp;
    const width = patch.width === undefined ? vp.width : clampDimension(patch.width);
    const height = patch.height === undefined ? vp.height : clampDimension(patch.height);
    const { colorScheme: _scheme, ...rest } = vp;
    const colorScheme = patch.colorScheme === undefined ? vp.colorScheme : (patch.colorScheme ?? undefined);
    return {
      ...rest,
      name: patch.name === undefined ? vp.name : normalizeName(patch.name, width, height),
      width,
      height,
      orientation: orientationOf(width, height),
      zoom: patch.zoom === undefined ? vp.zoom : clampZoom(patch.zoom),
      hidden: patch.hidden ?? vp.hidden,
      ...(colorScheme ? { colorScheme } : {}),
    };
  });
}

/** Swaps width and height. A square viewport stays as it is. */
export function rotateViewport(list: ViewportConfig[], id: string): ViewportConfig[] {
  return list.map((vp) =>
    vp.id === id ? { ...vp, width: vp.height, height: vp.width, orientation: orientationOf(vp.height, vp.width) } : vp,
  );
}

/** Rotates every visible, non-square viewport. */
export function rotateVisible(list: ViewportConfig[]): ViewportConfig[] {
  return list.map((vp) =>
    vp.hidden || vp.width === vp.height
      ? vp
      : { ...vp, width: vp.height, height: vp.width, orientation: orientationOf(vp.height, vp.width) },
  );
}

export function moveViewport(list: ViewportConfig[], id: string, delta: -1 | 1): ViewportConfig[] {
  const from = list.findIndex((vp) => vp.id === id);
  return moveViewportTo(list, id, from + delta);
}

/** Moves a viewport to `to` (index in the list after removal), for drag and drop. */
export function moveViewportTo(list: ViewportConfig[], id: string, to: number): ViewportConfig[] {
  const from = list.findIndex((vp) => vp.id === id);
  if (from < 0 || to < 0 || to >= list.length || to === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function setZoomForAll(list: ViewportConfig[], zoom: number): ViewportConfig[] {
  const value = clampZoom(zoom);
  return list.map((vp) => ({ ...vp, zoom: value }));
}

/** The next zoom step up or down from `current`. */
export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_OPTIONS.find((option) => option > current + 0.001) ?? MAX_ZOOM;
  return [...ZOOM_OPTIONS].reverse().find((option) => option < current - 0.001) ?? ZOOM_OPTIONS[0]!;
}

/** Next zoom step up or down from the largest current zoom of visible viewports. */
export function stepZoom(list: ViewportConfig[], direction: 1 | -1): number {
  const visible = list.filter((vp) => !vp.hidden);
  return nextZoom(visible.length ? Math.max(...visible.map((vp) => vp.zoom)) : DEFAULT_ZOOM, direction);
}

export function showAll(list: ViewportConfig[]): ViewportConfig[] {
  return list.map((vp) => (vp.hidden ? { ...vp, hidden: false } : vp));
}

/** Narrowest first (then shortest); the order of equal sizes is kept. */
export function sortByWidth(list: ViewportConfig[]): ViewportConfig[] {
  return [...list].sort((a, b) => a.width - b.width || a.height - b.height);
}

export function isSortedByWidth(list: ViewportConfig[]): boolean {
  return sortByWidth(list).every((vp, index) => vp === list[index]);
}

export function toTemplate({ name, width, height, zoom, colorScheme }: ViewportConfig): ViewportTemplate {
  return { name, width, height, zoom, ...(colorScheme ? { colorScheme } : {}) };
}

export function fromTemplates(templates: ViewportTemplate[]): ViewportConfig[] {
  return templates.slice(0, MAX_VIEWPORTS).map((template) => createViewport(template));
}
