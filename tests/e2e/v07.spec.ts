import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, card, frameAt, previewWidths } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

/** Collects what the page copies to the clipboard. */
async function catchCopies(page: Page) {
  await page.evaluate(() => {
    const copies: string[] = [];
    Object.assign(window, { __copies: copies });
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => void copies.push(text),
    });
  });
  return () => page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1) ?? '');
}

test.describe('v0.7', () => {
  test('the audit gives the page a responsive score', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/audit') });
    await agentsReady(page, '/audit');
    await page.keyboard.press('e');
    const score = page.getByTestId('responsive-score');
    await expect(score).toBeVisible();
    await expect(score).toHaveAttribute('aria-label', /^Responsive score \d+ out of 100, grade [A-F]$/);
    await expect(score).toContainText('From 3 sizes');
    await expect(score).toContainText('Low-contrast text');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('notes are pinned on previews and copied as a bug report', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    const lastCopy = await catchCopies(page);

    await page.keyboard.press('n');
    await expect(page.getByTestId('notes-status')).toContainText('Click a preview to pin a note.');
    await card(page, 'Phone')
      .getByTestId('notes-overlay')
      .click({ position: { x: 40, y: 60 } });
    const editor = page.getByTestId('note-editor');
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('textbox', { name: 'Note 1' })).toBeFocused();
    await page.keyboard.type('Logo overlaps the menu');
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    // Still pinning: Escape closed the note only.
    await expect(page.getByTestId('notes-status')).toContainText('1 note on this page');
    const pin = card(page, 'Phone').getByTestId('note-pin');
    await expect(pin).toHaveAccessibleName('Note 1: Logo overlaps the menu');
    await expect(page.getByTestId('notes-toggle-count')).toHaveText('1');

    await page.getByTestId('notes-status').getByRole('button', { name: 'Copy bug report' }).click();
    await expect(page.getByText('Bug report copied as Markdown')).toBeVisible();
    const report = await lastCopy();
    expect(report).toContain(`- Page: ${server.url('/responsive')}`);
    expect(report).toMatch(/### Phone \(375 × 667\)\n\n1\. Logo overlaps the menu _\(at \d+, \d+ px on the page\)_/);

    // Esc stops pinning; the pin stays and opens again; deleting it can be undone.
    await page.locator('body').press('Escape');
    await expect(page.getByTestId('notes-status')).toHaveCount(0);
    await pin.click();
    await page.getByTestId('note-editor').getByRole('button', { name: 'Delete' }).click();
    await expect(pin).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(card(page, 'Phone').getByTestId('note-pin')).toHaveCount(1);
  });

  test('a project saves the whole setup and opens it again, with undo', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);

    const openProjects = async () => {
      await page.getByRole('button', { name: 'Projects' }).click();
      return page.getByRole('menu', { name: 'Projects' });
    };
    await (await openProjects()).getByRole('menuitem', { name: 'Save as project…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save as project' });
    const name = dialog.getByRole('textbox', { name: 'Project name' });
    await expect(name).toHaveValue('127.0.0.1');
    await name.fill('Acme');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved project “Acme”')).toBeVisible();

    // Another setup: a built-in group and Material UI labels.
    await page.getByRole('button', { name: 'Groups' }).click();
    await page.getByRole('menuitem', { name: /Most-used sizes/ }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(7);

    await (await openProjects()).getByRole('menuitem', { name: /^Acme/ }).click();
    await expect(page.getByText('Opened project “Acme”')).toBeVisible();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
    // The newest toast's Undo (the group's toast may still show).
    await page.getByRole('button', { name: 'Undo' }).last().click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(7);

    // The free plan keeps one project: a second one shows what Pro brings.
    await (await openProjects()).getByRole('menuitem', { name: /Save as project…/ }).click();
    await dialog.getByRole('textbox', { name: 'Project name' }).fill('Beta');
    await expect(dialog).toContainText('The free plan keeps one project');
    await dialog.getByRole('button', { name: 'See Pro' }).click();
    await expect(page.getByRole('dialog', { name: 'Breakpointer Pro' })).toContainText(
      'Unlimited projects comes with Breakpointer Pro.',
    );
  });

  test('text at 200% doubles every font size, and Material UI labels the viewports', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    const phone = await frameAt(page, '/responsive', 375);
    const size = () => phone.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontSize);
    const before = Number.parseFloat(await size());

    await page.getByRole('button', { name: 'Simulate' }).click();
    await page.getByRole('menuitemcheckbox', { name: /Text at 200%/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => Number.parseFloat(await size())).toBe(before * 2);
    await page.getByRole('button', { name: 'Simulate' }).click();
    await page.getByRole('menuitemcheckbox', { name: /Text at 200%/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(async () => Number.parseFloat(await size())).toBe(before);

    await page.getByRole('combobox', { name: 'Breakpoints' }).selectOption('mui');
    await expect(card(page, 'Phone').getByTestId('breakpoint-badge')).toHaveText('xs');
    await expect(card(page, 'Tablet').getByTestId('breakpoint-badge')).toHaveText('sm');
    await expect(card(page, 'Laptop').getByTestId('breakpoint-badge')).toHaveText('lg');
  });

  test('the interface speaks the new languages', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByRole('button', { name: 'Settings' }).click();
    const language = page.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Language' });
    await language.selectOption('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Werkzeuge' })).toBeVisible();
    await expect(page.getByTestId('pro-button')).toHaveAccessibleName('Pro holen');

    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await page.getByRole('combobox', { name: 'Sprache' }).selectOption('ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'ツール' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
