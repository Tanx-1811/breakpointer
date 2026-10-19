import { dayKey, parseUsage, recordDay, type Usage } from '../state/nudge';

/** Kept apart from the settings: it isn't a preference and isn't exported. */
const USAGE_KEY = 'breakpointer.usage';

export async function readUsage(): Promise<Usage> {
  try {
    return parseUsage((await chrome.storage.local.get(USAGE_KEY))[USAGE_KEY]);
  } catch {
    return parseUsage(undefined);
  }
}

export async function writeUsage(usage: Usage): Promise<void> {
  try {
    await chrome.storage.local.set({ [USAGE_KEY]: usage });
  } catch {
    // Not critical: the nudge may come a little later.
  }
}

/** Counts today as a day of use; returns the usage as stored now. */
export async function countToday(now = new Date()): Promise<Usage> {
  const before = await readUsage();
  const after = recordDay(before, dayKey(now));
  if (after !== before) await writeUsage(after);
  return after;
}
