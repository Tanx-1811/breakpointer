/**
 * Which version's news the user has seen, kept apart from the settings (it
 * isn't a preference and isn't exported). After an update, the Help button
 * shows a dot until Help is opened.
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
