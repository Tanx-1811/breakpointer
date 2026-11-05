import { cssNumber } from './fluid';

/**
 * The CSS toolkit's grid: how many columns `repeat(auto-fit, minmax(…, 1fr))`
 * makes at each viewport, how wide they are, and the CSS for it. The container
 * is the viewport minus its side padding, up to a maximum width (scrollbars
 * aren't counted: previews of phones have none).
 */
export type GridSpec = {
  /** The narrowest a column may get, px. */
  minColumn: number;
  gap: number;
  /** Padding on each side of the container, px. */
  padding: number;
  /** The container's max-width, px (null: none). */
  maxWidth: number | null;
  /** At most this many columns (null: as many as fit). */
  maxColumns: number | null;
  /** auto-fit lets the items stretch over unused tracks; auto-fill keeps the empty tracks. */
  mode: 'auto-fit' | 'auto-fill';
  /** How many items the grid holds. */
  items: number;
};

export type GridAt = {
  container: number;
  /** Tracks the browser creates. */
  tracks: number;
  /** Columns the items actually take (fewer with auto-fit and few items). */
  columns: number;
  /** Width of one item, px. */
  itemWidth: number;
  rows: number;
  /** The container is narrower than one column: it relies on `min(100%, …)` to fit. */
  squeezed: boolean;
};

export const validGrid = (spec: GridSpec) =>
  spec.minColumn > 0 &&
  spec.gap >= 0 &&
  spec.padding >= 0 &&
  spec.items >= 1 &&
  (spec.maxWidth === null || spec.maxWidth > 0) &&
  (spec.maxColumns === null || spec.maxColumns >= 1);

/** The grid at one viewport width. */
export function gridAt(spec: GridSpec, viewport: number): GridAt {
  const container = Math.max(0, Math.min(viewport - 2 * spec.padding, spec.maxWidth ?? Infinity));
  // With a cap, each column is at least (100% − (n − 1) gaps) / n wide, so no more than n fit.
  const capped = spec.maxColumns
    ? Math.max(spec.minColumn, (container - (spec.maxColumns - 1) * spec.gap) / spec.maxColumns)
    : spec.minColumn;
  const minimum = Math.min(container, capped);
  const tracks = minimum > 0 ? Math.max(1, Math.floor((container + spec.gap) / (minimum + spec.gap))) : 1;
  const columns = spec.mode === 'auto-fit' ? Math.min(tracks, spec.items) : tracks;
  const trackWidth = (container - (tracks - 1) * spec.gap) / tracks;
  const itemWidth =
    spec.mode === 'auto-fit' && columns < tracks ? (container - (columns - 1) * spec.gap) / columns : trackWidth;
  return {
    container,
    tracks,
    columns,
    itemWidth: Math.max(0, itemWidth),
    rows: Math.ceil(spec.items / columns),
    squeezed: container < spec.minColumn,
  };
}

/** The CSS: `min(100%, …)` keeps one column from overflowing a narrow container. */
export function gridCss(spec: GridSpec, selector = '.grid'): string {
  const gap = `${cssNumber(spec.gap, 2)}px`;
  const min = `${cssNumber(spec.minColumn, 2)}px`;
  const column = spec.maxColumns ? `max(${min}, (100% - ${spec.maxColumns - 1} * ${gap}) / ${spec.maxColumns})` : min;
  const lines = [
    `${selector} {`,
    '  display: grid;',
    `  grid-template-columns: repeat(${spec.mode}, minmax(min(100%, ${column}), 1fr));`,
    `  gap: ${gap};`,
  ];
  if (spec.maxWidth) lines.push(`  max-width: ${cssNumber(spec.maxWidth, 2)}px;`, '  margin-inline: auto;');
  if (spec.padding) lines.push(`  padding-inline: ${cssNumber(spec.padding, 2)}px;`);
  if (spec.maxWidth && spec.padding) lines.push('  box-sizing: content-box;');
  lines.push('}');
  return lines.join('\n');
}
