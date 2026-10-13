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

/** Card names in on-screen order (cards keep a stable DOM order; CSS `order` places them). */
export async function visualCardNames(page: Page): Promise<string[]> {
  const cards = await page.getByTestId('viewport-card').all();
  const items = await Promise.all(
    cards.map(async (card) => ({
      box: (await card.boundingBox())!,
      name: ((await card.getAttribute('aria-label')) ?? '').split(',')[0]!,
    })),
  );
  return items.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x).map((item) => item.name);
}

/**
 * A real (trusted) click on an element inside a preview. Playwright's own
 * locator click can't aim inside a scaled cross-origin frame, so the point is
 * mapped through the frame's zoom by hand.
 */
export async function clickInFrame(page: Page, frame: Frame, selector: string) {
  const iframe = await frame.frameElement();
  await iframe.scrollIntoViewIfNeeded();
  // The workspace may still be fitting its cards to the screen: wait until the frame holds still.
  let box = (await iframe.boundingBox())!;
  for (let tries = 0; tries < 20; tries += 1) {
    await page.waitForTimeout(100);
    const next = (await iframe.boundingBox())!;
    const still = ['x', 'y', 'width', 'height'].every(
      (key) => Math.abs(next[key as keyof typeof next] - box[key as keyof typeof box]) < 0.5,
    );
    box = next;
    if (still) break;
  }
  const point = await frame.evaluate((sel) => {
    const element = document.querySelector(sel)!;
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = element.getBoundingClientRect();
    return { x: rect.left + Math.min(rect.width / 2, 20), y: rect.top + rect.height / 2, width: innerWidth };
  }, selector);
  const zoom = box.width / point.width;
  await page.mouse.click(box.x + point.x * zoom, box.y + point.y * zoom);
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
