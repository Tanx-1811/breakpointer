import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activateLicense,
  loadEntitlement,
  onLicenseChanged,
  removeLicense,
  startTrial,
  type VerifyResult,
} from '../services/license';
import { FREE_ENTITLEMENT, nextChange, type Entitlement } from '../state/license';

/** Timers further away than this are capped (setTimeout's limit is about 24.8 days). */
const MAX_WAIT_MS = 6 * 3_600_000;

/**
 * The plan of this browser (free, Pro trial or Pro licence), kept up to date
 * when it changes in another page of the extension and when a trial or a
 * licence ends while the workspace is open. Free until the stored licence has
 * been verified (`ready`).
 */
export function useEntitlement() {
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [ready, setReady] = useState(false);

  /** Reads and verifies the stored licence again (a later read wins over an earlier one). */
  const reads = useRef(0);
  const refresh = useCallback(() => {
    const read = ++reads.current;
    return loadEntitlement()
      .then((next) => {
        if (read === reads.current) setEntitlement(next);
      })
      .catch((error: unknown) => console.warn('[Breakpointer] Could not read the licence.', error))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    void refresh();
    const stop = onLicenseChanged(() => void refresh());
    // Coming back to the tab after a while: the trial or licence may have ended.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // The trial or a licence ending while the workspace stays open.
  useEffect(() => {
    const at = nextChange(entitlement, Date.now());
    if (at === null) return;
    const timer = setTimeout(() => void refresh(), Math.min(MAX_WAIT_MS, Math.max(1000, at - Date.now() + 1000)));
    return () => clearTimeout(timer);
  }, [entitlement, refresh]);

  const activate = useCallback(
    async (key: string): Promise<VerifyResult> => {
      const result = await activateLicense(key);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  const remove = useCallback(async () => {
    await removeLicense();
    await refresh();
  }, [refresh]);

  const trial = useCallback(async () => {
    const started = await startTrial();
    await refresh();
    return started;
  }, [refresh]);

  return { entitlement, ready, activate, remove, startTrial: trial };
}
