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

/** Waits for the next paint; falls back to a timer because hidden tabs don't paint. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 100);
  });

async function dataUrlToBitmap(dataUrl: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUrl)).blob();
  return createImageBitmap(blob);
}

/** Chrome allows two captureVisibleTab calls per second. */
const CAPTURE_INTERVAL_MS = 600;
let lastCaptureAt = 0;

async function captureVisibleTab(windowId: number | undefined): Promise<string> {
  const wait = lastCaptureAt + CAPTURE_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  try {
    return windowId !== undefined
      ? await chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      : await chrome.tabs.captureVisibleTab({ format: 'png' });
  } finally {
    lastCaptureAt = Date.now();
  }
}

/**
 * An image of a whole window's page (e.g. a viewport opened as a real window),
 * at the screen's resolution. The window is brought to the front first.
 */
export async function captureWindowImage(windowId: number): Promise<Blob | null> {
  try {
    await chrome.windows.update(windowId, { focused: true });
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await dataUrlToBlob(await captureVisibleTab(windowId));
  } catch (error) {
    console.warn('[Breakpointer] Could not capture a window.', error);
    return null;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export type ElementImage = { blob: Blob; partial: boolean };

/**
 * An image of `element` as it currently appears on screen. The visible tab is
 * captured and cropped to the element; anything scrolled out of view can't be
 * captured, which is reported as `partial`.
 */
export async function captureElementImage(
  element: HTMLElement,
  type: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<ElementImage | null> {
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
    // Only what is visible inside the scrolling workspace (not under the toolbars).
    const viewport =
      element.closest('main')?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const left = Math.max(viewport.left, rect.left, 0);
    const top = Math.max(viewport.top, rect.top, 0);
    const right = Math.min(viewport.right, rect.right, window.innerWidth);
    const bottom = Math.min(viewport.bottom, rect.bottom, window.innerHeight);
    if (right - left < 1 || bottom - top < 1) return null;

    const scrollable = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
    const clipped =
      rect.left < left - 0.5 || rect.top < top - 0.5 || rect.right > right + 0.5 || rect.bottom > bottom + 0.5;

    // captureVisibleTab captures the active tab of a window: make sure that is
    // this workspace tab (e.g. after the user switched tabs during a prompt).
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined && !tab.active) {
      await chrome.tabs.update(tab.id, { active: true });
      await nextFrame();
      await nextFrame();
    }
    const dataUrl = await captureVisibleTab(tab?.windowId);
    delete root.dataset.capturing;
    const bitmap = await dataUrlToBitmap(dataUrl);
    const scaleX = bitmap.width / window.innerWidth;
    const scaleY = bitmap.height / window.innerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round((right - left) * scaleX);
    canvas.height = Math.round((bottom - top) * scaleY);
    const context = canvas.getContext('2d');
    if (!context) return null;
    if (type === 'image/jpeg') {
      // JPEG has no transparency.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
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

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    return blob ? { blob, partial: clipped || scrollable } : null;
  } catch (error) {
    console.warn('[Breakpointer] Screenshot failed.', error);
    return null;
  } finally {
    delete root.dataset.capturing;
    previouslyFocused?.focus({ preventScroll: true });
  }
}

/** Saves a PNG of `element` as it currently appears on screen. */
export async function captureElement(element: HTMLElement, fileName: string): Promise<CaptureResult> {
  const image = await captureElementImage(element);
  if (!image) return { ok: false };
  downloadBlob(image.blob, fileName);
  return { ok: true, fileName, partial: image.partial };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}

/** Copies an image to the clipboard. The workspace must have focus (it does after a click in it). */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch (error) {
    console.warn('[Breakpointer] Could not copy the image.', error);
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
