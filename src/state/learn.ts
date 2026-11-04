import type { MessageKey } from '../i18n/en';
import type { GuideAction, GuideId } from './guides';

/**
 * The getting-started checklist: a few things worth doing once, ticked off by
 * themselves as the user does them. Only which ones are done is kept, on this
 * device, apart from the settings.
 */

export type LearnTask = 'preview' | 'viewport' | 'inspect' | 'audit' | 'scan' | 'notes' | 'capture' | 'explain';

export type LearnTaskInfo = {
  id: LearnTask;
  title: MessageKey;
  /** The guide that shows how ("Show me"). */
  guide?: GuideId;
  /** Or what to open straight away. */
  action?: GuideAction;
};

export const LEARN_TASKS: readonly LearnTaskInfo[] = [
  { id: 'preview', title: 'learn.preview', guide: 'basics' },
  { id: 'viewport', title: 'learn.viewport', guide: 'breaks' },
  { id: 'inspect', title: 'learn.inspect', guide: 'inspect' },
  { id: 'audit', title: 'learn.audit', guide: 'audit' },
  { id: 'scan', title: 'learn.scan', guide: 'breaks' },
  { id: 'notes', title: 'learn.notes', guide: 'notes' },
  { id: 'capture', title: 'learn.capture', guide: 'share' },
  { id: 'explain', title: 'learn.explain', action: 'explain' },
];

const TASK_IDS = new Set<string>(LEARN_TASKS.map((task) => task.id));

export type LearnProgress = {
  done: LearnTask[];
  /** The user put the checklist away (it stays in Help). */
  hidden: boolean;
};

export const EMPTY_LEARN: LearnProgress = { done: [], hidden: false };

/** Progress as stored (untrusted): unknown tasks and duplicates are dropped. */
export function parseLearnProgress(raw: unknown): LearnProgress {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LEARN, done: [] };
  const record = raw as Record<string, unknown>;
  const done = Array.isArray(record.done)
    ? [...new Set(record.done.filter((id): id is LearnTask => typeof id === 'string' && TASK_IDS.has(id)))]
    : [];
  return { done, hidden: record.hidden === true };
}

/** The progress with these tasks done; the same object when nothing changes. */
export function completeTasks(progress: LearnProgress, tasks: readonly LearnTask[]): LearnProgress {
  const added = tasks.filter((task, index) => !progress.done.includes(task) && tasks.indexOf(task) === index);
  return added.length ? { ...progress, done: [...progress.done, ...added] } : progress;
}

export function learnSummary(progress: LearnProgress): { done: number; total: number; complete: boolean } {
  const done = LEARN_TASKS.filter((task) => progress.done.includes(task.id)).length;
  return { done, total: LEARN_TASKS.length, complete: done === LEARN_TASKS.length };
}

/** What the workspace shows right now, as far as the checklist cares. */
export type LearnSnapshot = {
  hasUrl: boolean;
  /** The sizes of the viewports, compared with those the session started with. */
  viewportsChanged: boolean;
  /** An element is selected in the inspector. */
  inspected: boolean;
  auditing: boolean;
  scanning: boolean;
  notes: number;
  /** A screenshot was taken this session. */
  captured: boolean;
  explaining: boolean;
};

/** The tasks the workspace shows are done. */
export function tasksDone(snapshot: LearnSnapshot): LearnTask[] {
  const tasks: LearnTask[] = [];
  if (snapshot.hasUrl) tasks.push('preview');
  if (snapshot.viewportsChanged) tasks.push('viewport');
  if (snapshot.inspected) tasks.push('inspect');
  if (snapshot.auditing) tasks.push('audit');
  if (snapshot.scanning) tasks.push('scan');
  if (snapshot.notes > 0) tasks.push('notes');
  if (snapshot.captured) tasks.push('capture');
  if (snapshot.explaining) tasks.push('explain');
  return tasks;
}
