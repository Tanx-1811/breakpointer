import { readFile } from 'node:fs/promises';
import type { Frame } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  agentsReady,
  card,
  clickInFrame,
  frameAt,
  openTools,
  previewFrames,
  previewWidths,
  storedSettings,
} from './helpers';

const scrollRatio = (frame: Frame) =>
  frame.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.round((window.scrollY / max) * 100) / 100 : 0;
  });

test.describe('tools inside previews', () => {
  test('scrolling one preview scrolls the others', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const phone = await frameAt(page, '/long', 375);
    const desktop = await frameAt(page, '/long', 1366);

    await phone.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await expect.poll(() => scrollRatio(desktop)).toBeCloseTo(0.5, 1);

    // Off: the others stay where they are.
    const menu = await openTools(page);
    await menu.getByRole('menuitemcheckbox', { name: 'Sync scrolling' }).click();
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Sync scrolling' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.keyboard.press('Escape');
    await phone.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    expect(await scrollRatio(desktop)).toBeCloseTo(0.5, 1);
  });

  test('following a link in one preview opens it in all of them', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const tablet = await frameAt(page, '/long', 768);
    await clickInFrame(page, tablet, '#next');

    await expect(page.getByTestId('address-input')).toHaveValue(server.url('/linked'));
    await expect.poll(() => previewWidths(page, '/linked')).toEqual([375, 768, 1366]);
    expect(new URL(page.url()).searchParams.get('url')).toBe(server.url('/linked'));
    // Synced, so nothing is flagged as having navigated away.
    await expect(page.getByRole('button', { name: /Navigated away/ })).toHaveCount(0);

    // Hiding and showing the card that led doesn't send everyone back.
    await page.getByRole('button', { name: /^Tablet,/ }).click();
    await page.getByRole('button', { name: /^Tablet,/ }).click();
    await expect.poll(() => previewWidths(page, '/linked')).toEqual([375, 768, 1366]);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('address-input')).toHaveValue(server.url('/linked'));
    expect(await previewWidths(page, '/long')).toEqual([]);
  });

  test('one-time links and redirects by the page stay in their preview', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    // A sign-in callback (?code=…) is never loaded again in the other previews.
    await clickInFrame(page, await frameAt(page, '/long', 375), '#callback');
    await expect(card(page, 'Phone').getByRole('button', { name: /Navigated away/ })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await previewWidths(page, '/long')).toEqual([768, 1366]);
    await expect(page.getByTestId('address-input')).toHaveValue(server.url('/long'));

    // A script changing the page without a click isn't followed either.
    await (await frameAt(page, '/long', 768)).evaluate(() => location.assign('/linked'));
    await expect(card(page, 'Tablet').getByRole('button', { name: /Navigated away/ })).toBeVisible();
    await card(page, 'Tablet')
      .getByRole('button', { name: /Navigated away/ })
      .click();
    await expect.poll(() => previewWidths(page, '/long')).toEqual([768, 1366]);
    await expect(card(page, 'Tablet').getByRole('button', { name: /Navigated away/ })).toHaveCount(0);
  });

  test('responsive checks list and highlight the issues', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/issues') });
    const phoneBadge = card(page, 'Phone').getByTestId('checks-badge');
    await expect(phoneBadge).toHaveAccessibleName('Responsive checks: 4 issues found');
    // On desktop, only the overflow applies (the viewport tag, text size and touch targets are for small screens).
    await expect(card(page, 'Laptop').getByTestId('checks-badge')).toHaveAccessibleName(
      'Responsive checks: 1 issue found',
    );

    await phoneBadge.click();
    const panel = page.getByRole('dialog', { name: 'Responsive checks · 375px' });
    await expect(panel).toContainText('Content wider than the screen');
    await expect(panel).toContainText('The page scrolls sideways by');
    await expect(panel).toContainText('div.banner');
    await expect(panel).toContainText('No mobile viewport tag');
    await expect(panel).toContainText('Text smaller than 12px');
    await expect(panel).toContainText('Touch targets smaller than 24×24px');

    const phone = await frameAt(page, '/issues', 375);
    await panel.getByRole('button', { name: 'Highlight' }).first().click();
    await expect.poll(() => phone.evaluate(() => document.querySelectorAll('[data-bp-issue]').length)).toBe(1);
    await panel.getByRole('button', { name: 'Hide' }).click();
    await expect.poll(() => phone.evaluate(() => document.querySelectorAll('[data-bp-issue]').length)).toBe(0);
    await page.keyboard.press('Escape');

    // A fix applied with live CSS clears the overflow at once.
    const menu = await openTools(page);
    await menu.getByRole('menuitem', { name: 'Live CSS…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Live CSS' });
    await dialog.getByRole('textbox', { name: 'CSS' }).fill('.banner { width: auto; }');
    await dialog.getByRole('button', { name: 'Apply to previews' }).click();
    await expect(phoneBadge).toHaveAccessibleName('Responsive checks: 3 issues found');

    // Turning checks off removes the badges.
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: 'Responsive checks' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('checks-badge')).toHaveCount(0);
    await expect.poll(async () => (await storedSettings(page))?.checks).toBe(false);
  });

  test('sites that redirect narrow screens do not make previews bounce', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/bounce') });
    const where = async () => {
      const frames = page.frames().filter((frame) => frame.url().includes('/bounce'));
      const pairs = await Promise.all(
        frames.map(async (frame) => [
          await frame.evaluate(() => innerWidth).catch(() => 0),
          new URL(frame.url()).pathname,
        ]),
      );
      return pairs.sort((a, b) => Number(a[0]) - Number(b[0])).map((pair) => pair.join(' '));
    };
    // Each preview ends on the page meant for its width, and stays there.
    const settled = ['375 /bounce-narrow', '768 /bounce', '1366 /bounce'];
    await expect.poll(where, { timeout: 15_000 }).toEqual(settled);
    await page.waitForTimeout(2500);
    expect(await where()).toEqual(settled);
    await expect(page.getByTestId('address-input')).toHaveValue(server.url('/bounce'));
    await expect(card(page, 'Phone').getByRole('button', { name: /Navigated away/ })).toBeVisible();
  });

  test('pages that overwrite window.name still connect', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/renames') });
    await agentsReady(page, '/renames');
    const phone = await frameAt(page, '/renames', 375);
    expect(await phone.evaluate(() => window.name)).toBe('app-state');
    await expect(card(page, 'Phone').getByTestId('checks-badge')).toHaveAccessibleName(
      'Responsive checks: no issues found',
    );
    // The name survives into the next page too; the preview stays connected.
    await clickInFrame(page, phone, '#next');
    await expect.poll(() => previewWidths(page, '/linked')).toEqual([375, 768, 1366]);
    await expect(page.getByTestId('checks-badge')).toHaveCount(3);
  });

  test('Ctrl + wheel over a preview zooms the previews, not the workspace tab', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
    await zoom.selectOption('0.5');
    const box = (await (await (await frameAt(page, '/long', 375)).frameElement()).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await expect(zoom).toHaveValue('0.67');
    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1);
  });

  test('layout outlines and live CSS reach every preview, also after a reload', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    const color = (frame: Frame) => frame.evaluate(() => getComputedStyle(document.querySelector('h1')!).color);
    const outlined = (frame: Frame) => frame.evaluate(() => Boolean(document.getElementById('bp-outlines')));

    await (await openTools(page)).getByRole('menuitemcheckbox', { name: 'Layout outlines' }).click();
    await page.keyboard.press('Escape');
    for (const frame of previewFrames(page, '/responsive')) await expect.poll(() => outlined(frame)).toBe(true);

    await (await openTools(page)).getByRole('menuitem', { name: 'Live CSS…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Live CSS' });
    await dialog.getByRole('textbox', { name: 'CSS' }).fill('h1 { color: rgb(220, 38, 38); }');
    await dialog.getByRole('textbox', { name: 'CSS' }).press('Control+Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Live CSS applied to the previews')).toBeVisible();
    for (const frame of previewFrames(page, '/responsive'))
      await expect.poll(() => color(frame)).toBe('rgb(220, 38, 38)');

    // A reloaded preview gets the tools again.
    await card(page, 'Phone').getByRole('button', { name: 'Reload Phone' }).click();
    const phone = await frameAt(page, '/responsive', 375);
    await expect.poll(() => color(phone).catch(() => '')).toBe('rgb(220, 38, 38)');
    await expect.poll(() => outlined(phone).catch(() => false)).toBe(true);

    await (await openTools(page)).getByRole('menuitem', { name: 'Live CSS…' }).click();
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => color(phone)).not.toBe('rgb(220, 38, 38)');
  });
});

test.describe('workspace tools', () => {
  test('column grid over every preview', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    const grids = page.getByTestId('grid-overlay');
    await expect(grids).toHaveCount(3);
    expect(await grids.evaluateAll((items) => items.map((item) => item.getAttribute('data-columns')))).toEqual([
      '4',
      '8',
      '12',
    ]);
    await expect.poll(async () => (await storedSettings(page))?.grid).toMatchObject({ show: true });

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('combobox', { name: 'Columns' }).selectOption('6');
    await page.keyboard.press('Escape');
    expect(await grids.evaluateAll((items) => items.map((item) => item.getAttribute('data-columns')))).toEqual([
      '6',
      '6',
      '6',
    ]);
  });

  test('custom breakpoints label the viewports', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByRole('combobox', { name: 'Breakpoints' }).selectOption('custom');
    await expect(page.getByTestId('breakpoint-badge')).toHaveText(['base', 'md', 'xl']);

    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('spinbutton', { name: 'From (px) 1' }).fill('360');
    await settings.getByRole('textbox', { name: 'Name 1' }).fill('phone');
    await settings.getByRole('spinbutton', { name: 'From (px) 2' }).fill('');
    await expect(settings.getByRole('alert')).toContainText('Each breakpoint needs a name');
    await settings.getByRole('spinbutton', { name: 'From (px) 2' }).fill('700');
    await expect(settings.getByRole('alert')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('breakpoint-badge')).toHaveText(['phone', 'md', 'xl']);
    await expect
      .poll(async () => (await storedSettings(page))?.customBreakpoints)
      .toEqual([
        { name: 'phone', min: 360 },
        { name: 'md', min: 700 },
        { name: 'lg', min: 1024 },
        { name: 'xl', min: 1280 },
      ]);
  });

  test('test breakpoint edges, rotate all, and undo', async ({ openViewer }) => {
    const page = await openViewer();
    await (await openTools(page)).getByRole('menuitem', { name: 'Test breakpoint edges' }).click();
    const cards = page.getByTestId('viewport-card');
    await expect(cards).toHaveCount(8);
    await expect(page.getByText('Showing 8 viewports on both sides of each breakpoint')).toBeVisible();
    await expect(card(page, '< md · 767')).toBeVisible();
    await expect(card(page, 'md · 768')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(cards).toHaveCount(3);

    await (await openTools(page)).getByRole('menuitem', { name: 'Rotate all' }).click();
    await expect(page.getByText('Rotated 3 viewports')).toBeVisible();
    await expect(card(page, 'Phone')).toHaveAttribute('aria-label', 'Phone, 667 by 375 pixels');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(card(page, 'Phone')).toHaveAttribute('aria-label', 'Phone, 375 by 667 pixels');
  });

  test('save a page and open it again from Settings', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    const star = page.getByTestId('save-page');
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(star).toHaveAccessibleName('Save this page');
    await expect.poll(async () => (await storedSettings(page))?.savedPages).toEqual([server.url('/responsive')]);

    await page.getByTestId('address-input').fill(server.url('/demo'));
    await page.getByTestId('address-input').press('Enter');
    await expect(star).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Settings' }).click();
    const list = page.getByTestId('saved-pages');
    await list.getByRole('button', { name: `Open ${server.url('/responsive')}` }).click();
    await expect(page.getByTestId('address-input')).toHaveValue(server.url('/responsive'));
    await expect(star).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Settings' }).click();
    await list.getByRole('button', { name: `Remove ${server.url('/responsive')} from saved pages` }).click();
    await expect(page.getByText('No saved pages yet.')).toBeVisible();
  });

  test('export a report with a screenshot and the checks of every viewport', async ({
    openViewer,
    server,
  }, testInfo) => {
    const page = await openViewer({ url: server.url('/issues') });
    await expect(page.getByTestId('checks-badge')).toHaveCount(3);
    const download = page.waitForEvent('download', { timeout: 20_000 });
    await (await openTools(page)).getByRole('menuitem', { name: 'Export report…' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-report_127.0.0.1_\d{8}-\d{6}\.html$/);
    const path = testInfo.outputPath('report.html');
    await file.saveAs(path);
    const html = await readFile(path, 'utf8');
    expect(html).toContain('<h1>Page with issues</h1>');
    expect(html.match(/<img src="data:image\/jpeg;base64,/g)).toHaveLength(3);
    expect(html).toContain('Content wider than the screen');
    expect(html).not.toMatch(/<script/i);
    await expect(page.getByText(/Report saved/)).toBeVisible();
  });

  test('Ctrl + wheel zooms and Space + drag pans the workspace', async ({ openViewer }) => {
    const page = await openViewer();
    const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
    await zoom.selectOption('0.5');
    const workspace = page.getByTestId('workspace');
    const box = (await workspace.boundingBox())!;
    // Over the workspace background, not a preview.
    await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await expect(zoom).toHaveValue('0.67');

    // Wider than the screen in a row, so the workspace scrolls sideways.
    await zoom.selectOption('1');
    await page.getByRole('radio', { name: 'Row' }).click();
    await page.locator('body').click({ position: { x: box.x + box.width - 12, y: box.y + box.height - 12 } });
    const before = await workspace.evaluate((element) => element.scrollLeft);
    await page.keyboard.down('Space');
    await expect(page.getByTestId('pan-layer')).toBeVisible();
    await page.mouse.move(box.x + 600, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 300, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await expect(page.getByTestId('pan-layer')).toBeHidden();
    expect(await workspace.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 200);
  });
});
