import { MAX_DIMENSION, MIN_DIMENSION } from '../utils/constants';

export type DragResult = {
  /** The size to use, in CSS pixels. */
  value: number;
  /** The breakpoint it snapped to, if any. */
  snapped: number | null;
};

export type DragOptions = {
  /** Widths (or heights) to snap to, e.g. the active breakpoints. */
  targets?: number[];
  /** How close (CSS pixels) a target must be to snap. */
  threshold?: number;
  /** Round to this step instead of snapping (Shift while dragging). */
  step?: number;
};

export function clampSize(value: number): number {
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

/**
 * The size while dragging a resize handle: whole pixels within the allowed
 * range, rounded to `step`, or snapped to the nearest target within `threshold`.
 */
export function resolveDrag(raw: number, { targets = [], threshold = 0, step }: DragOptions = {}): DragResult {
  if (step && step > 1) return { value: clampSize(Math.round(raw / step) * step), snapped: null };
  let snapped: number | null = null;
  let distance = threshold;
  for (const target of targets) {
    const gap = Math.abs(target - raw);
    if (gap <= distance && target >= MIN_DIMENSION && target <= MAX_DIMENSION) {
      snapped = target;
      distance = gap;
    }
  }
  return { value: clampSize(snapped ?? raw), snapped };
}

/** Arrow keys on a resize handle: 1px, or 10px with Shift; Home/End jump to the limits. */
export function keyboardResize(value: number, key: string, shift: boolean): number | null {
  const step = shift ? 10 : 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return clampSize(value + step);
    case 'ArrowLeft':
    case 'ArrowUp':
      return clampSize(value - step);
    case 'Home':
      return MIN_DIMENSION;
    case 'End':
      return MAX_DIMENSION;
    default:
      return null;
  }
}
