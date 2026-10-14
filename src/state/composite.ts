/** Layout of the "all viewports in one image" sheet: rows of screenshots with a label under each. */

export type SheetOptions = {
  /** Rows wrap once they would be wider than this (unless a single image is wider). */
  maxRowWidth: number;
  gap: number;
  padding: number;
  /** Space for the title above the images. */
  headerHeight: number;
  /** Space for the label under each image. */
  labelHeight: number;
};

export type SheetPlacement = { x: number; y: number; width: number; height: number };

export type SheetLayout = {
  width: number;
  height: number;
  /** Where each image goes, in the order given; its label sits right below it. */
  items: SheetPlacement[];
};

export function layoutSheet(sizes: { width: number; height: number }[], options: SheetOptions): SheetLayout {
  const { gap, padding, headerHeight, labelHeight } = options;
  const widest = Math.max(0, ...sizes.map((size) => size.width));
  const rowLimit = Math.max(options.maxRowWidth, widest);
  const items: SheetPlacement[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let contentWidth = 0;
  for (const size of sizes) {
    if (x > 0 && x + size.width > rowLimit) {
      y += rowHeight + labelHeight + gap;
      x = 0;
      rowHeight = 0;
    }
    items.push({ x: padding + x, y: padding + headerHeight + y, width: size.width, height: size.height });
    x += size.width + gap;
    contentWidth = Math.max(contentWidth, x - gap);
    rowHeight = Math.max(rowHeight, size.height);
  }
  const contentHeight = sizes.length ? y + rowHeight + labelHeight : 0;
  return {
    width: Math.ceil(contentWidth + padding * 2),
    height: Math.ceil(contentHeight + headerHeight + padding * 2),
    items,
  };
}
