/**
 * Fluid sizes for the CSS toolkit: a `clamp()` that grows from one size at a
 * small viewport to another at a large one, and a fluid type scale made of
 * them. Sizes are given in CSS pixels; `unit` only changes how they are written.
 */

export type FluidUnit = 'px' | 'rem';

export type FluidSpec = {
  /** Size (px) at `minViewport` and below. */
  minSize: number;
  /** Size (px) at `maxViewport` and above. */
  maxSize: number;
  minViewport: number;
  maxViewport: number;
  unit: FluidUnit;
  /** The root font size (px) rem values are written against. */
  root: number;
};

export type FluidValue = {
  /** Change in px per px of viewport width. */
  slope: number;
  /** Size (px) the line would have at a 0 px viewport. */
  intercept: number;
  css: string;
};

/** A number for CSS: at most `decimals` decimals, no trailing zeros, no "-0". */
export function cssNumber(value: number, decimals = 4): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) || rounded === 0 ? '0' : String(rounded);
}

const length = (px: number, unit: FluidUnit, root: number) =>
  unit === 'rem' ? `${cssNumber(px / root)}rem` : `${cssNumber(px, 2)}px`;

/** The spec's numbers are usable: positive sizes and two different viewport widths. */
export function validFluid(spec: FluidSpec): boolean {
  return (
    [spec.minSize, spec.maxSize, spec.minViewport, spec.maxViewport, spec.root].every(
      (value) => Number.isFinite(value) && value > 0,
    ) && spec.minViewport !== spec.maxViewport
  );
}

/**
 * `clamp(min, intercept + slope·100vw, max)`. The preferred value keeps a rem
 * (or px) part, so text still grows when the reader zooms. A size that shrinks
 * as the viewport grows works too: the smaller size is always the lower bound.
 */
export function fluidClamp(spec: FluidSpec): FluidValue {
  const slope = (spec.maxSize - spec.minSize) / (spec.maxViewport - spec.minViewport);
  const intercept = spec.minSize - slope * spec.minViewport;
  const low = Math.min(spec.minSize, spec.maxSize);
  const high = Math.max(spec.minSize, spec.maxSize);
  const vw = cssNumber(slope * 100);
  let preferred: string;
  if (slope === 0) preferred = length(intercept, spec.unit, spec.root);
  else if (intercept === 0) preferred = `${vw}vw`;
  else {
    const sign = slope < 0 ? '-' : '+';
    preferred = `${length(intercept, spec.unit, spec.root)} ${sign} ${cssNumber(Math.abs(slope * 100))}vw`;
  }
  const css =
    low === high
      ? length(low, spec.unit, spec.root)
      : `clamp(${length(low, spec.unit, spec.root)}, ${preferred}, ${length(high, spec.unit, spec.root)})`;
  return { slope, intercept, css };
}

/** The size (px) the clamp gives at a viewport width. */
export function fluidAt(spec: FluidSpec, viewport: number): number {
  const { slope, intercept } = fluidClamp(spec);
  const low = Math.min(spec.minSize, spec.maxSize);
  const high = Math.max(spec.minSize, spec.maxSize);
  return Math.min(high, Math.max(low, intercept + slope * viewport));
}

/**
 * Text set with a clamp() may not reach twice its size when the reader zooms
 * to 200% (WCAG 1.4.4) once the largest size is more than 2.5 times the
 * smallest: the vw part doesn't grow with zoom.
 */
export const zoomRisk = (spec: FluidSpec) =>
  Math.max(spec.minSize, spec.maxSize) > 2.5 * Math.min(spec.minSize, spec.maxSize);

/** Musical ratios commonly used for type scales. */
export const SCALE_RATIOS = [
  { value: 1.067, name: 'minorSecond' },
  { value: 1.125, name: 'majorSecond' },
  { value: 1.2, name: 'minorThird' },
  { value: 1.25, name: 'majorThird' },
  { value: 1.333, name: 'perfectFourth' },
  { value: 1.414, name: 'augmentedFourth' },
  { value: 1.5, name: 'perfectFifth' },
  { value: 1.618, name: 'goldenRatio' },
] as const;

export type ScaleRatioName = (typeof SCALE_RATIOS)[number]['name'];

export type TypeScaleSpec = {
  /** Body size (step 0) at the small and the large viewport, px. */
  minBase: number;
  maxBase: number;
  minRatio: number;
  maxRatio: number;
  minViewport: number;
  maxViewport: number;
  /** Steps below and above the body size (e.g. 2 and 5: --step--2 … --step-5). */
  stepsDown: number;
  stepsUp: number;
  unit: FluidUnit;
  root: number;
};

export type TypeScaleStep = { step: number; name: string; min: number; max: number; spec: FluidSpec; css: string };

export const MAX_SCALE_STEPS = 8;

/** Each step of a fluid type scale: base × ratio^step at each end, joined by a clamp(). */
export function typeScale(scale: TypeScaleSpec): TypeScaleStep[] {
  const down = Math.max(0, Math.min(MAX_SCALE_STEPS, Math.round(scale.stepsDown)));
  const up = Math.max(0, Math.min(MAX_SCALE_STEPS, Math.round(scale.stepsUp)));
  const steps: TypeScaleStep[] = [];
  for (let step = up; step >= -down; step--) {
    const spec: FluidSpec = {
      minSize: scale.minBase * scale.minRatio ** step,
      maxSize: scale.maxBase * scale.maxRatio ** step,
      minViewport: scale.minViewport,
      maxViewport: scale.maxViewport,
      unit: scale.unit,
      root: scale.root,
    };
    steps.push({ step, name: `--step-${step}`, min: spec.minSize, max: spec.maxSize, spec, css: fluidClamp(spec).css });
  }
  return steps;
}

/** The scale as custom properties, with a comment saying where it comes from. */
export function typeScaleCss(scale: TypeScaleSpec, steps: TypeScaleStep[]): string {
  const comment =
    `/* Fluid type scale: ${cssNumber(scale.minBase, 2)}px × ${scale.minRatio} at ${scale.minViewport}px` +
    ` → ${cssNumber(scale.maxBase, 2)}px × ${scale.maxRatio} at ${scale.maxViewport}px */`;
  return [comment, ':root {', ...steps.map((step) => `  ${step.name}: ${step.css};`), '}'].join('\n');
}

/** One fluid size as a declaration, e.g. `font-size: clamp(…);`. */
export const fluidDeclaration = (property: string, spec: FluidSpec) =>
  `${property.trim() || 'font-size'}: ${fluidClamp(spec).css};`;
