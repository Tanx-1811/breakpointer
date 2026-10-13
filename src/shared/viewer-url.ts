export type ViewerParams = {
  /** A validated http(s) URL to preview. */
  url?: string;
  /** A group to apply on open: a saved group id or "builtin:<id>". */
  group?: string;
  /** Raw text that couldn't be parsed as a URL, shown so the user can fix it. */
  input?: string;
};

export type ViewerPlacement = {
  /** Where to put a new tab if one has to be created. */
  index?: number;
  windowId?: number;
  /** Always open a new workspace tab instead of reusing an open one. */
  newTab?: boolean;
};

function viewerPage(): string {
  return chrome.runtime.getURL('viewer/viewer.html');
}

export function viewerUrl(params: ViewerParams = {}): string {
  const search = new URLSearchParams();
  if (params.url) search.set('url', params.url);
  if (params.group) search.set('group', params.group);
  if (params.input) search.set('input', params.input);
  const query = search.toString();
  return query ? `${viewerPage()}?${query}` : viewerPage();
}

/** An open workspace tab, preferring one in the last focused window. */
async function findViewerTab(): Promise<{ tabId: number; windowId: number } | null> {
  try {
    const page = viewerPage();
    const contexts = (await chrome.runtime.getContexts({ contextTypes: ['TAB'] })).filter(
      (context) => context.tabId >= 0 && context.documentUrl?.startsWith(page),
    );
    if (contexts.length === 0) return null;
    const focused = await chrome.windows.getLastFocused().catch(() => undefined);
    const match = contexts.find((context) => context.windowId === focused?.id) ?? contexts[0]!;
    return { tabId: match.tabId, windowId: match.windowId };
  } catch {
    return null;
  }
}

/**
 * Shows the workspace: switches to an open workspace tab (loading the given
 * page or group into it) or opens a new one. Reusing the tab avoids piling up
 * a new workspace for every preview.
 */
export async function openViewer(params: ViewerParams = {}, placement: ViewerPlacement = {}): Promise<void> {
  const existing = placement.newTab ? null : await findViewerTab();
  if (existing) {
    const hasParams = Boolean(params.url || params.group || params.input);
    await chrome.tabs.update(existing.tabId, hasParams ? { active: true, url: viewerUrl(params) } : { active: true });
    await chrome.windows.update(existing.windowId, { focused: true }).catch(() => undefined);
    return;
  }
  const { newTab: _newTab, ...where } = placement;
  try {
    await chrome.tabs.create({ url: viewerUrl(params), ...where });
  } catch {
    // e.g. the requested window is a popup window, which can't hold more tabs.
    await chrome.tabs.create({ url: viewerUrl(params) });
  }
}
