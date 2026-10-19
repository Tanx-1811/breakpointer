import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { previewWidths } from './helpers';

/**
 * Records a short product demo from the real extension: frames are screenshots
 * taken while a script uses the workspace, put together with ffmpeg into
 * brand/social/demo.mp4 (and a lighter demo.gif). Run with: npm run demo-video
 */
const OUT = resolve(import.meta.dirname, '../../brand/social');
const FRAMES = resolve(import.meta.dirname, '../../test-results/demo-frames');
const SIZE = { width: 1280, height: 800 };
const DEMO_URL = 'https://brightside.example/';

async function serveSite(context: BrowserContext) {
  const demo = await readFile(resolve(import.meta.dirname, 'fixtures/demo.html'), 'utf8');
  const bugs: Record<string, string> = {
    '/': '.board { min-width: 520px; }',
    '/pricing': '.board { min-width: 520px; }',
    '/blog': '.hero p { font-size: 10px; }',
  };
  await context.route('https://brightside.example/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/careers')
      return route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: '<h1>Not found</h1>' });
    const style = bugs[path];
    const body = style ? demo.replace('</head>', `<style>${style}</style></head>`) : demo;
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
  });
}

/** A visible pointer and the keys pressed, drawn over the workspace (screenshots show neither). */
async function addOverlay(page: Page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; width: 22px; height: 22px; pointer-events: none;
        transform: translate(-3px, -2px); transition: left 0.18s ease, top 0.18s ease; }
      #demo-key { position: fixed; left: 50%; bottom: 120px; z-index: 2147483647; transform: translateX(-50%);
        padding: 10px 18px; border-radius: 12px; background: rgb(18 22 32 / 88%); color: #fff;
        font: 700 22px ui-sans-serif, system-ui, sans-serif; pointer-events: none; opacity: 0; transition: opacity 0.2s; }
      #demo-key[data-on] { opacity: 1; }`;
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.5-3.5-6.8L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const key = document.createElement('div');
    key.id = 'demo-key';
    // In the top layer's reach: dialogs are modal, so the overlay moves into the open dialog when there is one.
    document.head.append(style);
    document.body.append(cursor, key);
    const host = () => document.querySelector('dialog[open]') ?? document.body;
    new MutationObserver(() => {
      const target = host();
      if (cursor.parentElement !== target) target.append(cursor, key);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  });
}

async function pointTo(page: Page, x: number, y: number) {
  await page.evaluate(
    ([left, top]) => {
      const cursor = document.getElementById('demo-cursor');
      if (cursor) Object.assign(cursor.style, { left: `${left}px`, top: `${top}px` });
    },
    [x, y],
  );
  await page.mouse.move(x, y, { steps: 6 });
  await page.waitForTimeout(250);
}

async function clickOn(page: Page, locator: ReturnType<Page['locator']>) {
  const box = (await locator.boundingBox())!;
  await pointTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await locator.click();
}

async function pressKey(page: Page, key: string) {
  await page.evaluate((label) => {
    const element = document.getElementById('demo-key');
    if (!element) return;
    element.textContent = label;
    element.setAttribute('data-on', '');
    setTimeout(() => element.removeAttribute('data-on'), 900);
  }, key.toUpperCase());
  await page.waitForTimeout(350);
  await page.keyboard.press(key);
}

test('demo video', async ({ context, viewerUrl }) => {
  test.setTimeout(240_000);
  const page = context.pages()[0]!;
  await page.setViewportSize(SIZE);
  await page.goto(viewerUrl());
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await page.evaluate(() =>
    chrome.storage.local.set({
      'breakpointer.settings': {
        version: 1,
        language: 'en',
        theme: 'light',
        breakpoints: 'tailwind',
        disabledChecks: ['low-contrast'],
      },
    }),
  );
  await serveSite(context);
  await page.goto(viewerUrl({ url: DEMO_URL }));
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await expect.poll(async () => (await previewWidths(page, 'brightside.example')).length).toBe(3);
  await expect(page.getByTestId('checks-badge')).toHaveCount(3);
  await page.waitForTimeout(1500);
  await addOverlay(page);
  await pointTo(page, 640, 400);

  // Frames, taken as fast as screenshots allow, with the time each was taken.
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });
  const frames: { file: string; at: number }[] = [];
  let recording = true;
  const recorder = (async () => {
    for (let index = 0; recording; index++) {
      const file = resolve(FRAMES, `${String(index).padStart(5, '0')}.png`);
      const at = Date.now();
      await page.screenshot({ path: file });
      frames.push({ file, at });
    }
  })();

  // 1. Three sizes side by side; the phone has an issue.
  await page.waitForTimeout(1800);

  // 2. Scan every width: where the overflow starts and stops, to the pixel.
  await pressKey(page, 'w');
  const scan = page.getByRole('dialog', { name: 'Scan every width' });
  await scan.getByRole('spinbutton', { name: 'To' }).fill('1280');
  await clickOn(page, scan.getByTestId('scan-start'));
  await expect(scan.getByTestId('scan-status')).toContainText('widths checked', { timeout: 60_000 });
  const range = scan.locator('[data-testid="scan-finding"] button').first();
  await clickOn(page, range);
  await page.waitForTimeout(1800);
  await pressKey(page, 'Escape');

  // 3. Check pages: the whole site at every size.
  await pressKey(page, 'b');
  const batch = page.getByRole('dialog', { name: 'Check pages' });
  const pages = ['', 'pricing', 'templates', 'blog', 'about', 'careers'].map((path) => `${DEMO_URL}${path}`);
  await batch.getByTestId('batch-list').fill(pages.join('\n'));
  await page.waitForTimeout(500);
  await clickOn(page, batch.getByTestId('batch-start'));
  await expect(batch.getByTestId('batch-row')).toHaveCount(pages.length);
  await expect(
    batch.locator(
      '[data-testid="batch-row"][data-status="pending"], [data-testid="batch-row"][data-status="checking"]',
    ),
  ).toHaveCount(0, { timeout: 60_000 });
  await clickOn(page, batch.locator('[data-state="issues"]').first());
  await page.waitForTimeout(1800);
  await pressKey(page, 'Escape');

  // 4. A showcase image to share.
  await clickOn(page, page.getByRole('banner').getByRole('button', { name: 'Screenshots' }));
  await clickOn(page, page.getByRole('menuitem', { name: /^Showcase image/ }));
  const showcase = page.getByRole('dialog', { name: 'Showcase image' });
  await expect(showcase.getByTestId('showcase-image')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await clickOn(page, showcase.getByRole('radio', { name: 'Dark', exact: true }));
  await expect(showcase.getByTestId('showcase-stage')).not.toHaveAttribute('aria-busy');
  await page.waitForTimeout(2200);

  recording = false;
  await recorder;
  expect(frames.length).toBeGreaterThan(50);

  // ffmpeg: every frame lasts until the next one was taken, so the video runs in real time.
  const list = frames
    .map((frame, index) => {
      const next = frames[index + 1]?.at ?? frame.at + 1000;
      return `file '${frame.file}'\nduration ${((next - frame.at) / 1000).toFixed(3)}`;
    })
    .join('\n');
  const listFile = resolve(FRAMES, 'frames.txt');
  await writeFile(listFile, `${list}\nfile '${frames.at(-1)!.file}'\n`);
  await mkdir(OUT, { recursive: true });
  const mp4 = resolve(OUT, 'demo.mp4');
  const gif = resolve(OUT, 'demo.gif');
  const ffmpeg = (args: string[]) =>
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  ffmpeg([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-vf',
    'fps=30,format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    mp4,
  ]);
  ffmpeg([
    '-i',
    mp4,
    '-vf',
    'fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    gif,
  ]);
  console.log(`demo.mp4 ${(await stat(mp4)).size} bytes, demo.gif ${(await stat(gif)).size} bytes`);
});
