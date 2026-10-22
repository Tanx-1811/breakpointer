import type { ViewportTemplate } from '../types';

/**
 * Ready-made viewport sets. Names are i18n keys (`group.*`); viewport names
 * are i18n keys of presets (`preset.*`) or literal labels (breakpoints).
 */
export type BuiltInGroup = {
  id: string;
  viewports: (Omit<ViewportTemplate, 'name'> & { preset?: string; label?: string })[];
};

export const BUILT_IN_GROUPS: BuiltInGroup[] = [
  {
    // The viewport sizes most visitors use worldwide (phones, then tablets and desktops).
    id: 'popular',
    viewports: [
      { preset: 'mobile-common', width: 360, height: 800, zoom: 0.5 },
      { preset: 'mobile-std', width: 390, height: 844, zoom: 0.5 },
      { preset: 'mobile-android', width: 412, height: 915, zoom: 0.5 },
      { preset: 'tablet-m', width: 768, height: 1024, zoom: 0.33 },
      { preset: 'laptop-m', width: 1366, height: 768, zoom: 0.33 },
      { preset: 'laptop-xl', width: 1536, height: 864, zoom: 0.25 },
      { preset: 'desktop-fhd', width: 1920, height: 1080, zoom: 0.25 },
    ],
  },
  {
    id: 'basics',
    viewports: [
      { preset: 'mobile-m', width: 375, height: 667, zoom: 0.75 },
      { preset: 'tablet-m', width: 768, height: 1024, zoom: 0.5 },
      { preset: 'laptop-m', width: 1366, height: 768, zoom: 0.5 },
    ],
  },
  {
    id: 'mobile',
    viewports: [
      { preset: 'mobile-s', width: 360, height: 640, zoom: 0.75 },
      { preset: 'mobile-m', width: 375, height: 667, zoom: 0.75 },
      { preset: 'mobile-l', width: 393, height: 852, zoom: 0.75 },
      { preset: 'mobile-android', width: 412, height: 915, zoom: 0.67 },
      { preset: 'mobile-xl', width: 430, height: 932, zoom: 0.67 },
    ],
  },
  {
    id: 'tablets',
    viewports: [
      { preset: 'tablet-s', width: 744, height: 1133, zoom: 0.5 },
      { preset: 'tablet-m', width: 768, height: 1024, zoom: 0.5 },
      { preset: 'tablet-l', width: 820, height: 1180, zoom: 0.5 },
      { preset: 'tablet-xl', width: 1024, height: 1366, zoom: 0.33 },
    ],
  },
  {
    id: 'desktop',
    viewports: [
      { preset: 'laptop-s', width: 1280, height: 800, zoom: 0.5 },
      { preset: 'laptop-l', width: 1440, height: 900, zoom: 0.5 },
      { preset: 'desktop-fhd', width: 1920, height: 1080, zoom: 0.33 },
    ],
  },
  {
    id: 'tailwind',
    viewports: [
      { label: 'sm · 640', width: 640, height: 900, zoom: 0.5 },
      { label: 'md · 768', width: 768, height: 900, zoom: 0.5 },
      { label: 'lg · 1024', width: 1024, height: 900, zoom: 0.33 },
      { label: 'xl · 1280', width: 1280, height: 900, zoom: 0.33 },
      { label: '2xl · 1536', width: 1536, height: 900, zoom: 0.25 },
    ],
  },
  {
    id: 'bootstrap',
    viewports: [
      { label: 'sm · 576', width: 576, height: 900, zoom: 0.5 },
      { label: 'md · 768', width: 768, height: 900, zoom: 0.5 },
      { label: 'lg · 992', width: 992, height: 900, zoom: 0.33 },
      { label: 'xl · 1200', width: 1200, height: 900, zoom: 0.33 },
      { label: 'xxl · 1400', width: 1400, height: 900, zoom: 0.25 },
    ],
  },
  {
    // WCAG 1.4.10 Reflow: a 1280 × 1024 screen zoomed to 400% is 320 × 256 CSS pixels, at 200% 640 × 512.
    id: 'reflow',
    viewports: [
      { label: '320 × 256 · 400%', width: 320, height: 256, zoom: 1 },
      { label: '640 × 512 · 200%', width: 640, height: 512, zoom: 0.67 },
      { label: '1280 × 1024 · 100%', width: 1280, height: 1024, zoom: 0.33 },
    ],
  },
];
