import { parseScoreHistory, type ScoreHistory } from '../state/score-history';

/** Kept apart from the settings: it isn't a preference and isn't exported. */
const SCORES_KEY = 'breakpointer.scores';

/**
 * A page's key in the history: the first 16 hex digits of the SHA-256 of its
 * address without the fragment, so the history holds no address.
 */
export async function scorePageKey(page: string): Promise<string> {
  const address = page.replace(/#.*$/, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function readScoreHistory(): Promise<ScoreHistory> {
  try {
    return parseScoreHistory((await chrome.storage.local.get(SCORES_KEY))[SCORES_KEY]);
  } catch {
    return {};
  }
}

export async function writeScoreHistory(history: ScoreHistory): Promise<void> {
  try {
    await chrome.storage.local.set({ [SCORES_KEY]: history });
  } catch {
    // Not critical: the score is recorded again next time.
  }
}

export async function clearScoreHistory(): Promise<void> {
  try {
    await chrome.storage.local.remove(SCORES_KEY);
  } catch {
    // Nothing to clear.
  }
}
