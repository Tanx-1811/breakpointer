import { cssNumber } from './fluid';

/**
 * The CSS toolkit's responsive image markup: from how wide an image is laid
 * out, its `sizes`, the `srcset` widths the previewed viewports need at 1× and
 * 2×, and `<img>` or `<picture>` markup with modern formats.
 */
export type ImageLayout =
  /** As wide as the viewport. */
  | { kind: 'full' }
  /** A content column: the viewport minus side padding, up to a max width. */
  | { kind: 'column'; padding: number; maxWidth: number }
  /** A share of the viewport width. */
  | { kind: 'vw'; share: number }
  /** The same width everywhere. */
  | { kind: 'fixed'; width: number };

export type ImageMarkupSpec = {
  layout: ImageLayout;
  /** File names with `{w}` where the width goes, e.g. `photo-{w}.jpg`. */
  pattern: string;
  /** The image's own proportions (width and height attributes stop layout shifts). */
  ratio: { width: number; height: number };
  alt: string;
  /** Below the first screen: loading="lazy"; else fetchpriority="high". */
  lazy: boolean;
  /** Add AVIF and WebP sources in a <picture>. */
  modern: boolean;
};

/** The width (CSS px) the image is shown at in a viewport. */
export function shownWidth(layout: ImageLayout, viewport: number): number {
  switch (layout.kind) {
    case 'full':
      return viewport;
    case 'column':
      return Math.max(0, Math.min(viewport - 2 * layout.padding, layout.maxWidth));
    case 'vw':
      return (viewport * layout.share) / 100;
    case 'fixed':
      return layout.width;
  }
}

/** The `sizes` attribute for the layout. */
export function sizesFor(layout: ImageLayout): string {
  switch (layout.kind) {
    case 'full':
      return '100vw';
    case 'column': {
      const breakpoint = layout.maxWidth + 2 * layout.padding;
      const below = layout.padding ? `calc(100vw - ${cssNumber(2 * layout.padding, 2)}px)` : '100vw';
      return `(min-width: ${cssNumber(breakpoint, 2)}px) ${cssNumber(layout.maxWidth, 2)}px, ${below}`;
    }
    case 'vw':
      return `${cssNumber(layout.share, 2)}vw`;
    case 'fixed':
      return `${cssNumber(layout.width, 2)}px`;
  }
}

/**
 * Widths worth making: what each viewport needs at 1× and 2× (rounded up to
 * tens), merged when within 15% of the next, at most eight.
 */
export function srcsetWidths(layout: ImageLayout, viewports: readonly number[]): number[] {
  const wanted = [
    ...new Set(
      viewports
        .map((viewport) => shownWidth(layout, viewport))
        .filter((width) => width > 0)
        .flatMap((width) => [width, width * 2].map((value) => Math.ceil(value / 10) * 10)),
    ),
  ].sort((a, b) => a - b);
  const merged: number[] = [];
  for (const width of wanted) {
    const last = merged.at(-1);
    if (last !== undefined && width <= last * 1.15) merged[merged.length - 1] = width;
    else merged.push(width);
  }
  while (merged.length > 8) {
    // Drop the width closest to its smaller neighbour.
    let index = 1;
    for (let i = 2; i < merged.length; i++)
      if (merged[i]! / merged[i - 1]! < merged[index]! / merged[index - 1]!) index = i;
    merged.splice(index - 1, 1);
  }
  return merged;
}

/** `photo-{w}.jpg` at 640 → `photo-640.jpg` (a pattern without `{w}` gets `-640` before the extension). */
export function fileFor(pattern: string, width: number, extension?: string): string {
  const base = pattern.trim() || 'image-{w}.jpg';
  let name = base.includes('{w}') ? base.replaceAll('{w}', String(width)) : addWidth(base, width);
  if (extension) name = name.replace(/\.[a-z0-9]+$/i, '') + extension;
  return name;
}

const addWidth = (file: string, width: number) => {
  const dot = file.lastIndexOf('.');
  return dot > 0 ? `${file.slice(0, dot)}-${width}${file.slice(dot)}` : `${file}-${width}`;
};

const attribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const srcset = (pattern: string, widths: readonly number[], extension?: string) =>
  widths.map((width) => `${fileFor(pattern, width, extension)} ${width}w`).join(',\n         ');

/** The markup: an `<img>`, or a `<picture>` with AVIF and WebP sources. */
export function imageMarkup(spec: ImageMarkupSpec, widths: readonly number[]): string {
  if (widths.length === 0) return '';
  const largest = widths.at(-1)!;
  const height = Math.round((largest * spec.ratio.height) / spec.ratio.width);
  const sizes = sizesFor(spec.layout);
  const loading = spec.lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"';
  const img = (indent: string) =>
    [
      `${indent}<img src="${attribute(fileFor(spec.pattern, largest))}"`,
      `${indent}     srcset="${srcset(spec.pattern, widths).replaceAll('\n', `\n${indent}`)}"`,
      `${indent}     sizes="${sizes}"`,
      `${indent}     width="${largest}" height="${height}"`,
      `${indent}     alt="${attribute(spec.alt)}" ${loading}>`,
    ].join('\n');
  if (!spec.modern) return img('');
  const source = (type: string, extension: string) =>
    [
      `  <source type="${type}"`,
      `          srcset="${srcset(spec.pattern, widths, extension).replaceAll('\n         ', '\n                  ')}"`,
      `          sizes="${sizes}">`,
    ].join('\n');
  return ['<picture>', source('image/avif', '.avif'), source('image/webp', '.webp'), img('  '), '</picture>'].join(
    '\n',
  );
}
