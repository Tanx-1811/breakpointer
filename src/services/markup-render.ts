import {
  arrowPolygon,
  clipRect,
  COLOR_VALUES,
  findMark,
  isStyled,
  LIGHT_INK,
  markBounds,
  markHandles,
  markupScale,
  PIXEL_CELL,
  pixelateGrid,
  stepRadius,
  strokeWidth,
  textColorOn,
  textLayout,
  type BlurMark,
  type Mark,
  type Point,
  type StyledMark,
  type TextMeasure,
} from '../state/markup';

/** A decoded screenshot and its size in pixels. */
export type MarkupSource = { image: CanvasImageSource; width: number; height: number };

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type DrawOptions = {
  /**
   * The image already scaled to the canvas (drawn instead of the full-size
   * one, which is much cheaper on every frame of a drag).
   */
  base?: CanvasImageSource | null;
  /** Drawn with an outline and handles. */
  selectedId?: string | null;
  /** Left out (a label being edited is shown in its text field instead). */
  hiddenId?: string | null;
  /** Colour of the selection outline (the theme's accent). */
  selectionColor?: string;
};

const SANS = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const markupFont = (fontSize: number, weight = 600) => `${weight} ${fontSize}px ${SANS}`;

/** Decodes the screenshot once; every redraw reuses it. */
export async function loadMarkupImage(url: string): Promise<MarkupSource> {
  if (typeof createImageBitmap === 'function') {
    const response = await fetch(url);
    const bitmap = await createImageBitmap(await response.blob());
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const image = new Image();
  image.src = url;
  await image.decode();
  return { image, width: image.naturalWidth, height: image.naturalHeight };
}

const released = new WeakSet<MarkupSource>();

/** Frees the decoded image; it can't be drawn afterwards. */
export function releaseMarkupImage(source: MarkupSource): void {
  released.add(source);
  if (typeof ImageBitmap !== 'undefined' && source.image instanceof ImageBitmap) source.image.close();
}

export function isReleased(source: MarkupSource): boolean {
  return released.has(source);
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

let measureContext: Context | null | undefined;

/** Measures label text the way it is drawn (null when there is no 2D canvas, e.g. in tests). */
export function createTextMeasure(): TextMeasure | undefined {
  if (measureContext === undefined) {
    try {
      measureContext = createCanvas(1, 1).getContext('2d') as Context | null;
    } catch {
      measureContext = null;
    }
  }
  const context = measureContext;
  if (!context) return undefined;
  return (text, fontSize) => {
    context.font = markupFont(fontSize);
    return context.measureText(text).width;
  };
}

/** The image drawn once at the canvas's own size, for cheap redraws. */
export function createBaseLayer(source: MarkupSource, width: number, height: number): CanvasImageSource | null {
  if (width <= 0 || height <= 0 || (width >= source.width && height >= source.height)) return null;
  try {
    const canvas = createCanvas(Math.round(width), Math.round(height));
    const context = canvas.getContext('2d') as Context | null;
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    return null;
  }
}

let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;

/** The area scaled down to about 1/12 and back up without smoothing: big flat blocks. */
function drawPixelated(context: Context, source: MarkupSource, mark: BlurMark, scale: number) {
  const area = clipRect(mark.rect, source.width, source.height);
  if (!area) return;
  const grid = pixelateGrid(area, PIXEL_CELL * scale);
  scratch ??= createCanvas(grid.cols, grid.rows);
  if (scratch.width < grid.cols) scratch.width = grid.cols;
  if (scratch.height < grid.rows) scratch.height = grid.rows;
  const small = scratch.getContext('2d') as Context | null;
  if (!small) return;
  small.imageSmoothingEnabled = true;
  small.imageSmoothingQuality = 'medium';
  small.clearRect(0, 0, grid.cols, grid.rows);
  small.drawImage(source.image, area.x, area.y, area.width, area.height, 0, 0, grid.cols, grid.rows);
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(scratch, 0, 0, grid.cols, grid.rows, area.x, area.y, area.width, area.height);
  context.restore();
}

/** Device pixels per image pixel under the current transform. */
const deviceScale = (context: Context) => Math.hypot(context.getTransform().a, context.getTransform().b) || 1;

/** A soft shadow that keeps marks readable on light and dark pages alike. */
function withShadow(context: Context, scale: number) {
  const device = deviceScale(context);
  context.shadowColor = 'rgb(0 0 0 / 28%)';
  context.shadowBlur = 3 * scale * device;
  context.shadowOffsetY = 1 * scale * device;
}

function tracePath(context: Context, points: Point[]) {
  const [first, ...rest] = points;
  if (!first) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  if (rest.length === 0) {
    context.lineTo(first.x + 0.01, first.y);
    return;
  }
  // Smooth the stroke through the midpoints of its segments.
  for (let index = 0; index < rest.length - 1; index++) {
    const point = rest[index]!;
    const next = rest[index + 1]!;
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }
  const last = rest[rest.length - 1]!;
  context.lineTo(last.x, last.y);
}

function roundedRect(context: Context, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  context.rect(x, y, width, height);
}

function drawMark(context: Context, mark: StyledMark, scale: number) {
  const color = COLOR_VALUES[mark.color];
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = color;
  context.fillStyle = color;
  switch (mark.kind) {
    case 'arrow': {
      const width = strokeWidth(mark, scale);
      const outline = arrowPolygon(mark.from, mark.to, width);
      if (outline.length === 0) break;
      withShadow(context, scale);
      context.beginPath();
      outline.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
      context.closePath();
      // A thin stroke of the same colour rounds the corners.
      context.lineWidth = width * 0.5;
      context.fill();
      context.shadowColor = 'transparent';
      context.stroke();
      break;
    }
    case 'rect': {
      withShadow(context, scale);
      context.lineWidth = strokeWidth(mark, scale);
      const { x, y, width, height } = mark.rect;
      roundedRect(context, x, y, width, height, context.lineWidth * 0.6);
      context.stroke();
      break;
    }
    case 'pen': {
      withShadow(context, scale);
      context.lineWidth = strokeWidth(mark, scale);
      tracePath(context, mark.points);
      context.stroke();
      break;
    }
    case 'highlight': {
      // A marker: translucent, and multiplied so the text under it stays dark.
      context.globalAlpha = 0.4;
      if (mark.color !== 'white') context.globalCompositeOperation = 'multiply';
      context.lineWidth = strokeWidth(mark, scale);
      tracePath(context, mark.points);
      context.stroke();
      break;
    }
    case 'text': {
      const layout = textLayout(mark.size, scale);
      context.font = markupFont(layout.fontSize);
      const textWidth = context.measureText(mark.text).width;
      withShadow(context, scale);
      roundedRect(context, mark.at.x, mark.at.y, textWidth + layout.padX * 2, layout.height, layout.radius);
      context.fill();
      context.shadowColor = 'transparent';
      if (mark.color === 'white') {
        context.lineWidth = Math.max(1, scale);
        context.strokeStyle = 'rgb(0 0 0 / 18%)';
        context.stroke();
      }
      context.fillStyle = textColorOn(mark.color);
      context.textBaseline = 'middle';
      context.fillText(mark.text, mark.at.x + layout.padX, mark.at.y + layout.height / 2 + layout.fontSize * 0.04);
      break;
    }
    case 'step': {
      const radius = stepRadius(mark, scale);
      withShadow(context, scale);
      context.beginPath();
      context.arc(mark.at.x, mark.at.y, radius, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = 'transparent';
      // A ring that separates the circle from whatever is under it.
      context.lineWidth = Math.max(1.5, radius * 0.14);
      context.strokeStyle = mark.color === 'white' ? 'rgb(0 0 0 / 28%)' : LIGHT_INK;
      context.stroke();
      context.fillStyle = textColorOn(mark.color);
      context.font = markupFont(radius * (mark.number > 9 ? 0.95 : 1.15), 700);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(mark.number), mark.at.x, mark.at.y + radius * 0.06);
      break;
    }
  }
  context.restore();
}

function drawSelection(context: Context, mark: Mark, scale: number, color: string, measure?: TextMeasure) {
  const device = deviceScale(context);
  const px = (value: number) => value / device;
  const bounds = markBounds(mark, scale, measure);
  const pad = px(4);
  context.save();
  context.lineWidth = px(1.5);
  context.strokeStyle = color;
  context.strokeRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
  const size = px(8);
  context.lineWidth = px(1.5);
  context.fillStyle = LIGHT_INK;
  for (const handle of markHandles(mark)) {
    context.beginPath();
    context.rect(handle.point.x - size / 2, handle.point.y - size / 2, size, size);
    context.fill();
    context.stroke();
  }
  context.restore();
}

/**
 * Draws the screenshot with its marks, in image pixels (the caller sets the
 * transform): pixelated areas first, so arrows and labels stay readable on
 * top of them, then the other marks in the order they were made.
 */
export function drawMarks(context: Context, source: MarkupSource, marks: Mark[], options: DrawOptions = {}): void {
  const scale = markupScale(source.width, source.height);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(options.base ?? source.image, 0, 0, source.width, source.height);
  context.restore();
  const shown = marks.filter((mark) => mark.id !== options.hiddenId);
  for (const mark of shown) if (mark.kind === 'blur') drawPixelated(context, source, mark, scale);
  for (const mark of shown) if (isStyled(mark)) drawMark(context, mark, scale);
  const selected = findMark(shown, options.selectedId);
  if (selected) drawSelection(context, selected, scale, options.selectionColor || '#4f46e5', createTextMeasure());
}

/** Redraws an on-screen canvas: the image fills it, whatever its pixel size. */
export function paintMarkup(
  canvas: HTMLCanvasElement,
  source: MarkupSource | null,
  marks: Mark[],
  options: DrawOptions = {},
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!source || released.has(source)) return;
  context.setTransform(canvas.width / source.width, 0, 0, canvas.height / source.height, 0, 0);
  drawMarks(context, source, marks, {
    ...options,
    selectionColor:
      options.selectionColor ||
      (options.selectedId ? getComputedStyle(canvas).getPropertyValue('--accent').trim() : undefined),
  });
}

/** The annotated image at full resolution, as a PNG. */
export async function renderMarkup(source: MarkupSource, marks: Mark[]): Promise<Blob> {
  const canvas = createCanvas(source.width, source.height);
  const context = canvas.getContext('2d') as Context | null;
  if (!context) throw new Error('No 2D canvas');
  drawMarks(context, source, marks);
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be encoded');
  return blob;
}
