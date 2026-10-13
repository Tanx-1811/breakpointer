import { useEffect, useSyncExternalStore } from 'react';
import type { ThemePreference } from '../types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Applies the theme to <html data-theme> and returns the resolved value. */
export function useTheme(preference: ThemePreference): 'light' | 'dark' {
  const prefersDark = useSyncExternalStore(subscribe, systemPrefersDark, () => false);
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  return resolved;
}
