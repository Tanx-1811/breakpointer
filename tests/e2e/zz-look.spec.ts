import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { previewWidths, storedSettings } from './helpers';

// Temporary: screenshots of the v0.9 workspace for a design review (not part of the suite).
const OUT = process.env.LOOK_OUT ?? '/tmp';
const DEMO_URL = 'https://brightside.example/pricing';

async function seed(page: Page, viewerUrl: (p?: Record<string, string>) => string, settings: Record<string, unknown>) {
  await page.goto(viewerUrl());
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await expect.poll(async () => Boolean(await storedSettings(page))).toBe(true);
  await page.evaluate((value) => chrome.storage.local.set({ 'breakpointer.settings': value }), settings);
  let body = await readFile(resolve(import.meta.dirname, 'fixtures/demo.html'), 'utf8');
  body = body.replace(
    '</head>',
    `<meta name="description" content="Start free for teams up to 5. Team plans add shared weekly boards, guest access and integrations with the tools your team already uses every day of the week." />
<meta property="og:title" content="Pricing — Brightside" />
<meta property="og:image" content="https://brightside.example/og.png" />
<link rel="canonical" href="https://brightside.example/pricing" />
<style>.board { min-width: 520px; }</style></head>`,
  );
  await page.context().route('https://brightside.example/**', (route) =>
    route.request().url().endsWith('og.png')
      ? route.fulfill({ status: 404 })
      : route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }),
  );
  await page.goto(viewerUrl({ url: DEMO_URL }));
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
}

const VIEWPORTS = [
  { id: 'p', name: 'Phone', width: 390, height: 844, zoom: 0.42 },
  { id: 't', name: 'Tablet', width: 768, height: 1024, zoom: 0.42 },
  { id: 'l', name: 'Laptop', width: 1440, height: 900, zoom: 0.42 },
  { id: 'd', name: 'Desktop', width: 1920, height: 1080, zoom: 0.42, hidden: true },
];

test('look: light workspace with sidebar', async ({ context, viewerUrl }) => {
  const page = context.pages()[0]!;
  await seed(page, viewerUrl, {
    version: 1,
    theme: 'light',
    breakpoints: 'tailwind',
    panels: { sidebar: true, statusBar: true, minimap: true },
    viewports: VIEWPORTS,
  });
  await expect.poll(async () => (await previewWidths(page, 'brightside.example')).length).toBe(3);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/look-1-light.png` });
  await page.keyboard.press('e');
  await page.getByRole('tab', { name: 'Meta' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/look-3-meta.png` });
});

test('look: dark graphite stack', async ({ context, viewerUrl }) => {
  const page = context.pages()[0]!;
  await seed(page, viewerUrl, {
    version: 1,
    theme: 'dark',
    accent: 'graphite',
    canvas: 'grid',
    layout: 'stack',
    breakpoints: 'bootstrap',
    panels: { sidebar: true, statusBar: true, minimap: true },
    viewports: VIEWPORTS.map((vp) => ({ ...vp, zoom: 0.5 })),
  });
  await expect.poll(async () => (await previewWidths(page, 'brightside.example')).length).toBe(3);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/look-2-dark.png` });
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/look-4-settings.png` });
});
