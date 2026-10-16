/**
 * Site access "until Chrome closes". Chrome's permissions have no expiry, so
 * the patterns granted this way are written down (in local storage, so a
 * crash doesn't lose them) and the service worker removes them the next time
 * Chrome starts. The user can keep one for good from Site access.
 */
const SESSION_GRANTS_KEY = 'breakpointer.sessionGrants';
const MAX_GRANTS = 200;

/** Host patterns, without duplicates or anything that isn't a string. */
export function cleanPatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length < 300))].slice(
    -MAX_GRANTS,
  );
}

export async function sessionGrants(): Promise<string[]> {
  try {
    return cleanPatterns((await chrome.storage.local.get(SESSION_GRANTS_KEY))[SESSION_GRANTS_KEY]);
  } catch {
    return [];
  }
}

async function saveGrants(patterns: string[]): Promise<void> {
  await chrome.storage.local.set({ [SESSION_GRANTS_KEY]: cleanPatterns(patterns) });
}

export async function addSessionGrant(pattern: string): Promise<void> {
  await saveGrants([...(await sessionGrants()), pattern]);
}

/** The pattern stays granted for good (kept), or was removed by the user. */
export async function forgetSessionGrants(patterns: string[]): Promise<void> {
  const current = await sessionGrants();
  if (current.some((pattern) => patterns.includes(pattern)))
    await saveGrants(current.filter((pattern) => !patterns.includes(pattern)));
}

/** At browser start: removes the access granted until Chrome closes. */
export async function revokeSessionGrants(): Promise<void> {
  const patterns = await sessionGrants();
  if (!patterns.length) return;
  try {
    await chrome.permissions.remove({ origins: patterns });
  } catch {
    // Already removed, or granted at install (only in test builds).
  }
  await saveGrants([]);
}
