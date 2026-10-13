import { siteAccessPattern } from '../utils/url';

/**
 * "All sites" access. `<all_urls>` (rather than http/https patterns) because
 * Chrome requires exactly this for chrome.tabs.captureVisibleTab (screenshots).
 */
export const ALL_SITES_PATTERNS = ['<all_urls>'];

function containsOrigins(origins: string[]): Promise<boolean> {
  return chrome.permissions.contains({ origins });
}

export async function hasSiteAccess(url: URL): Promise<boolean> {
  try {
    return await containsOrigins([`${url.protocol}//${url.hostname}/*`]);
  } catch {
    return false;
  }
}

export async function hasAllSitesAccess(): Promise<boolean> {
  try {
    return await containsOrigins(ALL_SITES_PATTERNS);
  } catch {
    return false;
  }
}

/** Must be called from a user gesture (click) in an extension page. */
export function requestSiteAccess(url: URL): Promise<boolean> {
  return chrome.permissions.request({ origins: [siteAccessPattern(url)] });
}

/** Must be called from a user gesture (click) in an extension page. */
export function requestAllSitesAccess(): Promise<boolean> {
  return chrome.permissions.request({ origins: ALL_SITES_PATTERNS });
}

/**
 * Host patterns granted at runtime. Required host permissions (only present in
 * the e2e build) can't be revoked, so callers should treat removal as best-effort.
 */
export async function listGrantedPatterns(): Promise<string[]> {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter((origin) => !origin.startsWith('chrome-extension://')).sort();
}

export async function revokePatterns(origins: string[]): Promise<boolean> {
  try {
    return await chrome.permissions.remove({ origins });
  } catch {
    return false;
  }
}

/** Notifies when host access changes in any extension page. Returns an unsubscribe function. */
export function onSiteAccessChanged(callback: () => void): () => void {
  const listener = () => callback();
  chrome.permissions.onAdded.addListener(listener);
  chrome.permissions.onRemoved.addListener(listener);
  return () => {
    chrome.permissions.onAdded.removeListener(listener);
    chrome.permissions.onRemoved.removeListener(listener);
  };
}
