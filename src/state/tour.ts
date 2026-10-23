/**
 * The onboarding tour: where its card goes next to the control a step points
 * at — below it when there is room, else above — kept inside the window.
 */
export type Box = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type TourPlacement = 'below' | 'above';

export function placeTourCard(
  target: Box,
  card: Size,
  viewport: Size,
  gap = 12,
  margin = 12,
): { top: number; left: number; placement: TourPlacement } {
  const below = target.y + target.height + gap;
  const above = target.y - gap - card.height;
  const placement: TourPlacement =
    below + card.height <= viewport.height - margin || above < margin ? 'below' : 'above';
  const top = placement === 'below' ? Math.min(below, viewport.height - margin - card.height) : above;
  const centred = target.x + target.width / 2 - card.width / 2;
  const left = Math.min(centred, viewport.width - margin - card.width);
  return { top: Math.max(margin, Math.round(top)), left: Math.max(margin, Math.round(left)), placement };
}
