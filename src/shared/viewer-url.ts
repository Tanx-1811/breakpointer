export type ViewerParams = {
  /** A validated http(s) URL to preview. */
  url?: string;
  /** A group to apply on open: a saved group id or "builtin:<id>". */
  group?: string;
  /** Raw text that couldn't be parsed as a URL, shown so the user can fix it. */
  input?: string;
};

export function viewerUrl(params: ViewerParams = {}): string {
  const base = chrome.runtime.getURL('viewer/viewer.html');
  const search = new URLSearchParams();
  if (params.url) search.set('url', params.url);
  if (params.group) search.set('group', params.group);
  if (params.input) search.set('input', params.input);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export async function openViewer(params: ViewerParams = {}, placement: { index?: number; windowId?: number } = {}) {
  await chrome.tabs.create({ url: viewerUrl(params), ...placement });
}
