import { disableEmbeddingForTab, enableEmbeddingForTab } from './embed-rules';
import { fitWindowContent } from './windows';
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
  /**
   * Best-effort check that the site can be reached at all. Never rejects.
   * Only conclusive with host access to the site; otherwise resolves "unknown".
   */
  probe(url: URL, options: { hasAccess: boolean; timeoutMs?: number }): Promise<ProbeResult>;
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

    async probe(url, { hasAccess, timeoutMs = 8000 }) {
      // Without host access an extension page can't tell "down" from "up but
      // restricted": a no-cors request also fails for sites that send
      // Cross-Origin-Resource-Policy (x.com, stackoverflow.com…). Never block
      // previews on a guess — Chrome shows its own error inside each frame.
      // Local servers are skipped too (local network access rules).
      if (!hasAccess || isLocalNetworkHost(url.hostname)) return { kind: 'unknown' };

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        // With host access the request is exempt from CORS: any HTTP response
        // (even 403/404) means the host answered; only DNS, TLS or connection
        // failures reject. No cookies are sent and the body isn't downloaded.
        const response = await fetch(url.href, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'follow',
          signal: controller.signal,
        });
        void response.body?.cancel().catch(() => {});
        return { kind: 'reachable' };
      } catch {
        return timedOut ? { kind: 'unknown' } : { kind: 'unreachable' };
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
      return fitWindowContent(windowId, createdTabId, size);
    },
  };
}
