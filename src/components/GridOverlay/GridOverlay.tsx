import type { GridSettings } from '../../types';
import styles from './GridOverlay.module.css';

/** Columns for a viewport width; "auto" follows common 4 / 8 / 12 column layouts. */
export function gridColumnsFor(columns: GridSettings['columns'], width: number): number {
  if (columns !== 'auto') return columns;
  if (width < 600) return 4;
  if (width < 1024) return 8;
  return 12;
}

type Props = {
  grid: GridSettings;
  /** Viewport size in CSS pixels of the page. */
  width: number;
  height: number;
  zoom: number;
};

/** Layout columns drawn over a preview (never intercepts the pointer). */
export function GridOverlay({ grid, width, height, zoom }: Props) {
  const columns = gridColumnsFor(grid.columns, width);
  // Keep the columns visible on tiny viewports where margins and gutters wouldn't fit.
  const margin = Math.min(grid.margin, width / 4);
  const gutter = Math.min(grid.gutter, Math.max(0, (width - margin * 2) / columns / 2));
  return (
    <div
      className={styles.grid}
      style={{
        width: width * zoom,
        height: height * zoom,
        paddingInline: margin * zoom,
        columnGap: gutter * zoom,
      }}
      aria-hidden="true"
      data-testid="grid-overlay"
      data-columns={columns}
    >
      {Array.from({ length: columns }, (_, index) => (
        <span key={index} className={styles.column} />
      ))}
      {grid.baseline > 0 && (
        <span
          className={styles.baseline}
          style={{ ['--baseline' as string]: `${grid.baseline * zoom}px` }}
          data-testid="baseline-grid"
        />
      )}
    </div>
  );
}
