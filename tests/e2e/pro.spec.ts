import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Frame, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, clickInFrame, frameAt, openTools, previewFrames } from './helpers';
import { testLicense } from './license';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

/** Starts the free trial from the top bar's "Get Pro". */
async function startTrial(page: Page) {
  await page.getByTestId('pro-button').click();
  const dialog = page.getByRole('dialog', { name: 'Breakpointer Pro' });
  await dialog.getByTestId('start-trial').click();
  await expect(page.getByText('Your Pro trial has started: 7 days of every Pro feature.')).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('pro-button')).toHaveAccessibleName('Pro trial, 7 days left');
}

const text = (frame: Frame, selector: string) =>
  frame.evaluate((sel) => document.querySelector(sel)?.textContent, selector);

test.describe('Breakpointer Pro', () => {
  test('on the free plan, Pro features are marked and show what Pro brings', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/pro') });
    await agentsReady(page, '/pro');
    await expect(page.getByTestId('pro-button')).toHaveAccessibleName('Get Pro');

    // A Pro switch in the Tools menu.
    const tools = await openTools(page);
    const banners = tools.getByRole('menuitemcheckbox', { name: /Hide cookie banners/ });
    await expect(banners).toContainText('Pro');
    await expect(banners).toHaveAttribute('aria-checked', 'false');
    await banners.click();
    const dialog = page.getByRole('dialog', { name: 'Breakpointer Pro' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Hide cookie banners comes with Breakpointer Pro.');
    await expect(dialog.getByRole('listitem').first()).toContainText('Hide cookie banners');
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Nothing changed in the previews.
    const phone = await frameAt(page, '/pro', 375);
    expect(await phone.evaluate(() => getComputedStyle(document.getElementById('onetrust-banner-sdk')!).display)).toBe(
      'block',
    );

    // The accessibility checks aren't run; the audit says they come with Pro.
    await page.getByTestId('audit-toggle').click();
    const audit = page.getByTestId('audit');
    await expect(audit.getByTestId('audit-summary')).toBeVisible();
    await expect(audit.locator('[data-kind="missing-alt"]')).toHaveCount(0);
    await expect(audit.getByTestId('audit-pro-teaser')).toBeVisible();

    // Exports are marked too.
    await audit.getByTestId('audit-export').click();
    await page.getByRole('menuitem', { name: /CSV for spreadsheets/ }).click();
    await expect(dialog).toContainText('CSV & JSON exports comes with Breakpointer Pro.');
  });

  test('the trial turns on the accessibility checks, hidden banners and synced interactions', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/pro') });
    await agentsReady(page, '/pro');
    await startTrial(page);

    // Accessibility checks, in every preview.
    await page.getByTestId('audit-toggle').click();
    const audit = page.getByTestId('audit');
    for (const kind of ['missing-alt', 'unnamed-control', 'unlabeled-field', 'hidden-focus', 'missing-lang'])
      await expect(audit.locator(`[data-testid="audit-group"][data-kind="${kind}"]`), kind).toBeVisible();
    // The closed off-canvas menu, off the left of the screen at every size.
    await expect(audit.locator('[data-kind="hidden-focus"]')).toContainText('In 3 of 3');
    await expect(audit.locator('[data-kind="hidden-focus"]')).toContainText('nav.drawer > a← 260px');
    await expect(audit.getByTestId('audit-pro-teaser')).toHaveCount(0);

    // CSV of the audit.
    const download = page.waitForEvent('download');
    await audit.getByTestId('audit-export').click();
    await page.getByRole('menuitem', { name: /CSV for spreadsheets/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-audit_127.0.0.1_\d{8}-\d{6}\.csv$/);
    const csv = await readFile(await file.path(), 'utf8');
    expect(csv.startsWith('\uFEFFViewport,Width (px),Height (px),Result,Check')).toBe(true);
    expect(csv).toMatch(/Phone,375,667,Issues,Images without alt text,missing-alt,1,,img#photo/);
    await page.getByTestId('audit-toggle').click();

    // Cookie banners, hidden in every preview.
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: /Hide cookie banners/ }).click();
    await page.keyboard.press('Escape');
    for (const frame of previewFrames(page, '/pro'))
      await expect
        .poll(() => frame.evaluate(() => getComputedStyle(document.getElementById('onetrust-banner-sdk')!).display))
        .toBe('none');

    // Clicks and typing, repeated in the other previews.
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: /Sync clicks & typing/ }).click();
    await page.keyboard.press('Escape');
    const phone = await frameAt(page, '/pro', 375);
    const laptop = await frameAt(page, '/pro', 1366);
    await clickInFrame(page, phone, '#hamburger', async () => (await text(phone, '#opened')) === '1');
    for (const frame of previewFrames(page, '/pro')) await expect.poll(() => text(frame, '#opened')).toBe('1');
    await expect.poll(() => laptop.evaluate(() => document.getElementById('menu')!.className)).toBe('open');

    await clickInFrame(page, phone, '#name', async () => phone.evaluate(() => document.activeElement?.id === 'name'));
    await page.keyboard.type('Hello Pro');
    for (const frame of previewFrames(page, '/pro'))
      await expect
        .poll(() => frame.evaluate(() => (document.getElementById('name') as HTMLInputElement).value))
        .toBe('Hello Pro');

    await clickInFrame(page, phone, '#agree', async () =>
      phone.evaluate(() => (document.getElementById('agree') as HTMLInputElement).checked),
    );
    await expect
      .poll(() => laptop.evaluate(() => (document.getElementById('agree') as HTMLInputElement).checked))
      .toBe(true);

    // A form is sent in that preview only.
    await clickInFrame(page, phone, '#send', async () => (await text(phone, '#sent')) === '1');
    await page.waitForTimeout(500);
    expect(await text(laptop, '#sent')).toBe('0');
  });

  test('licence keys are checked in the browser and managed in Settings', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('palette-input')).toBeFocused();
    await page.keyboard.type('licence key');
    await expect(page.getByTestId('command-palette').getByRole('option').first()).toContainText('Enter a licence key');
    await page.keyboard.press('Enter');
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings.getByTestId('plan-status')).toContainText('Free plan');

    const field = settings.getByRole('textbox', { name: 'Licence key' });
    await field.fill('not-a-key');
    await settings.getByRole('button', { name: 'Activate' }).click();
    await expect(settings.getByRole('alert')).toContainText('doesn’t look like a Breakpointer licence key');

    // A key with a changed payload: its signature no longer matches.
    const valid = await testLicense({ name: 'E2E Tester', id: 'L-E2E-1' });
    const [header, , signature] = valid.split('.');
    const forged = `${header}.${Buffer.from(JSON.stringify({ sub: 'L-X', name: 'Mallory', plan: 'pro', iat: 1_800_000_000 })).toString('base64url')}.${signature}`;
    await field.fill(forged);
    await settings.getByRole('button', { name: 'Activate' }).click();
    await expect(settings.getByRole('alert')).toContainText('This licence key isn’t valid');

    await field.fill(`\n${valid.slice(0, 50)}\n${valid.slice(50)}\n`);
    await settings.getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByText('Breakpointer Pro is active. Thank you for supporting Breakpointer!')).toBeVisible();
    await expect(settings.getByTestId('plan-status')).toContainText('Licensed to E2E Tester');
    await expect(settings.getByTestId('plan-status')).toContainText('Licence L-E2E-1');
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pro-button')).toHaveCount(0);

    // Stored for this browser only, never in exported settings; verified again on reload.
    const stored = await page.evaluate(
      async () => (await chrome.storage.local.get('breakpointer.license'))['breakpointer.license'],
    );
    expect(stored).toMatchObject({ key: valid });
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect(page.getByTestId('pro-button')).toHaveCount(0);

    // Removing it can be undone.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Remove licence' }).click();
    await expect(page.getByText('Licence key removed from this browser')).toBeVisible();
    await expect(page.getByTestId('plan-status')).toContainText('Free plan');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('plan-status')).toContainText('Licensed to E2E Tester');
  });

  test('your brand goes on Check pages reports', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/site/') });
    await agentsReady(page, '/site/');
    await page.evaluate(
      async (key) => chrome.storage.local.set({ 'breakpointer.license': { key, trialStartedAt: null } }),
      await testLicense({ name: 'Brand Tester' }),
    );
    await expect(page.getByTestId('pro-button')).toHaveCount(0);

    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('textbox', { name: 'Name' }).fill('Acme Studio');
    await settings.getByRole('textbox', { name: 'Name' }).press('Enter');
    await settings.getByRole('textbox', { name: 'Website' }).fill('https://acme.example');
    await settings.getByRole('textbox', { name: 'Website' }).press('Enter');
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();

    await page.keyboard.press('b');
    const dialog = page.getByRole('dialog', { name: 'Check pages' });
    await dialog.getByTestId('batch-start').click();
    await expect(dialog.getByTestId('batch-status')).toContainText('checked', { timeout: 30_000 });
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download report' }).click();
    const html = await readFile(await (await download).path(), 'utf8');
    expect(html).toContain('Acme Studio · Check pages');
    expect(html).toContain('Prepared by <a href="https://acme.example/" rel="noopener noreferrer">Acme Studio</a>');

    // And the run as JSON.
    const json = page.waitForEvent('download');
    await dialog.getByTestId('batch-export').click();
    await page.getByRole('menuitem', { name: /JSON for scripts/ }).click();
    const data = JSON.parse(await readFile(await (await json).path(), 'utf8'));
    expect(data).toMatchObject({ app: 'Breakpointer', kind: 'check-pages', complete: true });
    expect(data.pages[0].url).toBe(server.url('/site/'));
  });

  test('the upgrade dialog and the plan in Settings pass axe in the dark theme', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    // "T" switches light ↔ dark (the test browser's system theme is light).
    await page.keyboard.press('t');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForTimeout(400);
    await page.getByTestId('pro-button').click();
    await expect(page.getByRole('dialog', { name: 'Breakpointer Pro' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Plan' }).click();
    await expect(page.getByTestId('plan-status')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
