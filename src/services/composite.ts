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
