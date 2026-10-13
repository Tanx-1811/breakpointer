import type { PresetCategory, ViewportPreset } from '../types';

export const PRESET_CATEGORIES: PresetCategory[] = ['mobile', 'tablet', 'laptop', 'desktop'];

/**
 * Common CSS viewport sizes. Names (see i18n `preset.*`) describe a size
 * class rather than a device, because a preview changes the viewport only; it
 * does not emulate a device's user agent, pixel ratio, touch input or engine.
 */
export const PRESETS: ViewportPreset[] = [
  { id: 'mobile-s', category: 'mobile', width: 360, height: 640 },
  { id: 'mobile-m', category: 'mobile', width: 375, height: 667 },
  { id: 'mobile-l', category: 'mobile', width: 393, height: 852 },
  { id: 'mobile-android', category: 'mobile', width: 412, height: 915 },
  { id: 'mobile-xl', category: 'mobile', width: 430, height: 932 },
  { id: 'tablet-s', category: 'tablet', width: 744, height: 1133 },
  { id: 'tablet-m', category: 'tablet', width: 768, height: 1024 },
  { id: 'tablet-l', category: 'tablet', width: 820, height: 1180 },
  { id: 'tablet-xl', category: 'tablet', width: 1024, height: 1366 },
  { id: 'laptop-s', category: 'laptop', width: 1280, height: 800 },
  { id: 'laptop-m', category: 'laptop', width: 1366, height: 768 },
  { id: 'laptop-l', category: 'laptop', width: 1440, height: 900 },
  { id: 'laptop-xl', category: 'laptop', width: 1536, height: 864 },
  { id: 'desktop-fhd', category: 'desktop', width: 1920, height: 1080 },
  { id: 'desktop-qhd', category: 'desktop', width: 2560, height: 1440 },
];

export type PresetId = (typeof PRESETS)[number]['id'];

export function findPreset(id: string): ViewportPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** Viewports a first-time user sees: one phone, one tablet, one laptop. */
export const DEFAULT_PRESET_IDS = ['mobile-m', 'tablet-m', 'laptop-m'] as const;
