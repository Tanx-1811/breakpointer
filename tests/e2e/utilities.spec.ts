import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  agentsReady,
  card,
  clickInFrame,
  frameAt,
  framesShow,
  openTools,
  previewWidths,
  storedSettings,
} from './helpers';

/** A 1×1 PNG, enough to stand in for a design mockup. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

async function openSimulate(page: Page) {
  await page.getByRole('button', { name: 'Simulate' }).click();
  return page.getByRole('menu', { name: 'Simulate' });
}

test.describe('utilities', () => {
  test('vision simulations filter every preview, and Esc turns them off', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
    const filters = () =>
      page.getByTestId('preview-frame').evaluateAll((frames) => frames.map((frame) => getComputedStyle(frame).filter));
    expect(await filters()).toEqual(['none', 'none', 'none']);

    const menu = await openSimulate(page);
    await menu.getByRole('menuitemradio', { name: 'No green (deuteranopia)' }).click();
    await expect.poll(filters).toEqual(Array(3).fill('url("#bp-vision-deuteranopia")'));
    await expect(page.getByTestId('vision-status')).toContainText('No green (deuteranopia)');

    await (await openSimulate(page)).getByRole('menuitemradio', { name: 'Blurred vision' }).click();
    await expect.poll(filters).toEqual(Array(3).fill('blur(2.5px)'));
    await page.locator('body').press('Escape');
    await expect.poll(filters).toEqual(['none', 'none', 'none']);
    await expect(page.getByTestId('vision-status')).toHaveCount(0);
  });

  test('measuring reads out page pixels whatever the zoom', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
    await page.keyboard.press('x');
    await expect(page.getByTestId('measure-status')).toBeVisible();
    await expect(page.getByTestId('measure-toggle')).toHaveAttribute('aria-pressed', 'true');

    const overlay = card(page, 'Phone').getByTestId('measure-overlay');
    const box = (await overlay.boundingBox())!;
    const zoom = box.width / 375;
    await page.mouse.move(box.x + 12, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 12 + 100 * zoom, box.y + 20 + 50 * zoom, { steps: 5 });
    await page.mouse.up();
    const [width, height] = (await card(page, 'Phone').getByTestId('measure-size').textContent())!
      .split(' × ')
      .map(Number);
    expect(Math.abs(width! - 100)).toBeLessThanOrEqual(1);
    expect(Math.abs(height! - 50)).toBeLessThanOrEqual(1);

    // Picking an element turns measuring off; Esc does too.
    await page.keyboard.press('i');
    await expect(page.getByTestId('measure-overlay')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('x');
    await expect(page.getByTestId('measure-overlay')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('measure-overlay')).toHaveCount(0);
    await expect(page.getByTestId('measure-status')).toHaveCount(0);
  });

  test('the contrast checker grades colours against WCAG', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.keyboard.press('c');
    const dialog = page.getByRole('dialog', { name: 'Colour contrast' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Text', exact: true }).fill('#767676');
    await dialog.getByRole('textbox', { name: 'Background', exact: true }).fill('rgb(255, 255, 255)');
    await expect(dialog.getByTestId('contrast-ratio')).toHaveText('4.54 : 1');
    await expect(dialog.getByTestId('contrast-aaNormal')).toContainText('Pass');
    await expect(dialog.getByTestId('contrast-aaaNormal')).toContainText('Fail');
    // Chrome has an eyedropper.
    await expect(dialog.getByRole('button', { name: 'Pick the text colour from the screen' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Swap colours' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Text', exact: true })).toHaveValue('rgb(255, 255, 255)');
    await page.keyboard.press('Escape');
    // The colours are kept for the session.
    await page.keyboard.press('c');
    await expect(dialog.getByRole('textbox', { name: 'Background', exact: true })).toHaveValue('#767676');
  });

  test('stress tests lengthen text and turn the page right to left, then put it back', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/utilities') });
    await agentsReady(page, '/utilities');
    const phone = await frameAt(page, '/utilities', 375);
    const read = () =>
      phone.evaluate(() => ({
        label: document.querySelector('#label')!.textContent,
        placeholder: document.querySelector('#field')!.getAttribute('placeholder'),
        code: document.querySelector('#code')!.textContent,
        dir: document.documentElement.getAttribute('dir'),
      }));
    const original = await read();
    expect(original).toEqual({
      label: 'Sign in to continue',
      placeholder: 'Search products',
      code: 'const keep = true;',
      dir: null,
    });

    const menu = await openSimulate(page);
    await menu.getByRole('menuitemcheckbox', { name: /^Longer text/ }).click();
    await menu.getByRole('menuitemcheckbox', { name: /^Right to left/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(read).toMatchObject({ dir: 'rtl', code: 'const keep = true;' });
    const stressed = await read();
    expect(stressed.label).toMatch(/^\[Š.+\]$/);
    expect(stressed.label!.length).toBeGreaterThanOrEqual(Math.ceil(original.label!.length * 1.4));
    expect(stressed.placeholder).toMatch(/^\[.+\]$/);
    // Text the page adds later is translated too.
    await phone.evaluate(() =>
      document.body.append(Object.assign(document.createElement('p'), { id: 'late', textContent: 'Added later' })),
    );
    await expect.poll(() => phone.evaluate(() => document.querySelector('#late')!.textContent)).toMatch(/^\[.+\]$/);
    await expect(page.locator('[data-simulate-trigger]')).toBeVisible();

    const again = await openSimulate(page);
    await again.getByRole('menuitemcheckbox', { name: /^Longer text/ }).click();
    await again.getByRole('menuitemcheckbox', { name: /^Right to left/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(read).toEqual(original);
    expect(await phone.evaluate(() => document.querySelector('#late')!.textContent)).toBe('Added later');
  });

  test('page preferences: reduced motion styles and paused animations', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/utilities') });
    await agentsReady(page, '/utilities');
    const state = async (width: number) =>
      (await frameAt(page, '/utilities', width)).evaluate(() => ({
        outline: getComputedStyle(document.querySelector('#motion')!).outlineColor,
        playState: getComputedStyle(document.querySelector('#spinner')!).animationPlayState,
      }));
    const before = await state(375);
    expect(before.outline).not.toBe('rgb(255, 0, 0)');
    expect(before.playState).toBe('running');

    const menu = await openSimulate(page);
    await menu.getByRole('menuitemcheckbox', { name: /^Prefer reduced motion/ }).click();
    await menu.getByRole('menuitemcheckbox', { name: /^Pause animations/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => state(375)).toEqual({ outline: 'rgb(255, 0, 0)', playState: 'paused' });

    // A preview that loads afterwards gets them too.
    await card(page, 'Tablet').getByRole('button', { name: 'Reload Tablet' }).click();
    await expect.poll(() => state(768).catch(() => null)).toEqual({ outline: 'rgb(255, 0, 0)', playState: 'paused' });

    const again = await openSimulate(page);
    await again.getByRole('menuitemcheckbox', { name: /^Prefer reduced motion/ }).click();
    await again.getByRole('menuitemcheckbox', { name: /^Pause animations/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => state(375)).toEqual(before);
  });

  test('text spacing, more contrast and print styles apply to every preview and go away', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/utilities') });
    await agentsReady(page, '/utilities');
    const state = async () =>
      (await frameAt(page, '/utilities', 375)).evaluate(() => ({
        letterSpacing: getComputedStyle(document.querySelector('#label')!).letterSpacing,
        color: getComputedStyle(document.querySelector('#motion')!).color,
        code: getComputedStyle(document.querySelector('#code')!).display,
        labelStyle: getComputedStyle(document.querySelector('#label')!).fontStyle,
      }));
    const before = await state();
    expect(before.code).not.toBe('none');
    expect(before.labelStyle).toBe('italic');

    const menu = await openSimulate(page);
    await menu.getByRole('menuitemcheckbox', { name: /^Text spacing/ }).click();
    await menu.getByRole('menuitemcheckbox', { name: /^Prefer more contrast/ }).click();
    await menu.getByRole('menuitemcheckbox', { name: /^Print styles/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(state).toEqual({
      // 0.12em of 16px.
      letterSpacing: '1.92px',
      color: 'rgb(0, 0, 255)',
      code: 'none',
      labelStyle: 'normal',
    });

    const again = await openSimulate(page);
    await again.getByRole('menuitemcheckbox', { name: /^Text spacing/ }).click();
    await again.getByRole('menuitemcheckbox', { name: /^Prefer more contrast/ }).click();
    await again.getByRole('menuitemcheckbox', { name: /^Print styles/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(state).toEqual(before);
  });

  test('image sizes and tab order are labelled in the page', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/utilities') });
    await agentsReady(page, '/utilities');
    const labels = async () =>
      (await frameAt(page, '/utilities', 1366)).evaluate(
        () => document.querySelector('[data-breakpointer-overlay][data-labels]')?.getAttribute('data-labels') ?? null,
      );
    const tools = await openTools(page);
    await tools.getByRole('menuitemcheckbox', { name: /^Tab order/ }).click();
    await page.keyboard.press('Escape');
    // The field, two links and the button.
    await expect.poll(labels).toBe('4');
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: /^Tab order/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(labels).toBeNull();

    // An image shown at 180px from a 1px file.
    await page.getByTestId('address-input').fill(server.url('/cover'));
    await page.keyboard.press('Enter');
    await agentsReady(page, '/cover');
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: /^Image sizes/ }).click();
    await page.keyboard.press('Escape');
    await expect
      .poll(async () =>
        (await frameAt(page, '/cover', 1366)).evaluate(
          () => document.querySelector('[data-breakpointer-overlay][data-labels]')?.getAttribute('data-labels') ?? null,
        ),
      )
      .toBe('1');
  });

  test('a full-page screenshot captures the whole page of a preview', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const phone = await frameAt(page, '/long', 375);
    const scrollHeight = await phone.evaluate(() => document.documentElement.scrollHeight);

    const download = page.waitForEvent('download');
    await card(page, 'Phone').getByRole('button', { name: 'More actions for Phone' }).click();
    await page.getByRole('menuitem', { name: 'Full-page screenshot' }).click();
    const file = await (await download).path();
    const png = await readFile(file);
    // PNG header: width and height of the image.
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    // As tall as the page relative to its width (captured at the preview's zoom and the screen's density).
    expect(height / width).toBeCloseTo(scrollHeight / 375, 1);
    // The preview is back where it was, with the others.
    await expect(page.getByTestId('focus-status')).toHaveCount(0);
    expect(await phone.evaluate(() => window.scrollY)).toBe(0);
  });

  test('checks flag blurry images and fixed elements covering the screen', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/cover') });
    const phoneBadge = card(page, 'Phone').getByTestId('checks-badge');
    await expect(phoneBadge).toHaveAccessibleName('Responsive checks: 2 issues found');
    // On desktop only the image counts (covering the screen is checked up to 1024px).
    await expect(card(page, 'Laptop').getByTestId('checks-badge')).toHaveAccessibleName(
      'Responsive checks: 1 issue found',
    );

    await phoneBadge.click();
    const panel = page.getByRole('dialog', { name: 'Responsive checks · 375px' });
    await expect(panel).toContainText('Images shown larger than their real size');
    await expect(panel).toContainText('img#photo');
    await expect(panel).toContainText('1px → 180px');
    await expect(panel).toContainText('Fixed elements cover much of the screen');
    await expect(panel).toContainText(/Fixed or sticky elements cover \d+% of the screen\./);
    await expect(panel).toContainText('div#cookies');

    const phone = await frameAt(page, '/cover', 375);
    await panel.getByRole('button', { name: 'Highlight' }).nth(1).click();
    await expect
      .poll(() => phone.evaluate(() => document.querySelector('#cookies')!.hasAttribute('data-bp-issue')))
      .toBe(true);
  });

  test('a design overlay lies over a preview and follows its scroll', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const phoneCard = card(page, 'Phone');
    const chooser = page.waitForEvent('filechooser');
    await phoneCard.getByRole('button', { name: 'More actions for Phone' }).click();
    await page.getByRole('menuitem', { name: 'Overlay a design…' }).click();
    await (await chooser).setFiles({ name: 'design.png', mimeType: 'image/png', buffer: PNG });

    const image = phoneCard.getByTestId('design-overlay');
    await expect(image).toBeVisible();
    await expect(image).toHaveCSS('opacity', '0.5');
    // The other previews have none.
    await expect(page.getByTestId('design-overlay')).toHaveCount(1);

    const phone = await frameAt(page, '/long', 375);
    await phone.evaluate(() => window.scrollTo(0, 400));
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLElement).style.transform))
      .toMatch(/^translateY\(-\d+(\.\d+)?px\)$/);

    const controls = phoneCard.getByRole('group', { name: 'Design overlay of Phone' });
    await controls.getByRole('slider', { name: 'Overlay opacity' }).fill('0.8');
    await expect(image).toHaveCSS('opacity', '0.8');
    await controls.getByRole('button', { name: 'Show differences' }).click();
    await expect(image).toHaveCSS('mix-blend-mode', 'difference');
    await controls.getByRole('button', { name: 'Remove the overlay' }).click();
    await expect(page.getByTestId('design-overlay')).toHaveCount(0);
  });

  test('comparing two addresses: B previews follow A, swap and stop', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const other = server.origin.replace('127.0.0.1', 'localhost');
    const otherHost = new URL(other).host;

    await (await openTools(page)).getByRole('menuitem', { name: 'Compare with another address…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Compare two addresses' });
    await dialog.getByRole('textbox', { name: 'Address to compare' }).fill(other);
    await dialog.getByRole('button', { name: 'Compare' }).click();

    const banner = page.getByTestId('compare-banner');
    await expect(banner).toContainText(`B previews show the same page on ${otherHost}.`);
    await expect(page.getByTestId('viewport-card')).toHaveCount(6);
    await expect(page.getByRole('region', { name: 'Phone (B), 375 by 667 pixels' })).toBeVisible();
    await expect.poll(() => previewWidths(page, `${otherHost}/long`)).toEqual([375, 768, 1366]);
    await expect.poll(() => previewWidths(page, server.url('/long'))).toEqual([375, 768, 1366]);

    // Following a link in A takes B to the same page on its own site.
    await agentsReady(page, '/long', 6);
    await clickInFrame(
      page,
      await frameAt(page, server.url('/long'), 375),
      '#next',
      framesShow(page, `${otherHost}/linked`),
    );
    await expect.poll(() => previewWidths(page, `${otherHost}/linked`)).toEqual([375, 768, 1366]);
    await expect.poll(() => previewWidths(page, server.url('/linked'))).toEqual([375, 768, 1366]);
    await expect(page.getByRole('button', { name: /Navigated away/ })).toHaveCount(0);

    // Swap: B's site becomes the workspace's page, A's the comparison.
    await banner.getByRole('button', { name: 'Swap A and B' }).click();
    await expect(page.getByTestId('address-input')).toHaveValue(`${other}/linked`);
    await expect(banner).toContainText(`B previews show the same page on ${new URL(server.origin).host}.`);

    await banner.getByRole('button', { name: 'Stop comparing' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
    await expect(banner).toHaveCount(0);
  });

  test('live CSS snippets: saved, applied from the palette, deleted with undo', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/utilities') });
    await agentsReady(page, '/utilities');
    await (await openTools(page)).getByRole('menuitem', { name: 'Live CSS…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Live CSS' });
    await dialog.getByRole('textbox', { name: 'CSS' }).fill('#label { color: rgb(0, 128, 0); }');
    await dialog.getByRole('textbox', { name: 'Snippet name' }).fill('Green label');
    await dialog.getByRole('button', { name: 'Save as snippet' }).click();
    await expect(dialog.getByTestId('css-snippet')).toHaveCount(1);
    await expect
      .poll(async () => (await storedSettings(page))?.cssSnippets)
      .toEqual([expect.objectContaining({ name: 'Green label', css: '#label { color: rgb(0, 128, 0); }' })]);
    await page.keyboard.press('Escape');

    // One command applies it to every preview.
    await page.keyboard.press('Control+k');
    const palette = page.getByTestId('command-palette');
    await palette.getByRole('combobox').fill('green label');
    await expect(palette.getByRole('option').first()).toContainText('Apply CSS snippet “Green label”');
    await page.keyboard.press('Enter');
    const color = async (width: number) =>
      (await frameAt(page, '/utilities', width)).evaluate(
        () => getComputedStyle(document.querySelector('#label')!).color,
      );
    await expect.poll(() => color(375)).toBe('rgb(0, 128, 0)');
    await expect.poll(() => color(1366)).toBe('rgb(0, 128, 0)');

    await (await openTools(page)).getByRole('menuitem', { name: 'Live CSS…' }).click();
    await dialog.getByRole('button', { name: 'Delete Green label' }).click();
    await expect(dialog.getByTestId('css-snippet')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(dialog.getByTestId('css-snippet')).toHaveCount(1);
  });

  test('[ and ] step through the viewports, 0 zooms to 100%, O toggles outlines', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
    const status = page.getByTestId('focus-status');
    await page.keyboard.press(']');
    await expect(status).toContainText('Phone');
    await page.keyboard.press(']');
    await expect(status).toContainText('Tablet');
    await page.keyboard.press('[');
    await expect(status).toContainText('Phone');
    // It wraps around.
    await page.keyboard.press('[');
    await expect(status).toContainText('Laptop');
    await page.keyboard.press('Escape');
    await expect(status).toHaveCount(0);

    await page.keyboard.press('0');
    await expect(page.getByRole('combobox', { name: 'Zoom', exact: true })).toHaveValue('1');

    await page.keyboard.press('o');
    const menu = await openTools(page);
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Layout outlines' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`new menus and dialogs pass axe in the ${theme} theme`, async ({ openViewer, server }) => {
      const page = await openViewer({ url: server.url('/demo') });
      // "T" switches light ↔ dark (the test browser's system theme is light).
      await page.keyboard.press('t');
      if (theme === 'light') await page.keyboard.press('t');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.waitForTimeout(400);

      await openSimulate(page);
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      await page.locator('body').press('c');
      await expect(page.getByRole('dialog', { name: 'Colour contrast' })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      await (await openTools(page)).getByRole('menuitem', { name: 'Compare with another address…' }).click();
      await expect(page.getByRole('dialog', { name: 'Compare two addresses' })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      await page.locator('body').press('x');
      await expect(page.getByTestId('measure-status')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
    });
  }
});
