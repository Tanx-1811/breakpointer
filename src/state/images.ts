import type { ImageSample } from '../agent/protocol';

/**
 * The responsive images helper (the audit's Images tab): each image the
 * previews show, its size at every viewport, how its file compares with what
 * the screen needs, and a suggested `sizes` attribute and `srcset` widths —
 * worked out from the viewports previewed (more viewports, finer suggestions).
 */

/** One image at one viewport. */
export type ImageAt = {
  /** The preview (card) it was measured in. */
  cardId: string;
  /** The viewport's width in CSS pixels. */
  viewport: number;
  sample: ImageSample;
};

/** How an image's file compares with what the screen needs at one size. */
export type ImageFit = 'ok' | 'large' | 'small';

/** A file this many times wider than needed wastes bytes; one this much narrower looks blurry. */
export const OVERSIZE = 1.8;
export const UNDERSIZE = 0.9;

/** Pixels the screen needs across: the shown width times the device pixel ratio. */
export const neededWidth = (sample: Pick<ImageSample, 'width' | 'dpr'>) => Math.round(sample.width * sample.dpr);

export function imageFit(sample: Pick<ImageSample, 'width' | 'dpr' | 'naturalWidth'>): ImageFit {
  const needed = neededWidth(sample);
  if (sample.naturalWidth >= needed * OVERSIZE && sample.naturalWidth - needed > 200) return 'large';
  if (sample.naturalWidth < needed * UNDERSIZE) return 'small';
  return 'ok';
}

/** An image across the previews (found by its structural selector), narrowest viewport first. */
export type ImageRow = {
  selector: string;
  label: string;
  file: string;
  responsive: boolean;
  sizes: ImageAt[];
};

export function imageRows(measured: readonly ImageAt[]): ImageRow[] {
  const rows = new Map<string, ImageRow>();
  for (const item of measured) {
    let row = rows.get(item.sample.selector);
    if (!row) {
      row = {
        selector: item.sample.selector,
        label: item.sample.label,
        file: item.sample.file,
        responsive: item.sample.responsive,
        sizes: [],
      };
      rows.set(item.sample.selector, row);
    }
    if (!row.sizes.some((size) => size.cardId === item.cardId)) row.sizes.push(item);
    row.responsive ||= item.sample.responsive;
  }
  for (const row of rows.values()) row.sizes.sort((a, b) => a.viewport - b.viewport);
  // Images that waste the most first, then the rest in the order they were found.
  const waste = (row: ImageRow) =>
    Math.max(0, ...row.sizes.map(({ sample }) => sample.naturalWidth / Math.max(1, neededWidth(sample))));
  return [...rows.values()].sort((a, b) => waste(b) - waste(a));
}

type Part = { from: number; kind: 'vw' | 'px'; value: number };

/**
 * A `sizes` attribute that matches how wide the image is at each viewport
 * measured: in vw where it follows the viewport, in px where it stays the same
 * width. Conditions change at the next measured viewport (`max-width` one
 * pixel below it), so it is exact at the widths previewed.
 */
export function suggestSizes(sizes: readonly Pick<ImageAt, 'viewport' | 'sample'>[]): string {
  const points = [...sizes]
    .filter((size) => size.viewport > 0)
    .sort((a, b) => a.viewport - b.viewport)
    .map((size) => ({ viewport: size.viewport, width: size.sample.width }));
  if (points.length === 0) return '100vw';
  const parts: Part[] = [];
  points.forEach((point, index) => {
    const share = (point.width / point.viewport) * 100;
    const neighbours = [points[index - 1], points[index + 1]].filter(Boolean) as typeof points;
    // The same width at a neighbouring viewport: a fixed width.
    const fixed =
      neighbours.some((other) => Math.abs(other.width - point.width) <= 2) ||
      (neighbours.length === 0 && share < 95) ||
      (index === points.length - 1 && share < 60);
    const part: Part = fixed
      ? { from: point.viewport, kind: 'px', value: point.width }
      : { from: point.viewport, kind: 'vw', value: share >= 97 ? 100 : Math.round(share) };
    const last = parts.at(-1);
    const same =
      last &&
      last.kind === part.kind &&
      (part.kind === 'px' ? Math.abs(last.value - part.value) <= 2 : Math.abs(last.value - part.value) <= 3);
    if (!same) parts.push(part);
  });
  const value = (part: Part) => `${part.value}${part.kind}`;
  return parts
    .map((part, index) => {
      const next = parts[index + 1];
      return next ? `(max-width: ${next.from - 1}px) ${value(part)}` : value(part);
    })
    .join(', ');
}

/**
 * File widths for `srcset`: what the screens need (shown width × 1 and × 2),
 * rounded up to tens and merged when within 15% of each other; at most six.
 */
export function suggestSrcset(sizes: readonly Pick<ImageAt, 'sample'>[]): number[] {
  const wanted = [
    ...new Set(
      sizes.flatMap(({ sample }) => [sample.width, sample.width * 2].map((width) => Math.ceil(width / 10) * 10)),
    ),
  ].sort((a, b) => a - b);
  const merged: number[] = [];
  for (const width of wanted) {
    const last = merged.at(-1);
    if (last !== undefined && width <= last * 1.15) merged[merged.length - 1] = width;
    else merged.push(width);
  }
  while (merged.length > 6) {
    // Drop the width closest to its neighbour below.
    let closest = 1;
    for (let index = 2; index < merged.length; index++)
      if (merged[index]! / merged[index - 1]! < merged[closest]! / merged[closest - 1]!) closest = index;
    merged.splice(closest - 1, 1);
  }
  return merged;
}

/** `srcset="hero-360.jpg 360w, …"` with the file's name as a pattern. */
export function srcsetText(file: string, widths: readonly number[]): string {
  const dot = file.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [file.slice(0, dot), file.slice(dot)] : [file || 'image', ''];
  return widths.map((width) => `${stem}-${width}${extension} ${width}w`).join(', ');
}

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

/** The images as a Markdown table: each one's suggested `sizes` and `srcset` widths. */
export function imagesMarkdown(page: string, rows: readonly ImageRow[], heading: string, headers: string[]): string {
  const lines = [
    `${heading} · ${page}`,
    '',
    `| ${headers.map(cell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) =>
        `| ${[
          row.file || row.label,
          row.sizes
            .map(({ viewport, sample }) => `${viewport}: ${sample.width}px (${sample.naturalWidth}px)`)
            .join(', '),
          `\`${suggestSizes(row.sizes)}\``,
          suggestSrcset(row.sizes)
            .map((width) => `${width}w`)
            .join(', '),
        ]
          .map(cell)
          .join(' | ')} |`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}
