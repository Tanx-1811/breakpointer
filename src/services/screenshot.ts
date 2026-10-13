import { ALL_SITES_PATTERNS } from './site-access';
import { downloadBlob } from '../utils/download';

/** Chrome allows chrome.tabs.captureVisibleTab only with `<all_urls>` (or activeTab). */
export async function canCapture(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: ALL_SITES_PATTERNS });
  } catch {
    return false;
  }
}

/** Must run inside a user gesture (click). */
export function requestCapturePermission(): Promise<boolean> {
  return chrome.permissions.request({ origins: ALL_SITES_PATTERNS });
}

export type CaptureResult = { ok: true; fileName: string; partial: boolean } | { ok: false };

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function dataUrlToBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

/**
 * Saves a PNG of `element` as it currently appears on screen. The visible tab
 * is captured and cropped to the element; anything scrolled out of view can't
 * be captured, which is reported as `partial`.
 */
export async function captureElement(element: HTMLElement, fileName: string): Promise<CaptureResult> {
  const root = document.documentElement;
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  try {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Hide transient UI (toasts, menus, focus rings) while capturing.
    root.dataset.capturing = 'true';
    previouslyFocused?.blur();
    await nextFrame();
    await nextFrame();

    const rect = element.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right - left < 1 || bottom - top < 1) return { ok: false };

    const scrollable = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
    const clipped =
      rect.left < -0.5 ||
      rect.top < -0.5 ||
      rect.right > window.innerWidth + 0.5 ||
      rect.bottom > window.innerHeight + 0.5;

    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    delete root.dataset.capturing;
    const bitmap = await dataUrlToBitmap(dataUrl);
    const scaleX = bitmap.width / window.innerWidth;
    const scaleY = bitmap.height / window.innerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round((right - left) * scaleX);
    canvas.height = Math.round((bottom - top) * scaleY);
    const context = canvas.getContext('2d');
    if (!context) return { ok: false };
    context.drawImage(
      bitmap,
      Math.round(left * scaleX),
      Math.round(top * scaleY),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return { ok: false };
    downloadBlob(blob, fileName);
    return { ok: true, fileName, partial: clipped || scrollable };
  } catch (error) {
    console.warn('[Breakpointer] Screenshot failed.', error);
    return { ok: false };
  } finally {
    delete root.dataset.capturing;
    previouslyFocused?.focus({ preventScroll: true });
  }
}
