import type { IconName } from '../components/Icon/Icon';

/** A rough class of screen for a viewport size, for icons and colour cues only. */
export type SizeClass = 'phone' | 'tablet' | 'laptop' | 'desktop';

/**
 * Phones are narrow in either orientation; otherwise the layout width decides
 * (a rotated tablet is still a tablet up to 1024px wide).
 */
export function sizeClassOf(width: number, height: number): SizeClass {
  if (Math.min(width, height) < 500 || width < 480) return 'phone';
  if (width <= 1024) return 'tablet';
  if (width < 1600) return 'laptop';
  return 'desktop';
}

export const SIZE_CLASS_ICONS: Record<SizeClass, IconName> = {
  phone: 'phone',
  tablet: 'tablet',
  laptop: 'laptop',
  desktop: 'desktop',
};
