import { tileWindows, type Rect, type Size } from '../state/window-layout';

/**
 * Real Chrome windows for viewports. A page in its own window is a normal
 * top-level page: sign-in, cookies and storage behave exactly as in a tab, and
 * sites that refuse frames or check for bots load as usual. No permission is
 * needed to open, move, resize or close windows.
 */

export type ManagedWindow = {
  viewportId: string;
  windowId: number;
  tabId: number;
  /** The content size actually achieved (Chrome keeps windows on the screen). */
  width: number;
  height: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The content size of a tab (its page's viewport), once Chrome knows it. */
export async function contentSize(tabId: number): Promise<Size | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.width && tab.height) return { width: tab.width, height: tab.height };
    await sleep(50);
  }
  return null;
}

/**
 * Window sizes include the title and address bars, which vary by OS: measures
 * the content area and corrects the outer size until it matches `size`.
 */
export async function fitWindowContent(windowId: number, tabId: number, size: Size): Promise<Size | null> {
  let inner = await contentSize(tabId);
  for (let attempt = 0; inner && attempt < 3; attempt++) {
    const dx = size.width - inner.width;
    const dy = size.height - inner.height;
    if (dx === 0 && dy === 0) break;
    const current = await chrome.windows.get(windowId);
    const resized = await chrome.windows
      .update(windowId, {
        width: (current.width ?? size.width) + dx,
        height: (current.height ?? size.height) + dy,
      })
      .then(() => true)
      .catch(() => false);
    // Chrome keeps a window on its screen: this is as close as it gets.
    if (!resized) break;
    await sleep(150);
    inner = (await contentSize(tabId)) ?? inner;
  }
  return inner;
}

/** The screen area windows can use (the screen the workspace is on). */
export function screenArea(): Rect {
  const screen = window.screen as Screen & { availLeft?: number; availTop?: number };
  return {
    left: screen.availLeft ?? 0,
    top: screen.availTop ?? 0,
    width: screen.availWidth,
    height: screen.availHeight,
  };
}

/**
 * Opens one popup window per viewport showing `url`, each with a content area
 * of the viewport's size, placed side by side on `area`. The frame around the
 * content is measured on the first window and used to place the others.
 */
export async function openWindowsSideBySide(
  url: string,
  items: { viewportId: string; width: number; height: number }[],
  area: Rect,
): Promise<ManagedWindow[]> {
  const opened: ManagedWindow[] = [];
  let frame: Size = { width: 0, height: 0 };
  const rects = () =>
    tileWindows(
      items.map((item) => ({ width: item.width + frame.width, height: item.height + frame.height })),
      area,
    );
  for (const [index, item] of items.entries()) {
    const rect = rects()[index]!;
    const focused = index === items.length - 1;
    // Chrome refuses a position mostly off its screen (the page's idea of the
    // screen can differ, e.g. when zoomed): then it places the window itself.
    const created = await chrome.windows
      .create({ url, type: 'popup', focused, ...rect })
      .catch(() => chrome.windows.create({ url, type: 'popup', focused, width: rect.width, height: rect.height }));
    const windowId = created?.id;
    const tabId = created?.tabs?.[0]?.id;
    if (windowId === undefined || tabId === undefined) continue;
    if (index === 0) {
      const inner = await contentSize(tabId);
      if (inner) {
        frame = { width: Math.max(0, rect.width - inner.width), height: Math.max(0, rect.height - inner.height) };
        await chrome.windows.update(windowId, rects()[0]!).catch(() => {});
      }
    }
    const achieved = await fitWindowContent(windowId, tabId, item);
    opened.push({
      viewportId: item.viewportId,
      windowId,
      tabId,
      width: achieved?.width ?? item.width,
      height: achieved?.height ?? item.height,
    });
  }
  return opened;
}

export async function closeWindows(windowIds: number[]): Promise<void> {
  await Promise.all(windowIds.map((id) => chrome.windows.remove(id).catch(() => {})));
}

/** Brings the windows to the front, in order (the last one ends up on top). */
export async function focusWindows(windowIds: number[]): Promise<void> {
  for (const id of windowIds) await chrome.windows.update(id, { focused: true }).catch(() => {});
}

/** Brings the window this page is in back to the front. */
export async function focusOwnWindow(): Promise<void> {
  const current = await chrome.windows.getCurrent().catch(() => null);
  if (current?.id !== undefined) await chrome.windows.update(current.id, { focused: true }).catch(() => {});
}

/** Loads `url` in the windows' tabs (they follow the workspace's address). */
export async function navigateWindowTabs(tabIds: number[], url: string): Promise<void> {
  await Promise.all(tabIds.map((id) => chrome.tabs.update(id, { url }).catch(() => {})));
}

/** Calls back with the id of each window that closes. Returns an unsubscribe function. */
export function onWindowClosed(callback: (windowId: number) => void): () => void {
  const listener = (windowId: number) => callback(windowId);
  chrome.windows.onRemoved.addListener(listener);
  return () => chrome.windows.onRemoved.removeListener(listener);
}
