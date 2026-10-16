import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickInFrame, previewFrames, previewWidths, storedSettings } from './helpers';

/**
 * Generates the Chrome Web Store screenshots (1280×800) and README images from
 * the real extension. Run with: npm run screenshots
 */
const OUT = resolve(import.meta.dirname, '../../brand/store/screenshots');
const SIZE = { width: 1280, height: 800 };
/** A reserved .example domain, served from the local demo page. */
const DEMO_URL = 'https://brightside.example/';

/** `bug` adds a typical responsive bug: a board with a fixed minimum width. */
async function serveDemo(context: BrowserContext, bug = false) {
  let body = await readFile(resolve(import.meta.dirname, 'fixtures/demo.html'), 'utf8');
  if (bug) body = body.replace('</head>', '<style>.board { min-width: 520px; }</style></head>');
  await context.route('https://brightside.example/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }),
  );
}

type Lang = 'en' | 'vi';

const TEXT = {
  en: {
    groups: /Groups/,
    addViewport: 'Add viewport',
    mobileQa: /Mobile QA/,
    highlight: 'Highlight',
    scan: 'Scan every width',
    checked: 'widths checked',
    visual: 'Visual check',
    saved: /Baseline saved/,
    changed: /viewports changed/,
    view: /^View the comparison of/,
  },
  vi: {
    groups: /Nhóm/,
    addViewport: 'Thêm viewport',
    mobileQa: /Kiểm thử điện thoại/,
    highlight: 'Đánh dấu',
    scan: 'Quét mọi chiều rộng',
    checked: 'Đã kiểm tra',
    visual: 'Kiểm tra hình ảnh',
    saved: /Đã lưu ảnh mốc/,
    changed: /viewport thay đổi/,
    view: /^Xem so sánh của/,
  },
} as const;

async function seed(page: Page, viewerUrl: (p?: Record<string, string>) => string, settings: Record<string, unknown>) {
  await page.setViewportSize(SIZE);
  await page.goto(viewerUrl());
  await page.locator('html[data-ready]').waitFor({ state: 'attached' });
  // The first run fits and saves the default workspace; let that land before seeding.
  await expect.poll(async () => Boolean(await storedSettings(page))).toBe(true);
  await page.evaluate((value) => chrome.storage.local.set({ 'breakpointer.settings': value }), settings);
}

async function show(page: Page, viewerUrl: (p?: Record<string, string>) => string, widths: number, bug = false) {
  await serveDemo(page.context(), bug);
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

    test('responsive checks', async ({ context, viewerUrl }) => {
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
      await show(page, viewerUrl, 3, true);
      const badges = page.getByTestId('checks-badge');
      await expect(badges).toHaveCount(3);
      await badges.first().click();
      await page.getByRole('button', { name: TEXT[lang].highlight }).first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: resolve(OUT, lang, '5-checks.png') });
    });

    test('inspector', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, {
        version: 1,
        language: lang,
        theme: 'light',
        breakpoints: 'tailwind',
        viewports: [
          { id: 'p', name: lang === 'vi' ? 'Điện thoại' : 'Phone', width: 390, height: 844, zoom: 0.5 },
          { id: 't', name: lang === 'vi' ? 'Máy tính bảng' : 'Tablet', width: 768, height: 1024, zoom: 0.4 },
          { id: 'l', name: 'Laptop', width: 1280, height: 800, zoom: 0.33 },
        ],
      });
      await show(page, viewerUrl, 3);
      await expect(page.getByTestId('checks-badge')).toHaveCount(3);
      await page.keyboard.press('i');
      const phone = previewFrames(page, 'brightside.example').find((frame) => frame.url().includes('brightside'))!;
      let narrow = phone;
      for (const frame of previewFrames(page, 'brightside.example'))
        if ((await frame.evaluate(() => innerWidth)) === 390) narrow = frame;
      await clickInFrame(page, narrow, 'h1', async () => (await page.getByTestId('inspector-size').count()) === 3);
      await expect(page.getByTestId('inspector-size')).toHaveCount(3);
      await page.mouse.move(5, 795);
      await page.waitForTimeout(800);
      await page.screenshot({ path: resolve(OUT, lang, '6-inspector.png') });
    });

    test('command palette', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, { version: 1, language: lang, theme: 'dark', breakpoints: 'tailwind' });
      await show(page, viewerUrl, 3);
      await page.keyboard.press('Control+k');
      await page.keyboard.type(lang === 'vi' ? 'tablet' : 'tablet');
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(OUT, lang, '7-palette.png') });
    });

    test('drag to resize', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, {
        version: 1,
        language: lang,
        theme: 'light',
        breakpoints: 'tailwind',
        showRulers: true,
        viewports: [
          { id: 'p', name: lang === 'vi' ? 'Điện thoại' : 'Phone', width: 390, height: 760, zoom: 0.62 },
          { id: 't', name: lang === 'vi' ? 'Máy tính bảng' : 'Tablet', width: 700, height: 760, zoom: 0.62 },
        ],
      });
      await show(page, viewerUrl, 2);
      const tablet = page.getByTestId('viewport-card').nth(1);
      await tablet.hover();
      const handle = (await page.getByTestId('resize-width').nth(1).boundingBox())!;
      const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + (765 - 700) * 0.62, start.y, { steps: 6 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: resolve(OUT, lang, '8-resize.png') });
      await page.mouse.up();
    });

    test('width scanner', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, { version: 1, language: lang, theme: 'light', breakpoints: 'site' });
      await show(page, viewerUrl, 3, true);
      await expect(page.getByTestId('checks-badge')).toHaveCount(3);
      await page.keyboard.press('w');
      const dialog = page.getByRole('dialog', { name: TEXT[lang].scan });
      await dialog.getByRole('spinbutton').nth(1).fill('1440');
      await dialog.getByTestId('scan-start').click();
      await expect(dialog.getByTestId('scan-status')).toContainText(TEXT[lang].checked, { timeout: 60_000 });
      // Point at the narrowest widths, where the layout breaks.
      await dialog.getByRole('slider').fill('420');
      await page.mouse.move(5, 795);
      await page.waitForTimeout(800);
      await page.screenshot({ path: resolve(OUT, lang, '9-scan.png') });
    });

    test('audit', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, {
        version: 1,
        language: lang,
        theme: 'light',
        breakpoints: 'tailwind',
        viewports: [
          { id: 'p', name: lang === 'vi' ? 'Điện thoại' : 'Phone', width: 390, height: 844, zoom: 0.5 },
          { id: 't', name: lang === 'vi' ? 'Máy tính bảng' : 'Tablet', width: 768, height: 1024, zoom: 0.4 },
          { id: 'l', name: 'Laptop', width: 1280, height: 800, zoom: 0.33 },
        ],
      });
      await show(page, viewerUrl, 3, true);
      await expect(page.getByTestId('checks-badge')).toHaveCount(3);
      await page.keyboard.press('e');
      await expect(page.getByTestId('audit-group').first()).toBeVisible();
      await page.mouse.move(5, 795);
      await page.waitForTimeout(800);
      await page.screenshot({ path: resolve(OUT, lang, '10-audit.png') });
    });

    test('visual check', async ({ context, viewerUrl }) => {
      const page = context.pages()[0]!;
      await seed(page, viewerUrl, { version: 1, language: lang, theme: 'light', breakpoints: 'tailwind' });
      await show(page, viewerUrl, 3);
      await expect(page.getByTestId('checks-badge')).toHaveCount(3);
      await page.keyboard.press('v');
      const dialog = page.getByRole('dialog', { name: TEXT[lang].visual });
      await dialog.getByTestId('visual-save').click();
      await expect(page.getByText(TEXT[lang].saved)).toBeVisible({ timeout: 20_000 });
      // A change on the tablet: a longer heading.
      for (const frame of previewFrames(page, 'brightside.example'))
        if ((await frame.evaluate(() => innerWidth)) === 768)
          await frame.evaluate(() => {
            const heading = document.querySelector('h1');
            if (heading) heading.textContent = 'Plan your whole team’s week together — in one place, not in twelve tabs.';
          });
      await dialog.getByTestId('visual-compare').click();
      await expect(dialog.getByTestId('visual-summary')).toHaveText(TEXT[lang].changed, { timeout: 20_000 });
      await dialog.getByRole('button', { name: TEXT[lang].view }).nth(1).click();
      await page.waitForTimeout(4500); // let the toasts time out
      await page.screenshot({ path: resolve(OUT, lang, '11-visual.png') });
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
