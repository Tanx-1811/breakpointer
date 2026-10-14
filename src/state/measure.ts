/** A point on a preview, in CSS pixels of the page (0,0 = the preview's top left). */
export type Point = { x: number; y: number };

export type MeasureRect = { x: number; y: number; width: number; height: number };

export type Size = { width: number; height: number };

/**
 * Turns a point on screen, relative to the preview's top-left corner, into
 * CSS pixels of the page: divided by the zoom, rounded, kept inside the viewport.
 */
export function toPagePoint(screen: Point, zoom: number, viewport: Size): Point {
  const scale = zoom > 0 ? zoom : 1;
  return {
    x: Math.min(viewport.width, Math.max(0, Math.round(screen.x / scale))),
    y: Math.min(viewport.height, Math.max(0, Math.round(screen.y / scale))),
  };
}

/** The rectangle between two page points, whichever way it was dragged. */
export function rectBetween(a: Point, b: Point): MeasureRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * With Shift held, a drag measures a straight line: the shorter side of the
 * rectangle is dropped, so only the horizontal or vertical distance remains.
 */
export function constrainToLine(start: Point, end: Point): Point {
  return Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
}

/** Distances from the rectangle to the viewport's edges (left, top, right, bottom). */
export function edgeDistances(rect: MeasureRect, viewport: Size) {
  return {
    left: rect.x,
    top: rect.y,
    right: Math.max(0, viewport.width - rect.x - rect.width),
    bottom: Math.max(0, viewport.height - rect.y - rect.height),
  };
}
