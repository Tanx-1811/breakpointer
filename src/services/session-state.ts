/**
 * Short-lived UI state kept in chrome.storage.session: in memory only, shared
 * by the extension's pages, and cleared when Chrome closes.
 */
const DISMISSED_KEY = 'breakpointer.dismissedNoticeHosts';
const MAX_HOSTS = 200;

export async function loadDismissedNoticeHosts(): Promise<string[]> {
  try {
    const value = (await chrome.storage.session.get(DISMISSED_KEY))[DISMISSED_KEY];
    return Array.isArray(value) ? value.filter((host): host is string => typeof host === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveDismissedNoticeHosts(hosts: string[]): Promise<void> {
  try {
    await chrome.storage.session.set({ [DISMISSED_KEY]: hosts.slice(-MAX_HOSTS) });
  } catch {
    // Not critical: the tip simply shows again.
  }
}
