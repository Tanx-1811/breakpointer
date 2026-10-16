import { diffImages, type DiffRegion } from '../state/image-diff';

export type ImageComparison = {
  /** Share of pixels that changed, from 0 to 1. */
  ratio: number;
  changed: number;
  /** Boxes around the changes, in the baseline's pixels. */
  regions: DiffRegion[];
  width: number;
  height: number;
  /** The new capture had another size and was scaled to the baseline's (scaling shows as small changes). */
  resized: boolean;
  /** The baseline faded, with the changes in magenta. */
  diff: Blob;
};

function pixelsOf(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No 2D canvas');
  context.drawImage(bitmap, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

/** The size of an image file, in pixels. */
export async function imageSize(image: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(image);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/** Compares a new capture with a baseline, pixel by pixel, at the baseline's size. */
export async function compareImages(baseline: Blob, current: Blob): Promise<ImageComparison> {
  const [before, after] = await Promise.all([createImageBitmap(baseline), createImageBitmap(current)]);
  try {
    const { width, height } = before;
    const resized = after.width !== width || after.height !== height;
    const result = diffImages(pixelsOf(before, width, height), pixelsOf(after, width, height), width, height);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas');
    context.putImageData(new ImageData(result.output, width, height), 0, 0);
    const diff = await canvas.convertToBlob({ type: 'image/png' });
    return { ratio: result.ratio, changed: result.changed, regions: result.regions, width, height, resized, diff };
  } finally {
    before.close();
    after.close();
  }
}
