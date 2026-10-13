import { useEffect, useReducer, useRef } from 'react';
import { onStoredSettingsChanged, parseSettings, saveSettings } from '../services/storage';
import { settingsReducer } from '../state/settings-reducer';
import type { BreakpointerSettings } from '../types';

const SAVE_DELAY_MS = 250;

/**
 * Settings state that is written to chrome.storage.local shortly after each
 * change (and immediately when the page is hidden or closed), and that follows
 * changes saved by other open workspace tabs, so tabs don't overwrite each other.
 */
export function usePersistentSettings(initial: BreakpointerSettings) {
  const [settings, dispatch] = useReducer(settingsReducer, initial);
  /** JSON of what storage holds as far as this tab knows; avoids echo writes. */
  const stored = useRef(JSON.stringify(initial));
  const pending = useRef<BreakpointerSettings | null>(null);

  useEffect(() => {
    const json = JSON.stringify(settings);
    if (json === stored.current) return;
    pending.current = settings;
    const timer = setTimeout(() => {
      pending.current = null;
      stored.current = json;
      void saveSettings(settings).catch((error) => console.warn('[Breakpointer] Could not save settings.', error));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      stored.current = JSON.stringify(pending.current);
      void saveSettings(pending.current).catch(() => {});
      pending.current = null;
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  useEffect(
    () =>
      onStoredSettingsChanged((raw) => {
        // Our own write, or an unsaved local change that is about to win anyway.
        if (JSON.stringify(raw) === stored.current || pending.current) return;
        const next = parseSettings(raw);
        stored.current = JSON.stringify(next);
        dispatch({ type: 'replaceSettings', settings: next });
      }),
    [],
  );

  return [settings, dispatch] as const;
}
