import type { Frame, Page } from '@playwright/test';

/** Frames whose URL contains `path`, i.e. the previews of that page. */
export function previewFrames(page: Page, path: string): Frame[] {
  return page.frames().filter((frame) => frame !== page.mainFrame() && frame.url().includes(path));
}

/** The layout viewport width each preview of `path` reports, sorted. */
export async function previewWidths(page: Page, path: string): Promise<number[]> {
  const widths = await Promise.all(
    previewFrames(page, path).map((frame) => frame.evaluate(() => window.innerWidth).catch(() => -1)),
  );
  return widths.sort((a, b) => a - b);
}

export function card(page: Page, name: string) {
  return page.getByRole('region', { name: new RegExp(`^${name}, \\d+ by \\d+ pixels$`) });
}

export async function storedSettings(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(
    async () =>
      (await chrome.storage.local.get('breakpointer.settings'))['breakpointer.settings'] as Record<string, unknown>,
  );
}
