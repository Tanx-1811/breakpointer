import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`workspace and dialogs in ${theme} theme`, async ({ openViewer, server }) => {
      const page = await openViewer({ url: server.url('/demo') });
      // "T" cycles system → light → dark (the test browser's system theme is light).
      await page.keyboard.press('t');
      if (theme === 'dark') await page.keyboard.press('t');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      // Let colour transitions finish so axe measures the final colours.
      await page.waitForTimeout(400);
      expect(await seriousViolations(page)).toEqual([]);

      for (const [open, name] of [
        ['a', 'Add viewport'],
        ['?', 'Help & keyboard shortcuts'],
      ] as const) {
        await page.locator('body').press(open);
        await expect(page.getByRole('dialog', { name })).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
        await page.keyboard.press('Escape');
      }
      await page.getByRole('button', { name: 'Settings' }).click();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test('popup', async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup.getByRole('button', { name: 'Open workspace' }).waitFor();
    expect(await seriousViolations(popup)).toEqual([]);
  });
});
