import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, frameAt } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

const theme = async (page: Page, wanted: 'light' | 'dark') => {
  // "T" switches light ↔ dark (the test browser's system theme is light).
  await page.keyboard.press('t');
  if (wanted === 'light') await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveAttribute('data-theme', wanted);
  // Let colour transitions finish so axe measures the final colours.
  await page.waitForTimeout(400);
};

test.describe('accessibility of the v0.4 tools (axe, WCAG 2.1 AA)', () => {
  for (const wanted of ['light', 'dark'] as const) {
    test(`audit panel, width scanner, visual check and settings in the ${wanted} theme`, async ({
      openViewer,
      server,
    }) => {
      const page = await openViewer({ url: server.url('/audit') });
      await agentsReady(page, '/audit');
      await theme(page, wanted);

      // The audit panel, each tab.
      await page.keyboard.press('e');
      const audit = page.getByTestId('audit');
      await expect(audit.getByTestId('audit-group')).toHaveCount(3);
      expect(await seriousViolations(page)).toEqual([]);
      await audit.getByRole('tab', { name: 'Performance' }).click();
      await expect(audit.locator('[data-metric="transferred"] li')).toHaveCount(3);
      expect(await seriousViolations(page)).toEqual([]);
      await audit.getByRole('tab', { name: 'Type' }).click();
      await expect(audit.locator('[data-tag="h1"]')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('e');

      // The width scanner, before and after a scan.
      await page.keyboard.press('w');
      const scan = page.getByRole('dialog', { name: 'Scan every width' });
      await expect(scan.getByTestId('scan-start')).toBeEnabled();
      expect(await seriousViolations(page)).toEqual([]);
      await scan.getByRole('spinbutton', { name: 'To' }).fill('700');
      await scan.getByRole('combobox', { name: 'Step' }).selectOption('32');
      await scan.getByTestId('scan-start').click();
      await expect(scan.getByTestId('scan-status')).toContainText('widths checked', { timeout: 30_000 });
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      // The visual check, with a comparison and its detail.
      await page.keyboard.press('v');
      const visual = page.getByRole('dialog', { name: 'Visual check' });
      expect(await seriousViolations(page)).toEqual([]);
      await visual.getByTestId('visual-save').click();
      await expect(page.getByText('Baseline saved for 3 viewports')).toBeVisible({ timeout: 20_000 });
      await (await frameAt(page, '/audit', 375)).evaluate(() => document.body.style.setProperty('background', '#fdd'));
      await visual.getByTestId('visual-compare').click();
      await expect(visual.getByTestId('visual-summary')).toHaveText('1 of 3 viewports changed', { timeout: 20_000 });
      expect(await seriousViolations(page)).toEqual([]);
      await visual.getByRole('button', { name: 'View the comparison of Phone' }).click();
      await expect(visual.getByTestId('visual-detail')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await visual.getByRole('radio', { name: 'Slider' }).click();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      // Settings: the checks to run and the saved baselines.
      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(page.getByTestId('check-kinds')).toBeVisible();
      await expect(page.getByTestId('snapshot-list')).toContainText('3 viewports');
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      // The reload options and the Simulate menu with page colours for every preview.
      await page.getByTestId('reload-menu').click();
      await expect(page.getByRole('menu', { name: 'Reload options' })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Simulate' }).click();
      await expect(page.getByRole('menu', { name: 'Simulate' })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
    });
  }
});

test.describe('accessibility of the v0.5 tools (axe, WCAG 2.1 AA)', () => {
  for (const wanted of ['light', 'dark'] as const) {
    test(`check pages, showcase image and help in the ${wanted} theme`, async ({ openViewer, server }) => {
      const page = await openViewer({ url: server.url('/site/') });
      await agentsReady(page, '/site/');
      await theme(page, wanted);

      // Check pages, before and after a run, with one cell's issues shown.
      await page.keyboard.press('b');
      const batch = page.getByRole('dialog', { name: 'Check pages' });
      await expect(batch.getByTestId('batch-start')).toBeEnabled();
      expect(await seriousViolations(page)).toEqual([]);
      await batch.getByTestId('batch-links').click();
      await expect(batch.getByTestId('batch-list')).toHaveValue(/site\/wide/);
      await batch.getByTestId('batch-start').click();
      await expect(batch.getByTestId('batch-status')).toContainText('pages checked', { timeout: 60_000 });
      await batch.locator('[data-state="issues"]').first().click();
      await expect(batch.getByTestId('batch-details')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      // The showcase image and its options.
      await page.getByRole('button', { name: 'Screenshots' }).click();
      await page.getByRole('menuitem', { name: /^Showcase image/ }).click();
      const showcase = page.getByRole('dialog', { name: 'Showcase image' });
      await expect(showcase.getByTestId('showcase-image')).toBeVisible({ timeout: 20_000 });
      expect(await seriousViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');

      // Help, with feedback and sharing.
      await page.keyboard.press('?');
      await expect(page.getByTestId('help-support')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});
