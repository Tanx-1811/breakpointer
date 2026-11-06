import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, openTools } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

const learned = (page: Page) =>
  page.evaluate(
    async () => ((await chrome.storage.local.get('breakpointer.learn'))['breakpointer.learn'] ?? null) as unknown,
  );

const stubClipboard = (page: Page) =>
  page.evaluate(() => {
    const copies: string[] = [];
    Object.assign(window, { __copies: copies });
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => void copies.push(text),
    });
  });

test.describe('v0.10', () => {
  test('Help starts with the checklist and guides; a guide opens what it talks about', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    // The status bar shows the checklist; previewing a page ticked off its first task.
    await expect(page.getByTestId('learn-button')).toContainText('1/8');
    await page.getByTestId('learn-button').click();
    const help = page.getByRole('dialog', { name: /Help/ });
    await expect(help.getByRole('tab', { name: /Get started/ })).toHaveAttribute('aria-selected', 'true');
    await expect(help.getByTestId('learn-checklist')).toContainText('1 of 8 done');
    expect(await seriousViolations(page)).toEqual([]);

    // Search finds guides and shortcuts.
    await help.getByTestId('help-search').fill('scan');
    await expect(help.getByRole('button', { name: /Find where a layout breaks/ })).toBeVisible();
    await expect(help).toContainText('Scan every width');
    await help.getByTestId('help-search').fill('');

    await help.locator('[data-guide="audit"]').click();
    await expect(help).toBeHidden();
    const tour = page.getByTestId('tour');
    await expect(tour).toContainText('Audit a page at every size');
    await expect(tour).toContainText('Open the audit');
    await tour.getByRole('button', { name: 'Next' }).click();
    // The step opened the audit and points at its tabs.
    await expect(page.getByTestId('audit')).toBeVisible();
    await expect(tour).toContainText('Eight views of the page');
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);
    await expect(page.getByTestId('learn-button')).toContainText('2/8');
    await expect.poll(async () => ((await learned(page)) as { done?: string[] } | null)?.done).toContain('audit');
  });

  test('“What’s this?” explains a control without using it', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.keyboard.press('h');
    await expect(page.getByTestId('explain-banner')).toBeVisible();
    await page.getByTestId('notes-toggle').hover();
    const card = page.getByTestId('explain-card');
    await expect(card).toContainText('Pin numbered notes');
    await expect(card).toContainText('N');
    await page.getByTestId('notes-toggle').click();
    // Explained, not switched on.
    await expect(page.getByTestId('notes-status')).toHaveCount(0);
    await expect(card).toHaveAttribute('data-pinned');
    expect(await seriousViolations(page)).toEqual([]);
    await card.getByTestId('explain-guide').click();
    await expect(page.getByTestId('explain-banner')).toHaveCount(0);
    await expect(page.getByTestId('tour')).toContainText('Report a bug with notes');
    await page.keyboard.press('Escape');

    // The keyboard works too, and Escape leaves the mode.
    await page.keyboard.press('h');
    await page.getByTestId('explain-done').click();
    await expect(page.getByTestId('explain-banner')).toHaveCount(0);
    await expect.poll(async () => ((await learned(page)) as { done?: string[] } | null)?.done).toContain('explain');
  });

  test('present mode shows only the previews', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.keyboard.press('d');
    const bar = page.getByTestId('present-bar');
    await expect(bar).toContainText('Presenting');
    await expect(page.getByTestId('address-input')).toHaveCount(0);
    await expect(page.getByTestId('status-bar')).toHaveCount(0);
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);
    expect(await seriousViolations(page)).toEqual([]);
    await bar.getByTestId('present-exit').click();
    await expect(bar).toHaveCount(0);
    await expect(page.getByTestId('address-input')).toBeVisible();

    await page.getByTestId('present-button').click();
    await expect(page.getByTestId('present-bar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('present-bar')).toHaveCount(0);
  });

  test('the QA checklist records a result per check and size and copies a report', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await stubClipboard(page);
    await page.keyboard.press('q');
    const panel = page.getByTestId('qa-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('qa-row')).toHaveCount(8);
    const cell = panel.getByRole('button', { name: /^Phone: The navigation menu opens/ });
    await cell.click();
    await expect(cell).toHaveAccessibleName(/— Passed$/);
    await cell.click();
    await expect(cell).toHaveAccessibleName(/— Failed$/);
    await expect(panel.getByTestId('qa-progress')).toContainText('1 of 24 checked');
    expect(await seriousViolations(page)).toEqual([]);
    await panel.getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.join('\n')))
      .toContain('❌');
    // The audit takes its place at the side; Tools opens it again.
    await page.keyboard.press('e');
    await expect(panel).toHaveCount(0);
    const tools = await openTools(page);
    await tools.getByRole('menuitemcheckbox', { name: /QA checklist/ }).click();
    await expect(page.getByTestId('qa-panel')).toBeVisible();
    await expect(page.getByTestId('audit')).toHaveCount(0);
  });

  test('the audit lists media queries and flags a gap between breakpoints', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/media-gap') });
    await agentsReady(page, '/media-gap');
    await page.keyboard.press('e');
    await page.getByRole('tab', { name: 'Media queries' }).click();
    const tab = page.getByTestId('media-tab');
    await expect(tab.getByTestId('media-problem').first()).toContainText('600');
    await expect(tab.getByTestId('media-table')).toContainText('(min-width: 601px)');
    expect(await seriousViolations(page)).toEqual([]);
    await tab.getByRole('button', { name: 'Add a viewport at 600 px' }).click();
    await expect(page.getByTestId('preview-frame')).toHaveCount(4);
  });
});
