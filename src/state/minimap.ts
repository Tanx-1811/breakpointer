export type MinimapBox = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

/** The scale that fits the whole workspace (`content`) in the minimap's largest size. */
export function minimapScale(content: Size, max: Size): number {
  if (content.width <= 0 || content.height <= 0) return 0;
  return Math.min(max.width / content.width, max.height / content.height);
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * Where to scroll so the part on screen (`view`) is centred on `point` (in
 * workspace pixels), without scrolling past either end.
 */
export function scrollForPoint(point: { x: number; y: number }, view: MinimapBox, content: Size) {
  return {
    left: Math.round(clamp(point.x - view.width / 2, 0, Math.max(0, content.width - view.width))),
    top: Math.round(clamp(point.y - view.height / 2, 0, Math.max(0, content.height - view.height))),
  };
}
