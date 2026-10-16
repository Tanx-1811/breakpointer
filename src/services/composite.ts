import { layoutSheet } from '../state/composite';

export type SheetEntry = {
  /** The preview as captured on screen. */
  image: Blob;
  title: string;
  /** e.g. "375 × 667 · md · 75%". */
  subtitle: string;
};

export type SheetMeta = {
  heading: string;
  url: string;
  /** e.g. "Breakpointer · 14 Oct 2026, 10:42". */
  footer: string;
};

const SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

/** Shortens `text` with an ellipsis until it fits `width`. */
function fit(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let end = text.length;
  while (end > 1 && context.measureText(`${text.slice(0, end)}…`).width > width) end--;
  return `${text.slice(0, end)}…`;
}

/** Image pixels per CSS pixel of a preview's screenshot (its zoom × the screen's density). */
export async function captureScale(image: Blob, viewportWidth: number): Promise<number> {
  const bitmap = await createImageBitmap(image);
  try {
    return bitmap.width / Math.max(1, viewportWidth);
  } finally {
    bitmap.close();
  }
}

/**
 * The part of a preview's screenshot where an element is: `rect` is in the
 * page's CSS pixels (as its agent reports it), `viewportWidth` the preview's
 * width, so the capture's own resolution is accounted for. `scale` (image
 * pixels per CSS pixel) resizes the result, so crops from previews shown at
 * different zooms compare at the same size. Null when nothing of it is shown.
 */
export async function cropToRect(
  image: Blob,
  rect: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  options: { padding?: number; scale?: number } = {},
): Promise<Blob | null> {
  const { padding = 2 } = options;
  const bitmap = await createImageBitmap(image);
  try {
    const source = bitmap.width / Math.max(1, viewportWidth);
    const left = Math.max(0, Math.floor((rect.x - padding) * source));
    const top = Math.max(0, Math.floor((rect.y - padding) * source));
    const right = Math.min(bitmap.width, Math.ceil((rect.x + rect.width + padding) * source));
    const bottom = Math.min(bitmap.height, Math.ceil((rect.y + rect.height + padding) * source));
    if (right - left < 2 || bottom - top < 2) return null;
    const resize = (options.scale ?? source) / source;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((right - left) * resize));
    canvas.height = Math.max(1, Math.round((bottom - top) * resize));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    bitmap.close();
  }
}

/** Canvases taller than this fail in Chrome; longer pages are scaled down to fit. */
const MAX_CANVAS_SIDE = 32_000;

/**
 * One tall PNG from screens captured while scrolling a preview: each slice is
 * drawn where it was on the page (`y`, CSS pixels), so the last one, captured
 * against the bottom, overlaps the one before it exactly.
 */
export async function stitchSlices(
  slices: { image: Blob; y: number }[],
  viewportHeight: number,
  totalHeight: number,
): Promise<Blob | null> {
  if (slices.length === 0) return null;
  const bitmaps = await Promise.all(slices.map((slice) => createImageBitmap(slice.image)));
  try {
    const first = bitmaps[0]!;
    // Captures are in screen pixels: how many per CSS pixel of the page.
    const scale = first.height / viewportHeight;
    const fit = Math.min(1, MAX_CANVAS_SIDE / Math.max(1, totalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(first.width * fit);
    canvas.height = Math.round(totalHeight * scale * fit);
    const context = canvas.getContext('2d');
    if (!context) return null;
    bitmaps.forEach((bitmap, index) => {
      const top = Math.round(slices[index]!.y * scale * fit);
      context.drawImage(bitmap, 0, top, Math.round(bitmap.width * fit), Math.round(bitmap.height * fit));
    });
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

/**
 * One PNG with every preview side by side, each labelled with its name and
 * size, under the page's title and address — ready to drop into a ticket or chat.
 */
export async function composeSheet(entries: SheetEntry[], meta: SheetMeta): Promise<Blob | null> {
  if (entries.length === 0) return null;
  const bitmaps = await Promise.all(entries.map((entry) => createImageBitmap(entry.image)));
  try {
    // Captures are in device pixels; scale the chrome around them to match.
    const scale = Math.max(1, window.devicePixelRatio || 1);
    const px = (value: number) => Math.round(value * scale);
    const layout = layoutSheet(
      bitmaps.map((bitmap) => ({ width: bitmap.width, height: bitmap.height })),
      { maxRowWidth: px(1760), gap: px(40), padding: px(48), headerHeight: px(92), labelHeight: px(58) },
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(layout.width, px(720));
    canvas.height = layout.height;
    const context = canvas.getContext('2d');
    if (!context) return null;

    const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, '#f6f7fb');
    background.addColorStop(1, '#eceff5');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const left = px(48);
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#121620';
    context.font = `700 ${px(26)}px ${SANS}`;
    context.fillText(fit(context, meta.heading, canvas.width - left * 2), left, px(48) + px(30));
    context.fillStyle = '#4f5868';
    context.font = `500 ${px(14)}px ${MONO}`;
    context.fillText(fit(context, meta.url, canvas.width - left * 2 - px(320)), left, px(48) + px(58));
    context.textAlign = 'right';
    context.font = `600 ${px(13)}px ${SANS}`;
    context.fillStyle = '#636c7c';
    context.fillText(meta.footer, canvas.width - left, px(48) + px(58));
    context.textAlign = 'left';

    layout.items.forEach((place, index) => {
      const bitmap = bitmaps[index]!;
      const entry = entries[index]!;
      const radius = px(10);
      context.save();
      context.shadowColor = 'rgba(16, 24, 40, 0.16)';
      context.shadowBlur = px(28);
      context.shadowOffsetY = px(10);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.roundRect(place.x, place.y, place.width, place.height, radius);
      context.fill();
      context.restore();

      context.save();
      context.beginPath();
      context.roundRect(place.x, place.y, place.width, place.height, radius);
      context.clip();
      context.drawImage(bitmap, place.x, place.y);
      context.restore();
      context.strokeStyle = 'rgba(16, 24, 40, 0.12)';
      context.lineWidth = Math.max(1, scale);
      context.beginPath();
      context.roundRect(place.x, place.y, place.width, place.height, radius);
      context.stroke();

      const labelWidth = Math.max(place.width, px(160));
      context.fillStyle = '#121620';
      context.font = `650 ${px(15)}px ${SANS}`;
      context.fillText(fit(context, entry.title, labelWidth), place.x, place.y + place.height + px(26));
      context.fillStyle = '#4f5868';
      context.font = `500 ${px(12.5)}px ${MONO}`;
      context.fillText(fit(context, entry.subtitle, labelWidth), place.x, place.y + place.height + px(46));
    });

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}
