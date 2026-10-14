/**
 * Colour vision and blur simulations drawn over the previews. They filter the
 * rendered preview (an SVG colour matrix or a CSS blur on the frame element),
 * so they work on every site and need no access to the page.
 */
export type VisionMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia' | 'blurred';

export const VISION_MODES = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia', 'blurred'] as const;

type MatrixMode = Exclude<VisionMode, 'none' | 'blurred'>;

/**
 * Colour matrices applied in linear RGB (the default colour space of SVG
 * filters). Protanopia, deuteranopia and tritanopia are the full-severity
 * matrices of Machado, Oliveira & Fernandes (2009), as used by Chrome DevTools;
 * achromatopsia keeps only the luminance. Each row maps to R, G, B, A.
 */
export const VISION_MATRICES: Record<MatrixMode, number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0, 0, 0.114503, 0.786281, 0.099216, 0, 0, -0.003882, -0.048116, 1.051998, 0, 0, 0, 0,
    0, 1, 0,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0, 0, 0.280085, 0.672501, 0.047413, 0, 0, -0.01182, 0.04294, 0.968881, 0, 0, 0, 0, 0,
    1, 0,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, 0, 0, -0.078411, 0.930809, 0.147602, 0, 0, 0.004733, 0.691367, 0.3039, 0, 0, 0, 0,
    0, 1, 0,
  ],
  achromatopsia: [
    0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0,
  ],
};

/** Blur radius in CSS pixels of the page (it scales with the zoom like the page does). */
export const BLUR_PX = 2.5;

export const visionFilterId = (mode: MatrixMode) => `bp-vision-${mode}`;

/** The CSS `filter` for a preview frame; null when nothing is simulated. */
export function visionFilter(mode: VisionMode): string | null {
  if (mode === 'none') return null;
  if (mode === 'blurred') return `blur(${BLUR_PX}px)`;
  return `url(#${visionFilterId(mode)})`;
}

export function isVisionMode(value: unknown): value is VisionMode {
  return value === 'none' || (VISION_MODES as readonly unknown[]).includes(value);
}
