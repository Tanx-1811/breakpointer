import { disableEmbeddingForTab, enableEmbeddingForTab } from './embed-rules';
import { isIpAddress } from '../utils/url';

export type ProbeResult = { kind: 'reachable' } | { kind: 'unreachable' } | { kind: 'unknown' };

export type Size = { width: number; height: number };

/**
 * Everything the viewer needs from the rendering mechanism besides the frame
 * element itself (see components/PreviewFrame). V1 renders each viewport in an
 * iframe sized to the viewport, so the page's layout engine sees the real
 * width and height. Keeping this behind an interface lets a later version swap
 * in another mechanism (separate windows, a capture backend) without touching
 * the UI. See docs/ARCHITECTURE.md.
 */
export interface PreviewAdapter {
  /** Prepares the current tab for previews. Resolves false if that wasn't possible. */
  start(): Promise<boolean>;
  /** Undoes `start`. Safe to call more than once. */
  stop(): Promise<void>;
  /** Best-effort check that the site can be reached at all. Never rejects. */
  probe(url: URL, timeoutMs?: number): Promise<ProbeResult>;
  /** Fallback for pages that can't be framed: open them as a normal tab. */
  openInTab(url: string): Promise<void>;
  /**
   * Opens the page as a real top-level window whose content area matches
   * `size` as closely as Chrome allows. Resolves the size actually achieved.
   */
  openInWindow(url: string, size: Size): Promise<Size | null>;
}

function isLocalNetworkHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || isIpAddress(hostname)
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function contentSize(tabId: number): Promise<Size | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.width && tab.height) return { width: tab.width, height: tab.height };
    await sleep(50);
  }
  return null;
}

export function createIframePreviewAdapter(): PreviewAdapter {
  let tabId: number | undefined;

  return {
    async start() {
      try {
        const tab = await chrome.tabs.getCurrent();
        if (tab?.id === undefined) return false;
        tabId = tab.id;
        await enableEmbeddingForTab(tabId);
        return true;
      } catch (error) {
        console.warn('[Breakpointer] Could not enable the embedding helper.', error);
        return false;
      }
    },

    async stop() {
      if (tabId === undefined) return;
      const id = tabId;
      tabId = undefined;
      try {
        await disableEmbeddingForTab(id);
      } catch {
        // The service worker also removes the rule when the tab closes or navigates.
      }
    },

    async probe(url, timeoutMs = 8000) {
      // Fetches to local servers can be subject to Chrome's local network access
      // rules; let the frames load and speak for themselves instead.
      if (isLocalNetworkHost(url.hostname)) return { kind: 'unknown' };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        // An opaque no-cors request: it only tells whether the host answered.
        // No cookies are sent and nothing about the response is read.
        await fetch(url.href, {
          method: 'HEAD',
          mode: 'no-cors',
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal,
        });
        return { kind: 'reachable' };
      } catch {
        return controller.signal.aborted ? { kind: 'unknown' } : { kind: 'unreachable' };
      } finally {
        clearTimeout(timer);
      }
    },

    async openInTab(url) {
      await chrome.tabs.create({ url });
    },

    async openInWindow(url, size) {
      const created = await chrome.windows.create({
        url,
        type: 'popup',
        width: size.width,
        height: size.height,
        focused: true,
      });
      const windowId = created?.id;
      const createdTabId = created?.tabs?.[0]?.id;
      if (windowId === undefined || createdTabId === undefined) return null;

      // Window sizes include the title and address bars, which vary by OS.
      // Measure the content area and correct the outer size until it matches.
      let inner = await contentSize(createdTabId);
      for (let attempt = 0; inner && attempt < 3; attempt++) {
        const dx = size.width - inner.width;
        const dy = size.height - inner.height;
        if (dx === 0 && dy === 0) break;
        const current = await chrome.windows.get(windowId);
        await chrome.windows.update(windowId, {
          width: (current.width ?? size.width) + dx,
          height: (current.height ?? size.height) + dy,
        });
        await sleep(150);
        inner = (await contentSize(createdTabId)) ?? inner;
      }
      return inner;
    },
  };
}
