import { useEffect, useSyncExternalStore } from 'react';
import type { AccentColor, ThemePreference } from '../types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function systemPrefersDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Applies the theme to <html data-theme> (and the accent to <html data-accent>) and returns the resolved theme. */
export function useTheme(preference: ThemePreference, accent: AccentColor = 'indigo'): 'light' | 'dark' {
  const prefersDark = useSyncExternalStore(subscribe, systemPrefersDark, () => false);
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  return resolved;
}
