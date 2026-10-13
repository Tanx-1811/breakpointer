import { useEffect, useReducer, useRef } from 'react';
import { saveSettings } from '../services/storage';
import { settingsReducer } from '../state/settings-reducer';
import type { ViewportLabSettings } from '../types';

const SAVE_DELAY_MS = 250;

/**
 * Settings state that is written to chrome.storage.local shortly after each
 * change, and immediately when the page is hidden or closed.
 */
export function usePersistentSettings(initial: ViewportLabSettings) {
  const [settings, dispatch] = useReducer(settingsReducer, initial);
  const pending = useRef<ViewportLabSettings | null>(null);

  useEffect(() => {
    if (settings === initial) return;
    pending.current = settings;
    const timer = setTimeout(() => {
      pending.current = null;
      void saveSettings(settings).catch((error) => console.warn('[ViewportLab] Could not save settings.', error));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, initial]);

  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      void saveSettings(pending.current).catch(() => {});
      pending.current = null;
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  return [settings, dispatch] as const;
}
