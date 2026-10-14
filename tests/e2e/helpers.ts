import { expect, type Frame, type Page } from '@playwright/test';

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
 *
 * Chrome can stop routing input to the previews when a frame moved just as its
 * page finished loading; the workspace refreshes the frames once it notices
 * input aimed at them (see src/state/stray-input.ts). So the pointer moves in
 * first, in a few steps like a real mouse, and when `until` is given, the click
 * is repeated (up to three times) until it holds.
 */
export async function clickInFrame(
  page: Page,
  frame: Frame,
  selector: string,
  until?: () => Promise<boolean> | boolean,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
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
    const x = box.x + point.x * zoom;
    const y = box.y + point.y * zoom;
    await page.mouse.move(x, y, { steps: 4 });
    await page.waitForTimeout(250);
    await page.mouse.click(x, y);
    if (!until) return;
    for (let wait = 0; wait < 15; wait++) {
      if (await until()) return;
      await page.waitForTimeout(100);
    }
  }
}

/** True once a preview shows an address containing `part`. */
export const framesShow = (page: Page, part: string) => () =>
  page.frames().some((frame) => frame !== page.mainFrame() && frame.url().includes(part));

export function card(page: Page, name: string) {
  return page.getByRole('region', { name: new RegExp(`^${name}, \\d+ by \\d+ pixels$`) });
}

export async function storedSettings(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(
    async () =>
      (await chrome.storage.local.get('breakpointer.settings'))['breakpointer.settings'] as Record<string, unknown>,
  );
}

/** The preview of `path` at a given layout width. */
export async function frameAt(page: Page, path: string, width: number): Promise<Frame> {
  await expect.poll(() => previewWidths(page, path)).toContain(width);
  for (const frame of previewFrames(page, path)) {
    if ((await frame.evaluate(() => window.innerWidth).catch(() => 0)) === width) return frame;
  }
  throw new Error(`No ${width}px preview of ${path}`);
}

/** Waits until the frame agent in every preview of `path` has started. */
export async function agentsReady(page: Page, path: string, count = 3) {
  await expect
    .poll(async () => {
      const frames = previewFrames(page, path);
      if (frames.length < count) return false;
      // The agent runs in an isolated world; its effects are visible in the DOM only once asked, so
      // wait for the checks it reports instead (they are on by default).
      return (await page.getByTestId('checks-badge').count()) === count;
    })
    .toBe(true);
}

export async function openTools(page: Page) {
  await page.getByRole('button', { name: 'Tools' }).click();
  return page.getByRole('menu', { name: 'Tools' });
}
