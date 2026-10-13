import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { previewWidths, storedSettings } from './helpers';

/**
 * Generates the Chrome Web Store screenshots (1280×800) and README images from
 * the real extension. Run with: npm run screenshots
 */
const OUT = resolve(import.meta.dirname, '../../brand/store/screenshots');
const SIZE = { width: 1280, height: 800 };
/** A reserved .example domain, served from the local demo page. */
const DEMO_URL = 'https://brightside.example/';

async function serveDemo(context: BrowserContext) {
  const body = await readFile(resolve(import.meta.dirname, 'fixtures/demo.html'), 'utf8');
  await context.route('https://brightside.example/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }),
  );
}

type Lang = 'en' | 'vi';

const TEXT = {
  en: { groups: /Groups/, addViewport: 'Add viewport', settings: 'Settings', mobileQa: /Mobile QA/ },
  vi: { groups: /Nhóm/, addViewport: 'Thêm viewport', settings: 'Cài đặt', mobileQa: /Kiểm thử điện thoại/ },
} as const;

async function seed(page: Page, viewerUrl: (p?: Record<string, string>) => string, settings: Record<string, unknown>) {
  await page.setViewportSize(SIZE);
  await page.goto(viewerUrl());
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  // The first run fits and saves the default workspace; let that land before seeding.
  await expect.poll(async () => Boolean(await storedSettings(page))).toBe(true);
  await page.evaluate((value) => chrome.storage.local.set({ 'breakpointer.settings': value }), settings);
}

async function show(page: Page, viewerUrl: (p?: Record<string, string>) => string, widths: number) {
  await serveDemo(page.context());
  await page.goto(viewerUrl({ url: DEMO_URL }));
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  await expect.poll(async () => (await previewWidths(page, 'brightside.example')).length).toBe(widths);
  // Let the demo pages and any toast settle.
  await page.waitForTimeout(1200);
}

for (const lang of ['en', 'vi'] as const satisfies Lang[]) {
  test.describe(`store screenshots (${lang})`, () => {
    test.beforeAll(async () => {
      await mkdir(resolve(OUT, lang), { recursive: true });
    });

    test('workspace', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, {
        version: 1,
        language: lang,
        theme: 'light',
        breakpoints: 'tailwind',
        viewports: [
          { id: 'p', name: lang === 'vi' ? 'Điện thoại' : 'Phone', width: 390, height: 844, zoom: 0.62 },
          { id: 't', name: lang === 'vi' ? 'Máy tính bảng' : 'Tablet', width: 768, height: 1024, zoom: 0.46 },
          { id: 'l', name: 'Laptop', width: 1440, height: 900, zoom: 0.33 },
        ],
      });
      await show(page, viewerUrl, 3);
      await page.screenshot({ path: resolve(OUT, lang, '1-workspace.png') });
    });

    test('groups', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, { version: 1, language: lang, theme: 'light', breakpoints: 'tailwind' });
      await show(page, viewerUrl, 3);
      await page.getByRole('button', { name: TEXT[lang].groups }).click();
      await page.getByRole('menuitem', { name: TEXT[lang].mobileQa }).click();
      await expect.poll(async () => (await previewWidths(page, 'brightside.example')).length).toBe(5);
      await page.waitForTimeout(4500); // let the "Applied" toast time out
      await page.getByRole('button', { name: TEXT[lang].groups }).click();
      await page.screenshot({ path: resolve(OUT, lang, '2-groups.png') });
    });

    test('add viewport', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, { version: 1, language: lang, theme: 'light' });
      await show(page, viewerUrl, 3);
      await page.getByRole('button', { name: TEXT[lang].addViewport }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: resolve(OUT, lang, '3-add-viewport.png') });
    });

    test('dark theme with rulers', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, {
        version: 1,
        language: lang,
        theme: 'dark',
        layout: 'row',
        showRulers: true,
        breakpoints: 'bootstrap',
        viewports: [
          { id: 'a', name: 'sm · 576', width: 576, height: 960, zoom: 0.5 },
          { id: 'b', name: 'md · 768', width: 768, height: 960, zoom: 0.5 },
          { id: 'c', name: 'lg · 992', width: 992, height: 960, zoom: 0.5 },
        ],
      });
      await show(page, viewerUrl, 3);
      await page.screenshot({ path: resolve(OUT, lang, '4-dark-rulers.png') });
    });

    test('settings', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, { version: 1, language: lang, theme: 'light', rememberRecent: true });
      await show(page, viewerUrl, 3);
      await page.getByRole('button', { name: TEXT[lang].settings }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: resolve(OUT, lang, '5-settings.png') });
    });

    test('popup', async ({ context, extensionId }) => {
      const page = context.pages()[0]!;
      await page.setViewportSize({ width: 360, height: 560 });
      // As if opened from the toolbar on the demo site (activeTab).
      await page.addInitScript((url) => {
        chrome.tabs.query = (async () => [{ url }]) as unknown as typeof chrome.tabs.query;
      }, DEMO_URL);
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await page.evaluate(
        (language) =>
          chrome.storage.local.set({
            'breakpointer.settings': {
              version: 1,
              language,
              rememberRecent: true,
              recentUrls: ['https://brightside.example/pricing', 'https://docs.brightside.example/'],
            },
          }),
        lang,
      );
      await page.reload();
      await page.waitForTimeout(300);
      const popup = page.locator('#root > div');
      await popup.screenshot({ path: resolve(OUT, lang, 'popup.png') });
    });
  });
}
