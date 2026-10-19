import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CheckKind } from '../agent/protocol';
import type { useFrameAgents } from '../hooks/useFrameAgents';
import {
  BATCH_CARD_ID,
  newRun,
  setCell,
  updatePage,
  type BatchCell,
  type BatchRun,
  type BatchSize,
} from '../state/batch';
import { withoutKinds } from '../state/checks';
import { pageOf } from '../state/follow';
import { shortHash } from '../utils/hash';
import { whenVisible } from '../utils/platform';

export type AgentApi = Pick<ReturnType<typeof useFrameAgents>, 'ask' | 'send' | 'frameOf'>;

/** What the Check pages preview shows: `load` changes with every page, so its frame is a new one. */
export type BatchFrame = { src: string; width: number; height: number; load: number };

export type BatchProgress = { page: number; pages: number; size: number; sizes: number };

/** The generation of the Check pages frame (it names the frame, so its agent's messages are told apart). */
export const batchGeneration = (frame: Pick<BatchFrame, 'src' | 'load'>) =>
  shortHash(`${frame.src}#batch#${frame.load}`);

/** How long a page may take to start (its agent says hello). */
const HELLO_TIMEOUT_MS = 15_000;
/** A page that loaded without its agent saying hello this soon after isn't one the agent runs in. */
const NO_AGENT_AFTER_LOAD_MS = 4000;
/** After it started, how long to wait for it to finish loading (images, fonts) before checking. */
const LOAD_TIMEOUT_MS = 10_000;
/** A moment for late layout (web fonts, lazy content) once it loaded. */
const SETTLE_MS = 600;
/** How long one size may take to answer. */
const PROBE_TIMEOUT_MS = 8000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check pages: each page of a list is loaded in one preview of its own (card
 * `~batch`, in the dialog) and checked at every size, by resizing that preview
 * as the width scanner does. The agents are read through a ref, as the hook
 * runs before the workspace connects them. The last run is kept for the session.
 */
export function useBatchCheck(agents: RefObject<AgentApi | null>, disabledChecks: readonly CheckKind[]) {
  const [frame, setFrame] = useState<BatchFrame | null>(null);
  const [run, setRun] = useState<BatchRun | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const stopped = useRef(false);
  // A run in progress (set at once, so a second click can't start another one).
  const active = useRef(false);
  const loads = useRef(0);
  // The load the frame finished last (its `load` event) and when, and who waits for one.
  const loaded = useRef(0);
  const loadedAt = useRef(0);
  const waiting = useRef<(() => void) | null>(null);
  const skip = useRef(disabledChecks);
  useEffect(() => {
    skip.current = disabledChecks;
  }, [disabledChecks]);

  const onFrameLoad = useCallback(() => {
    if (loaded.current !== loads.current) loadedAt.current = Date.now();
    loaded.current = loads.current;
    waiting.current?.();
  }, []);

  /** Resolves once `load` finished loading, or after `timeout` (false then). */
  const loadedOrTimeout = (load: number, timeout: number) =>
    new Promise<boolean>((resolve) => {
      if (loaded.current >= load) {
        resolve(true);
        return;
      }
      const timer = setTimeout(() => {
        waiting.current = null;
        resolve(false);
      }, timeout);
      waiting.current = () => {
        if (loaded.current < load) return;
        clearTimeout(timer);
        waiting.current = null;
        resolve(true);
      };
    });

  /**
   * The preview's agent once it said hello for this page (its frame's
   * generation: until the workspace renders the new frame, it still knows the
   * last one), or null after `timeout` — or soon after the page loaded without one.
   */
  const agentReady = async (frame: BatchFrame, timeout: number) => {
    const generation = batchGeneration(frame);
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (stopped.current) return null;
      const state = agents.current?.frameOf(BATCH_CARD_ID);
      if (state?.generation === generation) return state;
      if (loaded.current >= frame.load && Date.now() - loadedAt.current > NO_AGENT_AFTER_LOAD_MS) return null;
      await sleep(100);
    }
    return null;
  };

  /** Checks the page shown at one size: the preview is resized, its agent answers once it has that width. */
  const probe = async (size: BatchSize, scheme: { current: BatchSize['colorScheme'] }): Promise<BatchCell> => {
    setFrame((current) => current && { ...current, width: size.width, height: size.height });
    if (scheme.current !== size.colorScheme) {
      agents.current?.send(BATCH_CARD_ID, { type: 'colorScheme', scheme: size.colorScheme });
      scheme.current = size.colorScheme;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      // A hidden tab doesn't lay out its frames.
      await whenVisible();
      const reply = await agents.current
        ?.ask(BATCH_CARD_ID, { type: 'scanProbe', width: size.width }, 'scanned', PROBE_TIMEOUT_MS)
        .catch(() => null);
      if (!reply) continue;
      // Measured before the preview had that width (it took longer than the agent waits): ask again.
      if (reply.width !== size.width && attempt === 0) continue;
      return { status: 'checked', issues: withoutKinds(reply.report, skip.current)?.issues ?? [] };
    }
    return { status: 'failed' };
  };

  /**
   * Checks every page at every size. Pages in `unavailable` (sites Breakpointer
   * isn't allowed on: no agent would run there) are marked at once, not loaded.
   */
  const start = async (pages: string[], sizes: BatchSize[], unavailable: ReadonlySet<string> = new Set()) => {
    if (active.current || pages.length === 0 || sizes.length === 0) return;
    active.current = true;
    stopped.current = false;
    setRunning(true);
    let current = newRun(pages, sizes, Date.now());
    const commit = (next: BatchRun) => {
      current = next;
      setRun(next);
    };
    commit(current);
    try {
      for (const [index, url] of pages.entries()) {
        if (stopped.current) break;
        if (unavailable.has(url)) {
          commit(updatePage(current, index, { status: 'failed', failure: 'noAgent' }));
          continue;
        }
        setProgress({ page: index, pages: pages.length, size: 0, sizes: sizes.length });
        commit(updatePage(current, index, { status: 'checking' }));
        const load = ++loads.current;
        const next: BatchFrame = { src: url, width: sizes[0]!.width, height: sizes[0]!.height, load };
        setFrame(next);
        const state = await agentReady(next, HELLO_TIMEOUT_MS);
        if (stopped.current) {
          commit(updatePage(current, index, { status: 'pending' }));
          break;
        }
        if (!state) {
          // The page loaded but no agent runs there (a site not allowed, not a web page), or it didn't load.
          commit(
            updatePage(current, index, { status: 'failed', failure: loaded.current >= load ? 'noAgent' : 'timeout' }),
          );
          continue;
        }
        if (state.status >= 400) {
          commit(updatePage(current, index, { status: 'failed', failure: 'http', httpStatus: state.status }));
          continue;
        }
        await loadedOrTimeout(load, LOAD_TIMEOUT_MS);
        await sleep(SETTLE_MS);
        const scheme = { current: null as BatchSize['colorScheme'] };
        for (const [at, size] of sizes.entries()) {
          if (stopped.current) break;
          setProgress({ page: index, pages: pages.length, size: at, sizes: sizes.length });
          commit(setCell(current, index, at, await probe(size, scheme)));
        }
        // Where the page ended up (a redirect, e.g. to a sign-in page), once checked.
        const href = agents.current?.frameOf(BATCH_CARD_ID)?.href;
        const finalUrl = href && pageOf(href) !== pageOf(url) ? href : undefined;
        const done = current.pages[index]!.cells.every(Boolean);
        commit(updatePage(current, index, { status: done ? 'done' : 'pending', finalUrl }));
      }
      commit({ ...current, complete: !stopped.current && current.pages.every((page) => page.status !== 'pending') });
    } finally {
      active.current = false;
      waiting.current = null;
      setFrame(null);
      setProgress(null);
      setRunning(false);
    }
  };

  const stop = useCallback(() => {
    stopped.current = true;
  }, []);

  // Nothing keeps running once the workspace closes.
  useEffect(
    () => () => {
      stopped.current = true;
    },
    [],
  );

  return { frame, run, running, progress, start, stop, onFrameLoad };
}
