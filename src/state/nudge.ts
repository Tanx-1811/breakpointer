/**
 * The rating nudge: once Breakpointer has been used on a few days, it asks —
 * once, and once more at most after "Not now" — whether the user would rate
 * it. Only counts are kept, on this device, and nothing is sent anywhere.
 */
export type Usage = {
  /** Days a page was previewed (counted, not listed). */
  days: number;
  /** The last of those days (local date, YYYY-MM-DD). */
  lastDay: string;
  /** `pending`: not asked yet; `later`: asked, "Not now"; `done`: rated, or "Don't ask again". */
  nudge: 'pending' | 'later' | 'done';
  /** Ask once `days` reaches this. */
  askAt: number;
};

/** First asked after this many days of use… */
export const FIRST_NUDGE_DAYS = 5;
/** …and after "Not now", this many days of use later (then never again). */
export const LATER_NUDGE_DAYS = 14;

export const freshUsage = (): Usage => ({ days: 0, lastDay: '', nudge: 'pending', askAt: FIRST_NUDGE_DAYS });

/** Stored usage, validated (anything odd starts afresh rather than asking at once). */
export function parseUsage(raw: unknown): Usage {
  if (typeof raw !== 'object' || raw === null) return freshUsage();
  const value = raw as Record<string, unknown>;
  const whole = (item: unknown, fallback: number) =>
    typeof item === 'number' && Number.isInteger(item) && item >= 0 && item < 100_000 ? item : fallback;
  const nudge = value.nudge === 'later' || value.nudge === 'done' ? value.nudge : 'pending';
  return {
    days: whole(value.days, 0),
    lastDay: typeof value.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.lastDay) ? value.lastDay : '',
    nudge,
    askAt: Math.max(FIRST_NUDGE_DAYS, whole(value.askAt, FIRST_NUDGE_DAYS)),
  };
}

/** The local date of `date` as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Counts `today` as a day of use (once). */
export function recordDay(usage: Usage, today: string): Usage {
  return usage.lastDay === today ? usage : { ...usage, days: usage.days + 1, lastDay: today };
}

export const shouldNudge = (usage: Usage) => usage.nudge !== 'done' && usage.days >= usage.askAt;

/** "Not now": ask again later, once. */
export function snooze(usage: Usage): Usage {
  return usage.nudge === 'later'
    ? { ...usage, nudge: 'done' }
    : { ...usage, nudge: 'later', askAt: usage.days + LATER_NUDGE_DAYS };
}

/** Rated, or "Don't ask again". */
export const finish = (usage: Usage): Usage => ({ ...usage, nudge: 'done' });
