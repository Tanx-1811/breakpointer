import type { ColorScheme } from '../types';
import { pageOf } from './follow';

/**
 * A baseline screenshot of one page at one viewport, kept to check later what
 * changed ("visual check"). Stored in this browser only (IndexedDB), never in
 * exports.
 */
export type Snapshot = {
  /** One baseline per page and viewport size (and page colours). */
  id: string;
  /** The page's address without its #fragment. */
  page: string;
  /** "375x667", or "375x667 dark" for a preview in the page's dark colours. */
  viewport: string;
  /** The viewport's name when it was captured. */
  name: string;
  width: number;
  height: number;
  createdAt: number;
  /** A PNG of the preview as shown on screen. */
  image: Blob;
  imageWidth: number;
  imageHeight: number;
};

/**
 * A stored record that is a usable baseline: what the database holds is
 * checked, not trusted (another version may have written it, or DevTools).
 */
export function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const numbers = ['width', 'height', 'createdAt', 'imageWidth', 'imageHeight'];
  return (
    ['id', 'page', 'viewport', 'name'].every((key) => typeof record[key] === 'string') &&
    numbers.every((key) => typeof record[key] === 'number' && Number.isFinite(record[key])) &&
    typeof Blob !== 'undefined' &&
    record.image instanceof Blob
  );
}

/** What identifies a viewport's baseline: its size and page colours (not its name, which can change). */
export function viewportKey(viewport: { width: number; height: number; colorScheme?: ColorScheme }): string {
  return `${viewport.width}x${viewport.height}${viewport.colorScheme ? ` ${viewport.colorScheme}` : ''}`;
}

export function snapshotPage(url: string): string {
  return pageOf(url);
}

export function snapshotId(page: string, viewport: string): string {
  return `${snapshotPage(page)} ${viewport}`;
}

/** At most this many baselines are kept; the oldest go first. */
export const MAX_SNAPSHOTS = 400;

/** The ids to delete so that at most `max` snapshots remain, oldest first. */
export function snapshotsToPrune(snapshots: Pick<Snapshot, 'id' | 'createdAt'>[], max = MAX_SNAPSHOTS): string[] {
  if (snapshots.length <= max) return [];
  return [...snapshots]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, snapshots.length - max)
    .map((snapshot) => snapshot.id);
}

/** One line per page with baselines, for Settings: newest first. */
export type SnapshotPage = { page: string; count: number; bytes: number; updated: number };

export function summarizeSnapshots(snapshots: Pick<Snapshot, 'page' | 'createdAt' | 'image'>[]): SnapshotPage[] {
  const pages = new Map<string, SnapshotPage>();
  for (const snapshot of snapshots) {
    const entry = pages.get(snapshot.page) ?? { page: snapshot.page, count: 0, bytes: 0, updated: 0 };
    entry.count++;
    entry.bytes += snapshot.image.size;
    entry.updated = Math.max(entry.updated, snapshot.createdAt);
    pages.set(snapshot.page, entry);
  }
  return [...pages.values()].sort((a, b) => b.updated - a.updated);
}
