/** macOS shows ⌘ where other systems use Ctrl. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad/i.test(platform);
}

/** How to write "Ctrl/⌘ + key" on this system, e.g. "⌘K" or "Ctrl K". */
export function modShortcut(key: string): string {
  return isMac() ? `⌘${key}` : `Ctrl ${key}`;
}
