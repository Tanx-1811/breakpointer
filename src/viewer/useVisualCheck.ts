import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { compareImages, imageSize } from '../services/image-diff';
import { deletePageSnapshots, saveSnapshots, snapshotsOf } from '../services/snapshot-store';
import type { DiffRegion } from '../state/image-diff';
import { snapshotId, snapshotPage, viewportKey, type Snapshot } from '../state/snapshots';
import type { ViewportConfig } from '../types';

/** A preview captured as shown on screen. */
export type Capture = { viewport: ViewportConfig; image: Blob };

/** A baseline as the dialog shows it. */
export type VisualBaseline = {
  key: string;
  name: string;
  createdAt: number;
  url: string;
  imageWidth: number;
  imageHeight: number;
};

/** The outcome of comparing one viewport with its baseline. */
export type VisualResult =
  | { status: 'missing'; viewport: ViewportConfig; capture: Blob; currentUrl: string }
  | {
      status: 'compared';
      viewport: ViewportConfig;
      capture: Blob;
      currentUrl: string;
      diffUrl: string;
      ratio: number;
      regions: DiffRegion[];
      width: number;
      height: number;
      resized: boolean;
    }
  | { status: 'failed'; viewport: ViewportConfig };

/**
 * The visual check of one page: its baselines (from this browser's
 * IndexedDB), new baselines, comparisons and accepting a capture as the new
 * baseline. Object URLs for the images are released when replaced and when
 * the workspace closes.
 */
export function useVisualCheck(url: string | null, open: boolean) {
  const page = url ? snapshotPage(url) : null;
  const [baselines, setBaselines] = useState<{ page: string; items: VisualBaseline[]; snapshots: Snapshot[] } | null>(
    null,
  );
  const [results, setResults] = useState<{ page: string; byKey: Record<string, VisualResult> } | null>(null);
  const owned = useRef(new Set<string>());
  // The latest values, to release what they hold when they are replaced (not inside state updaters).
  const latest = useRef({ baselines, results });
  useLayoutEffect(() => {
    latest.current = { baselines, results };
  });

  const track = useCallback((blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    owned.current.add(objectUrl);
    return objectUrl;
  }, []);
  const release = useCallback((objectUrl: string | undefined) => {
    if (!objectUrl || !owned.current.has(objectUrl)) return;
    URL.revokeObjectURL(objectUrl);
    owned.current.delete(objectUrl);
  }, []);
  const releaseResult = useCallback(
    (result: VisualResult | undefined) => {
      if (!result || result.status === 'failed') return;
      release(result.currentUrl);
      if (result.status === 'compared') release(result.diffUrl);
    },
    [release],
  );

  useEffect(() => {
    const urls = owned.current;
    return () => {
      for (const objectUrl of urls) URL.revokeObjectURL(objectUrl);
      urls.clear();
    };
  }, []);

  const load = useCallback(
    async (target: string) => {
      const snapshots = await snapshotsOf(target).catch(() => [] as Snapshot[]);
      const previous = latest.current.baselines;
      const next = {
        page: target,
        snapshots,
        items: snapshots.map((snapshot) => ({
          key: snapshot.viewport,
          name: snapshot.name,
          createdAt: snapshot.createdAt,
          url: track(snapshot.image),
          imageWidth: snapshot.imageWidth,
          imageHeight: snapshot.imageHeight,
        })),
      };
      latest.current = { ...latest.current, baselines: next };
      setBaselines(next);
      previous?.items.forEach((item) => release(item.url));
    },
    [release, track],
  );

  // The baselines of the page shown, read when the dialog opens.
  useEffect(() => {
    if (!open || !page) return;
    const timer = setTimeout(() => void load(page), 0);
    return () => clearTimeout(timer);
  }, [load, open, page]);

  /** Saves these captures as the page's baselines (replacing those of the same viewports). */
  const save = useCallback(
    async (captures: Capture[]) => {
      if (!page || !captures.length) return 0;
      const now = Date.now();
      const snapshots: Snapshot[] = await Promise.all(
        captures.map(async ({ viewport, image }) => {
          const size = await imageSize(image);
          const key = viewportKey(viewport);
          return {
            id: snapshotId(page, key),
            page,
            viewport: key,
            name: viewport.name,
            width: viewport.width,
            height: viewport.height,
            createdAt: now,
            image,
            imageWidth: size.width,
            imageHeight: size.height,
          };
        }),
      );
      await saveSnapshots(snapshots);
      // What was compared against the old baselines is out of date.
      const previous = latest.current.results;
      if (previous) {
        const byKey = { ...previous.byKey };
        for (const snapshot of snapshots) {
          releaseResult(byKey[snapshot.viewport]);
          delete byKey[snapshot.viewport];
        }
        const next = { ...previous, byKey };
        latest.current = { ...latest.current, results: next };
        setResults(next);
      }
      await load(page);
      return snapshots.length;
    },
    [load, page, releaseResult],
  );

  /** Compares each capture with its baseline. */
  const compare = useCallback(
    async (captures: Capture[]) => {
      if (!page) return;
      // Read again: they may have changed since shown (deleted in Settings, saved from another tab).
      await load(page);
      const shown = latest.current.baselines;
      const known = shown?.page === page ? shown.snapshots : [];
      const byKey: Record<string, VisualResult> = {};
      for (const { viewport, image } of captures) {
        const key = viewportKey(viewport);
        const baseline = known.find((snapshot) => snapshot.viewport === key);
        if (!baseline) {
          byKey[key] = { status: 'missing', viewport, capture: image, currentUrl: track(image) };
          continue;
        }
        try {
          const comparison = await compareImages(baseline.image, image);
          byKey[key] = {
            status: 'compared',
            viewport,
            capture: image,
            currentUrl: track(image),
            diffUrl: track(comparison.diff),
            ratio: comparison.ratio,
            regions: comparison.regions,
            width: comparison.width,
            height: comparison.height,
            resized: comparison.resized,
          };
        } catch (error) {
          console.warn('[Breakpointer] Comparing with the baseline failed.', error);
          byKey[key] = { status: 'failed', viewport };
        }
      }
      const previous = latest.current.results;
      const next = { page, byKey };
      latest.current = { ...latest.current, results: next };
      setResults(next);
      if (previous) for (const result of Object.values(previous.byKey)) releaseResult(result);
      return byKey;
    },
    [load, page, releaseResult, track],
  );

  /** Makes a comparison's capture the new baseline of its viewport. */
  const accept = useCallback(
    async (key: string) => {
      const result = results?.page === page ? results.byKey[key] : undefined;
      if (!result || result.status === 'failed') return null;
      await save([{ viewport: result.viewport, image: result.capture }]);
      return result.viewport.name;
    },
    [page, results, save],
  );

  const removePage = useCallback(async () => {
    if (!page) return;
    await deletePageSnapshots(page);
    const previous = latest.current.results;
    latest.current = { ...latest.current, results: null };
    setResults(null);
    if (previous) for (const result of Object.values(previous.byKey)) releaseResult(result);
    await load(page);
  }, [load, page, releaseResult]);

  return {
    page,
    baselines: baselines?.page === page ? baselines.items : [],
    results: results?.page === page ? results.byKey : {},
    save,
    compare,
    accept,
    removePage,
  };
}
