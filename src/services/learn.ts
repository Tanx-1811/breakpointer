import { parseLearnProgress, type LearnProgress } from '../state/learn';

/** Kept apart from the settings: it isn't a preference and isn't exported. */
const LEARN_KEY = 'breakpointer.learn';

export async function readLearnProgress(): Promise<LearnProgress> {
  try {
    return parseLearnProgress((await chrome.storage.local.get(LEARN_KEY))[LEARN_KEY]);
  } catch {
    return parseLearnProgress(undefined);
  }
}

export async function writeLearnProgress(progress: LearnProgress): Promise<void> {
  try {
    await chrome.storage.local.set({ [LEARN_KEY]: progress });
  } catch {
    // Not critical: the checklist ticks the task again next time.
  }
}
