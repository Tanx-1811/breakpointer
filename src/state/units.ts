import { cssNumber } from './fluid';

/**
 * CSS length units for the CSS toolkit's converter. Relative units need the
 * root and parent font sizes and the viewport; everything goes through px.
 */
export const CSS_UNITS = ['px', 'rem', 'em', 'pt', 'vw', 'vh', 'vmin', 'vmax'] as const;
export type CssUnit = (typeof CSS_UNITS)[number];

export type UnitContext = {
  /** Root font size, px (rem). */
  root: number;
  /** The element's parent font size, px (em). */
  parent: number;
};

export type Viewport = { width: number; height: number };

/** How many px one unit is worth in this context and viewport. */
export function pxPerUnit(unit: CssUnit, context: UnitContext, viewport: Viewport): number {
  switch (unit) {
    case 'px':
      return 1;
    case 'rem':
      return context.root;
    case 'em':
      return context.parent;
    case 'pt':
      return 4 / 3;
    case 'vw':
      return viewport.width / 100;
    case 'vh':
      return viewport.height / 100;
    case 'vmin':
      return Math.min(viewport.width, viewport.height) / 100;
    case 'vmax':
      return Math.max(viewport.width, viewport.height) / 100;
  }
}

/** A value in one unit, in another (null when the context can't convert, e.g. a 0 px root). */
export function convertLength(
  value: number,
  from: CssUnit,
  to: CssUnit,
  context: UnitContext,
  viewport: Viewport,
): number | null {
  const fromPx = pxPerUnit(from, context, viewport);
  const toPx = pxPerUnit(to, context, viewport);
  if (!Number.isFinite(value) || !(fromPx > 0) || !(toPx > 0)) return null;
  return (value * fromPx) / toPx;
}

/** Units whose value depends on the viewport's size. */
export const viewportUnit = (unit: CssUnit) => unit === 'vw' || unit === 'vh' || unit === 'vmin' || unit === 'vmax';

export type UnitRow = { unit: CssUnit; values: (number | null)[]; varies: boolean };

/**
 * The value in every unit at every viewport (a column per viewport). `varies`
 * marks rows whose value differs between the viewports.
 */
export function unitTable(
  value: number,
  from: CssUnit,
  context: UnitContext,
  viewports: readonly Viewport[],
): UnitRow[] {
  return CSS_UNITS.map((unit) => {
    const values = viewports.map((viewport) => convertLength(value, from, unit, context, viewport));
    const shown = values.map((item) => (item === null ? '' : formatUnit(item, unit)));
    return { unit, values, varies: new Set(shown).size > 1 };
  });
}

/** `1.5rem`, `4.267vw`: three decimals for relative units, two for px and pt. */
export function formatUnit(value: number, unit: CssUnit): string {
  return `${cssNumber(value, unit === 'px' || unit === 'pt' ? 2 : 3)}${unit}`;
}

/** Reads "24", "1.5rem", "4,2vw" (a comma as decimal separator); the unit is optional. */
export function parseLength(text: string): { value: number; unit: CssUnit | null } | null {
  const match = /^\s*(-?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*([a-z]*)\s*$/i.exec(text);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const unit = match[2]!.toLowerCase();
  if (!unit) return { value, unit: null };
  return (CSS_UNITS as readonly string[]).includes(unit) ? { value, unit: unit as CssUnit } : null;
}

/** The value as Markdown: a row per unit, a column per viewport. */
export function unitMarkdown(
  value: number,
  from: CssUnit,
  context: UnitContext,
  viewports: readonly (Viewport & { name: string })[],
  labels: { unit: string },
): string {
  const rows = unitTable(value, from, context, viewports);
  const header = `| ${labels.unit} | ${viewports.map((viewport) => `${viewport.name} (${viewport.width}×${viewport.height})`).join(' | ')} |`;
  const rule = `| --- | ${viewports.map(() => '---:').join(' | ')} |`;
  const body = rows.map(
    (row) =>
      `| ${row.unit} | ${row.values.map((item) => (item === null ? '—' : formatUnit(item, row.unit))).join(' | ')} |`,
  );
  return [`**${formatUnit(value, from)}** · root ${cssNumber(context.root, 2)}px · parent ${cssNumber(context.parent, 2)}px`, '', header, rule, ...body].join('\n');
}
