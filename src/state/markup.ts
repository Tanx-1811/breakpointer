/**
 * Screenshot markup: the marks drawn over a captured image (arrows, boxes,
 * freehand lines, highlighter strokes, labels, numbered steps and pixelated
 * areas), their undo history and their geometry. Every coordinate is in the
 * image's own pixels, so marks keep their place whatever size the image is
 * shown at. No DOM here: drawing lives in services/markup-render.ts.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const MARKUP_TOOLS = ['select', 'arrow', 'rect', 'pen', 'highlight', 'text', 'step', 'blur'] as const;
export type MarkupTool = (typeof MARKUP_TOOLS)[number];

export const MARKUP_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'black', 'white'] as const;
export type MarkupColor = (typeof MARKUP_COLORS)[number];

/** Saturated mid-tones that stand out on most screenshots. */
export const COLOR_VALUES: Record<MarkupColor, string> = {
  red: '#dc2626',
  orange: '#f97316',
  yellow: '#facc15',
  green: '#16a34a',
  blue: '#2563eb',
  black: '#111318',
  white: '#ffffff',
};

export const MARKUP_SIZES = ['thin', 'medium', 'thick'] as const;
export type MarkupSize = (typeof MARKUP_SIZES)[number];

/** Line widths of arrows, boxes and the pen, before scaling to the image. */
export const STROKE_WIDTHS: Record<MarkupSize, number> = { thin: 3, medium: 5, thick: 8 };
/** The highlighter is a wide marker. */
export const HIGHLIGHT_WIDTHS: Record<MarkupSize, number> = { thin: 14, medium: 22, thick: 34 };
/** Font size of text labels. */
export const TEXT_SIZES: Record<MarkupSize, number> = { thin: 14, medium: 18, thick: 26 };
/** Radius of numbered steps. */
export const STEP_RADII: Record<MarkupSize, number> = { thin: 12, medium: 15, thick: 20 };
/** Pixelated areas are drawn about 1/12 of their size, then scaled back up. */
export const PIXEL_CELL = 12;

export const DEFAULT_TOOL: MarkupTool = 'arrow';
export const DEFAULT_COLOR: MarkupColor = 'red';
export const DEFAULT_SIZE: MarkupSize = 'medium';

export type MarkStyle = { color: MarkupColor; size: MarkupSize };

type Styled = { id: string } & MarkStyle;

export type ArrowMark = Styled & { kind: 'arrow'; from: Point; to: Point };
export type RectMark = Styled & { kind: 'rect'; rect: Rect };
export type PenMark = Styled & { kind: 'pen'; points: Point[] };
export type HighlightMark = Styled & { kind: 'highlight'; points: Point[] };
/** `at` is the top-left corner of the label's pill. */
export type TextMark = Styled & { kind: 'text'; at: Point; text: string };
/** `at` is the centre of the circle. */
export type StepMark = Styled & { kind: 'step'; at: Point; number: number };
/** A pixelated (hidden) area: it has no colour or width. */
export type BlurMark = { id: string; kind: 'blur'; rect: Rect };

export type Mark = ArrowMark | RectMark | PenMark | HighlightMark | TextMark | StepMark | BlurMark;
export type MarkKind = Mark['kind'];
export type StyledMark = Exclude<Mark, BlurMark>;

/** Measures a label's text at a font size (the renderer's measureText); estimated without one. */
export type TextMeasure = (text: string, fontSize: number) => number;

/* ---------- Marks ---------- */

export function isStyled(mark: Mark): mark is StyledMark {
  return mark.kind !== 'blur';
}

export function addMark(marks: Mark[], mark: Mark): Mark[] {
  return [...marks, mark];
}

/** The marks with `id` replaced by `change(mark)`; the same array when nothing changes. */
export function updateMark(marks: Mark[], id: string, change: (mark: Mark) => Mark): Mark[] {
  let changed = false;
  const next = marks.map((mark) => {
    if (mark.id !== id) return mark;
    const updated = change(mark);
    if (updated !== mark) changed = true;
    return updated;
  });
  return changed ? next : marks;
}

export function removeMark(marks: Mark[], id: string): Mark[] {
  return marks.some((mark) => mark.id === id) ? marks.filter((mark) => mark.id !== id) : marks;
}

export function findMark(marks: Mark[], id: string | null | undefined): Mark | undefined {
  return id ? marks.find((mark) => mark.id === id) : undefined;
}

/** A new colour or width; pixelated areas have neither. */
export function restyle(mark: Mark, style: Partial<MarkStyle>): Mark {
  if (!isStyled(mark)) return mark;
  const color = style.color ?? mark.color;
  const size = style.size ?? mark.size;
  return color === mark.color && size === mark.size ? mark : { ...mark, color, size };
}

const shift = (point: Point, dx: number, dy: number): Point => ({ x: point.x + dx, y: point.y + dy });

export function moveMark(mark: Mark, dx: number, dy: number): Mark {
  if (dx === 0 && dy === 0) return mark;
  switch (mark.kind) {
    case 'arrow':
      return { ...mark, from: shift(mark.from, dx, dy), to: shift(mark.to, dx, dy) };
    case 'rect':
    case 'blur':
      return { ...mark, rect: { ...mark.rect, x: mark.rect.x + dx, y: mark.rect.y + dy } };
    case 'pen':
    case 'highlight':
      return { ...mark, points: mark.points.map((point) => shift(point, dx, dy)) };
    case 'text':
    case 'step':
      return { ...mark, at: shift(mark.at, dx, dy) };
  }
}

/** The number the next step gets: one more than the highest so far, so numbers never repeat. */
export function nextStepNumber(marks: Mark[]): number {
  return marks.reduce((highest, mark) => (mark.kind === 'step' ? Math.max(highest, mark.number) : highest), 0) + 1;
}

/** Whether a mark just drawn is worth keeping (a click without a drag draws no arrow or box). */
export function isMeaningful(mark: Mark, minSize: number): boolean {
  switch (mark.kind) {
    case 'arrow':
      return distance(mark.from, mark.to) >= minSize;
    case 'rect':
    case 'blur': {
      const rect = normaliseRect(mark.rect);
      return rect.width >= minSize && rect.height >= minSize;
    }
    case 'pen':
    case 'highlight':
      return mark.points.length > 0;
    case 'text':
      return mark.text.trim().length > 0;
    case 'step':
      return true;
  }
}

/* ---------- History ---------- */

export type MarkupHistory = { past: Mark[][]; present: Mark[]; future: Mark[][] };

/** Undo steps kept; older ones are dropped. */
export const HISTORY_LIMIT = 100;

export function createHistory(present: Mark[] = []): MarkupHistory {
  return { past: [], present, future: [] };
}

/** A new state that can be undone; redo is cleared. Pushing the same marks changes nothing. */
export function push(history: MarkupHistory, present: Mark[]): MarkupHistory {
  if (present === history.present) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present, future: [] };
}

export function undo(history: MarkupHistory): MarkupHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo(history: MarkupHistory): MarkupHistory {
  const [next, ...future] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future };
}

export const canUndo = (history: MarkupHistory): boolean => history.past.length > 0;
export const canRedo = (history: MarkupHistory): boolean => history.future.length > 0;

/* ---------- Geometry ---------- */

/** Rounds away float noise (and -0) so results compare and serialise cleanly. */
const tidy = (value: number) => Math.round(value * 1000) / 1000 + 0;

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Shortest distance from `point` to the segment a–b. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Shortest distance from `point` to a polyline (a single point counts as a dot). */
export function distanceToPath(point: Point, points: Point[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return distance(point, points[0]!);
  let best = Infinity;
  for (let index = 1; index < points.length; index++) {
    best = Math.min(best, distanceToSegment(point, points[index - 1]!, points[index]!));
  }
  return best;
}

/** The same rectangle with a positive width and height. */
export function normaliseRect(rect: Rect): Rect {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}

export function rectFromPoints(a: Point, b: Point): Rect {
  return normaliseRect({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y });
}

/** The part of `rect` inside a width × height image; null when none of it is. */
export function clipRect(rect: Rect, width: number, height: number): Rect | null {
  const { x, y, width: w, height: h } = normaliseRect(rect);
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(width, x + w);
  const bottom = Math.min(height, y + h);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function clampPoint(point: Point, width: number, height: number): Point {
  return { x: Math.max(0, Math.min(width, point.x)), y: Math.max(0, Math.min(height, point.y)) };
}

const contains = (rect: Rect, point: Point, margin = 0) =>
  point.x >= rect.x - margin &&
  point.x <= rect.x + rect.width + margin &&
  point.y >= rect.y - margin &&
  point.y <= rect.y + rect.height + margin;

/** Shift while drawing a line: the end snaps to the nearest multiple of 45° (projected onto it). */
export function constrainLine(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return to;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const length = dx * ux + dy * uy;
  return { x: tidy(from.x + ux * length), y: tidy(from.y + uy * length) };
}

/** Shift while drawing a box: a square, as big as the larger side, towards the pointer. */
export function constrainBox(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: from.x + (dx < 0 ? -side : side), y: from.y + (dy < 0 ? -side : side) };
}

/** Shift while moving a mark: only along the main axis. */
export function constrainMove(dx: number, dy: number): Point {
  return Math.abs(dx) >= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: dy };
}

/** Adds a point to a freehand path unless it is too close to the last one. */
export function appendPoint(points: Point[], point: Point, minDistance: number): Point[] {
  const last = points[points.length - 1];
  if (last && distance(last, point) < minDistance) return points;
  return [...points, point];
}

export type ArrowHead = { tip: Point; base: Point; left: Point; right: Point };

/**
 * The arrowhead of a line `width` wide: a triangle whose `tip` is at `to`;
 * the shaft ends at `base`. It never takes more than 60% of a short arrow.
 */
export function arrowHead(from: Point, to: Point, width: number): ArrowHead {
  const length = distance(from, to);
  if (length === 0) return { tip: to, base: to, left: to, right: to };
  const head = Math.min(width * 3 + 8, length * 0.6);
  const spread = head * 0.6;
  const ux = (to.x - from.x) / length;
  const uy = (to.y - from.y) / length;
  const base = { x: to.x - ux * head, y: to.y - uy * head };
  return {
    tip: to,
    base: { x: tidy(base.x), y: tidy(base.y) },
    left: { x: tidy(base.x - uy * spread), y: tidy(base.y + ux * spread) },
    right: { x: tidy(base.x + uy * spread), y: tidy(base.y - ux * spread) },
  };
}

/** The whole arrow as one outline (shaft and head), so it is filled — and shadowed — once. */
export function arrowPolygon(from: Point, to: Point, width: number): Point[] {
  const head = arrowHead(from, to, width);
  const length = distance(from, to);
  if (length === 0) return [];
  const half = width / 2;
  const nx = -(to.y - from.y) / length;
  const ny = (to.x - from.x) / length;
  const side = (point: Point, sign: number): Point => ({
    x: tidy(point.x + nx * half * sign),
    y: tidy(point.y + ny * half * sign),
  });
  return [side(from, 1), side(head.base, 1), head.left, head.tip, head.right, side(head.base, -1), side(from, -1)];
}

export type PixelGrid = { rect: Rect; cols: number; rows: number; cellWidth: number; cellHeight: number };

/** How a pixelated area is cut into blocks about `cell` pixels wide (at least one each way). */
export function pixelateGrid(rect: Rect, cell: number): PixelGrid {
  const area = normaliseRect(rect);
  const size = Math.max(1, cell);
  const cols = Math.max(1, Math.round(area.width / size));
  const rows = Math.max(1, Math.round(area.height / size));
  return { rect: area, cols, rows, cellWidth: area.width / cols, cellHeight: area.height / rows };
}

/**
 * How much bigger lines and labels are drawn on a large image, so they look
 * the same on a 1× capture and on a 2× or many-preview one.
 */
export function markupScale(width: number, height: number): number {
  return Math.min(6, Math.max(1, Math.max(width, height) / 1400));
}

/**
 * The scale an image is shown at: it fits the width available and a maximum
 * height, but a very tall image stays at least `minShare` of the width (and
 * scrolls) rather than shrinking to a strip. Never enlarged.
 */
export function fitScale(
  imageWidth: number,
  imageHeight: number,
  availableWidth: number,
  maxHeight: number,
  minShare = 0.6,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  const width = Math.max(1, availableWidth);
  return Math.min(1, width / imageWidth, Math.max(maxHeight / imageHeight, (width * minShare) / imageWidth));
}

export function strokeWidth(mark: StyledMark, scale: number): number {
  return (mark.kind === 'highlight' ? HIGHLIGHT_WIDTHS[mark.size] : STROKE_WIDTHS[mark.size]) * scale;
}

export type TextLayout = { fontSize: number; padX: number; padY: number; height: number; radius: number };

/** Font size and pill padding of a label. */
export function textLayout(size: MarkupSize, scale: number): TextLayout {
  const fontSize = TEXT_SIZES[size] * scale;
  const padY = fontSize * 0.32;
  return { fontSize, padX: fontSize * 0.55, padY, height: fontSize * 1.25 + padY * 2, radius: fontSize * 0.4 };
}

const WIDE_CHARACTER = /[ᄀ-ᅟ⺀-鿿가-힯豈-﫿＀-｠￠-￦]/;

/** A rough text width when it can't be measured: CJK characters are a full em, others about half. */
export function estimateTextWidth(text: string, fontSize: number): number {
  let ems = 0;
  for (const character of text) ems += WIDE_CHARACTER.test(character) ? 1 : 0.56;
  return ems * fontSize;
}

/** The pill a label is drawn in. */
export function textBox(mark: TextMark, scale: number, measure?: TextMeasure): Rect {
  const layout = textLayout(mark.size, scale);
  const width = (measure ?? estimateTextWidth)(mark.text, layout.fontSize);
  return { x: mark.at.x, y: mark.at.y, width: width + layout.padX * 2, height: layout.height };
}

export function stepRadius(mark: StepMark, scale: number): number {
  return STEP_RADII[mark.size] * scale;
}

const boundsOf = (points: Point[]): Rect => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const inflate = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

/** The area a mark covers on the image (its selection outline). */
export function markBounds(mark: Mark, scale: number, measure?: TextMeasure): Rect {
  switch (mark.kind) {
    case 'arrow': {
      const head = arrowHead(mark.from, mark.to, strokeWidth(mark, scale));
      return inflate(boundsOf([mark.from, head.tip, head.left, head.right]), strokeWidth(mark, scale) / 2);
    }
    case 'rect':
      return inflate(normaliseRect(mark.rect), strokeWidth(mark, scale) / 2);
    case 'blur':
      return normaliseRect(mark.rect);
    case 'pen':
    case 'highlight':
      return inflate(boundsOf(mark.points.length ? mark.points : [{ x: 0, y: 0 }]), strokeWidth(mark, scale) / 2);
    case 'text':
      return textBox(mark, scale, measure);
    case 'step': {
      const radius = stepRadius(mark, scale);
      return { x: mark.at.x - radius, y: mark.at.y - radius, width: radius * 2, height: radius * 2 };
    }
  }
}

/** Whether `point` is on the drawn part of a mark (its line, label, circle or pixelated area). */
function touches(mark: Mark, point: Point, tolerance: number, scale: number, measure?: TextMeasure): boolean {
  switch (mark.kind) {
    case 'arrow': {
      const width = strokeWidth(mark, scale);
      const head = arrowHead(mark.from, mark.to, width);
      return (
        distanceToSegment(point, mark.from, mark.to) <= width / 2 + tolerance ||
        distance(point, head.tip) <= distance(head.tip, head.left) + tolerance
      );
    }
    case 'rect': {
      const rect = normaliseRect(mark.rect);
      const reach = strokeWidth(mark, scale) / 2 + tolerance;
      const inner = inflate(rect, -reach);
      return contains(rect, point, reach) && !(inner.width > 0 && inner.height > 0 && contains(inner, point));
    }
    case 'pen':
    case 'highlight':
      return distanceToPath(point, mark.points) <= strokeWidth(mark, scale) / 2 + tolerance;
    case 'text':
      return contains(textBox(mark, scale, measure), point, tolerance);
    case 'step':
      return distance(point, mark.at) <= stepRadius(mark, scale) + tolerance;
    case 'blur':
      return contains(normaliseRect(mark.rect), point, tolerance);
  }
}

/**
 * The mark under `point`, or null. Marks drawn on top win: first any line,
 * label or step (topmost first), then the inside of a box, then a pixelated
 * area — which is always drawn under the other marks.
 */
export function hitTest(
  marks: Mark[],
  point: Point,
  tolerance: number,
  scale = 1,
  measure?: TextMeasure,
): string | null {
  const reversed = [...marks].reverse();
  const drawn = reversed.find((mark) => mark.kind !== 'blur' && touches(mark, point, tolerance, scale, measure));
  if (drawn) return drawn.id;
  const box = reversed.find((mark) => mark.kind === 'rect' && contains(normaliseRect(mark.rect), point));
  if (box) return box.id;
  const hidden = reversed.find((mark) => mark.kind === 'blur' && touches(mark, point, tolerance, scale, measure));
  return hidden?.id ?? null;
}

/* ---------- Handles ---------- */

export type HandleId = 'from' | 'to' | 'nw' | 'ne' | 'sw' | 'se';
export type Handle = { id: HandleId; point: Point };

/** Points a selected mark can be reshaped by: an arrow's ends, a box's corners. */
export function markHandles(mark: Mark): Handle[] {
  switch (mark.kind) {
    case 'arrow':
      return [
        { id: 'from', point: mark.from },
        { id: 'to', point: mark.to },
      ];
    case 'rect':
    case 'blur': {
      const { x, y, width, height } = normaliseRect(mark.rect);
      return [
        { id: 'nw', point: { x, y } },
        { id: 'ne', point: { x: x + width, y } },
        { id: 'sw', point: { x, y: y + height } },
        { id: 'se', point: { x: x + width, y: y + height } },
      ];
    }
    default:
      return [];
  }
}

/** The handle of `mark` under `point`, if any. */
export function handleAt(mark: Mark, point: Point, tolerance: number): HandleId | null {
  return markHandles(mark).find((handle) => distance(handle.point, point) <= tolerance)?.id ?? null;
}

const OPPOSITE: Record<'nw' | 'ne' | 'sw' | 'se', 'nw' | 'ne' | 'sw' | 'se'> = {
  nw: 'se',
  ne: 'sw',
  sw: 'ne',
  se: 'nw',
};

/** The mark reshaped by dragging one of its handles to `point` (Shift: 45° lines, square boxes). */
export function dragHandle(mark: Mark, handle: HandleId, point: Point, constrain = false): Mark {
  if (mark.kind === 'arrow') {
    if (handle === 'from') return { ...mark, from: constrain ? constrainLine(mark.to, point) : point };
    if (handle === 'to') return { ...mark, to: constrain ? constrainLine(mark.from, point) : point };
    return mark;
  }
  if ((mark.kind === 'rect' || mark.kind === 'blur') && handle !== 'from' && handle !== 'to') {
    const anchor = markHandles(mark).find((item) => item.id === OPPOSITE[handle])!.point;
    return { ...mark, rect: rectFromPoints(anchor, constrain ? constrainBox(anchor, point) : point) };
  }
  return mark;
}

/* ---------- Colour ---------- */

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

export const LIGHT_INK = '#ffffff';
export const DARK_INK = '#111318';

/** White or near-black, whichever reads better on the colour (label text, step numbers). */
export function textColorOn(color: MarkupColor): string {
  const background = luminance(COLOR_VALUES[color]);
  const onLight = (background + 0.05) / (luminance(DARK_INK) + 0.05);
  const onDark = (luminance(LIGHT_INK) + 0.05) / (background + 0.05);
  return onDark >= onLight ? LIGHT_INK : DARK_INK;
}
