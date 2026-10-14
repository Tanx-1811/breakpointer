/** A zoom factor as a percentage, e.g. 0.67 → "67%". */
export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
