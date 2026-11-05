/**
 * Which version's news the user has seen, kept apart from the settings (it
 * isn't a preference and isn't exported). After an update — which Chrome
 * installs silently — the toolbar button says "NEW", the popup and the
 * workspace say what changed, and the Help button shows a dot, until Help is
 * opened (or the popup's notice is dismissed).
 */
const SEEN_KEY = 'breakpointer.seenVersion';

/** "0.4.1" → "0.4": news are written per minor version. */
export const minorVersion = (version: string) => version.split('.').slice(0, 2).join('.');

/** True when `current` brings news the user hasn't seen (`seen` is the last version they saw, if any). */
export function hasNews(seen: unknown, current: string): boolean {
  return typeof seen !== 'string' || minorVersion(seen) !== minorVersion(current);
}

export async function readSeenVersion(): Promise<unknown> {
  try {
    return (await chrome.storage.local.get(SEEN_KEY))[SEEN_KEY];
  } catch {
    return undefined;
  }
}

export async function markSeen(version: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [SEEN_KEY]: version });
  } catch {
    // Not critical: the dot shows again next time.
  }
}

/** Calls `listener` when the seen version changes (Help opened in a workspace, or the popup's notice dismissed). */
export function onSeenVersionChange(listener: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SEEN_KEY in changes) listener();
  });
}

/** The toolbar button: "NEW" and a tooltip saying so while this version's news are unseen. */
export async function updateNewsBadge(): Promise<void> {
  const version = chrome.runtime.getManifest().version;
  const news = hasNews(await readSeenVersion(), version);
  try {
    await chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
    await chrome.action.setBadgeText({ text: news ? chrome.i18n.getMessage('badgeNew') : '' });
    await chrome.action.setTitle({
      title: news
        ? chrome.i18n.getMessage('actionTitleNews', minorVersion(version))
        : chrome.i18n.getMessage('actionTitle'),
    });
  } catch {
    // Not critical: the workspace still shows what's new.
  }
}
