import { gradeOf, type ScoreGrade } from './score';

/**
 * The responsive score of each page over time, kept on this device: one entry
 * per page and day (the day's last score), the 30 latest days of the 200 pages
 * checked most recently. Pages are keys made from a hash of their address, so
 * the history never holds an address.
 */
export type ScoreEntry = { day: string; score: number; sizes: number };

export type ScoreHistory = Record<string, ScoreEntry[]>;

export const MAX_HISTORY_DAYS = 30;
export const MAX_HISTORY_PAGES = 200;

/** `2026-11-04` in local time. */
export function dayOf(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Reads stored history as untrusted data: bad entries are dropped, limits applied. */
export function parseScoreHistory(value: unknown): ScoreHistory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const pages: [string, ScoreEntry[], string][] = [];
  for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z0-9]{8,64}$/.test(key) || !Array.isArray(list)) continue;
    const byDay = new Map<string, ScoreEntry>();
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const { day, score, sizes } = item as Record<string, unknown>;
      if (typeof day !== 'string' || !DAY.test(day)) continue;
      if (typeof score !== 'number' || !Number.isFinite(score)) continue;
      byDay.set(day, {
        day,
        score: Math.max(0, Math.min(100, Math.round(score))),
        sizes: typeof sizes === 'number' && sizes >= 1 ? Math.min(99, Math.round(sizes)) : 1,
      });
    }
    const entries = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_HISTORY_DAYS);
    if (entries.length) pages.push([key, entries, entries.at(-1)!.day]);
  }
  pages.sort((a, b) => b[2].localeCompare(a[2]));
  return Object.fromEntries(pages.slice(0, MAX_HISTORY_PAGES).map(([key, entries]) => [key, entries]));
}

/** The history with today's score of a page (replacing an earlier one of the same day). */
export function recordScore(history: ScoreHistory, key: string, entry: ScoreEntry): ScoreHistory {
  const entries = (history[key] ?? []).filter((item) => item.day !== entry.day);
  entries.push(entry);
  entries.sort((a, b) => a.day.localeCompare(b.day));
  const next: ScoreHistory = { ...history, [key]: entries.slice(-MAX_HISTORY_DAYS) };
  const keys = Object.keys(next);
  if (keys.length <= MAX_HISTORY_PAGES) return next;
  // Drop the pages checked longest ago.
  const oldest = keys.sort((a, b) => next[a]!.at(-1)!.day.localeCompare(next[b]!.at(-1)!.day))[0]!;
  const { [oldest]: _dropped, ...rest } = next;
  return rest;
}

/** Whether the history already has this score for the day (nothing to write). */
export const hasScore = (history: ScoreHistory, key: string, entry: ScoreEntry) =>
  (history[key] ?? []).some(
    (item) => item.day === entry.day && item.score === entry.score && item.sizes === entry.sizes,
  );

export type ScoreTrend = {
  first: ScoreEntry;
  last: ScoreEntry;
  /** Last minus first. */
  change: number;
  best: number;
  grade: ScoreGrade;
};

/** The trend over the stored days; null with fewer than two. */
export function scoreTrend(entries: readonly ScoreEntry[] | undefined): ScoreTrend | null {
  if (!entries || entries.length < 2) return null;
  const first = entries[0]!;
  const last = entries.at(-1)!;
  return {
    first,
    last,
    change: last.score - first.score,
    best: Math.max(...entries.map((entry) => entry.score)),
    grade: gradeOf(last.score),
  };
}

/** Points of a sparkline in a `width` × `height` box (0 at the bottom, 100 at the top). */
export function sparkline(entries: readonly ScoreEntry[], width: number, height: number): string {
  if (entries.length === 0) return '';
  const step = entries.length > 1 ? width / (entries.length - 1) : 0;
  return entries
    .map((entry, index) => {
      const x = entries.length > 1 ? index * step : width / 2;
      const y = height - (entry.score / 100) * height;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(' ');
}
