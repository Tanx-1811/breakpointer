import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, storedSettings } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

const panels = async (page: Page) => ((await storedSettings(page))?.panels ?? {}) as Record<string, boolean>;

test.describe('v0.9', () => {
  test('the viewports sidebar lists, shows, hides and finds viewports', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await expect(page.getByTestId('viewport-sidebar')).toHaveCount(0);
    await expect(page.getByTestId('viewport-chip')).toHaveCount(3);

    // "\" opens it; it lists the viewports instead of the chips.
    await page.keyboard.press('Backslash');
    const sidebar = page.getByTestId('viewport-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId('viewport-chip').first()).toBeHidden();
    await expect(page.getByTestId('sidebar-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await panels(page)).sidebar).toBe(true);
    const rows = sidebar.getByTestId('sidebar-row');
    await expect(rows).toHaveCount(3);
    await expect(sidebar.getByTestId('breakpoint-map')).toBeVisible();
    await expect(sidebar.getByTestId('sidebar-page')).toContainText('Responsive page');
    expect(await seriousViolations(page)).toEqual([]);

    // Hide one from its row, then show it again by clicking the row.
    await sidebar.getByTestId('sidebar-visibility').first().click();
    await expect(page.getByTestId('preview-frame')).toHaveCount(2);
    await rows.first().click();
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);

    // Double-click focuses it; Esc goes back.
    await rows.first().dblclick();
    await expect(page.getByTestId('focus-status')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('focus-status')).toHaveCount(0);

    // The toolbar button closes it.
    await page.getByTestId('sidebar-toggle').click();
    await expect(sidebar).toHaveCount(0);
    await expect(page.getByTestId('viewport-chip')).toHaveCount(3);
  });

  test('the status bar sums up the workspace and changes it', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/issues') });
    await agentsReady(page, '/issues');
    const status = page.getByTestId('status-bar');
    await expect(status).toBeVisible();
    await expect(page.getByTestId('status-previews')).toHaveText(/3 previews/);
    await expect(page.getByTestId('status-sync')).toContainText('Sync: scrolling, links');
    await expect(page.getByTestId('status-issues')).toContainText(/kinds? of issue/);

    await page.getByTestId('status-issues').click();
    await expect(page.getByTestId('audit')).toBeVisible();
    await page.getByTestId('status-sync').click();
    await expect(page.getByTestId('status-sync')).toContainText('Sync off');
    await page.getByTestId('status-sync').click();
    await expect(page.getByTestId('status-sync')).toContainText('Sync: scrolling, links');
    expect(await seriousViolations(page)).toEqual([]);

    // Hidden from Settings.
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('switch', { name: 'Status bar' }).click();
    await page.keyboard.press('Escape');
    await expect(status).toHaveCount(0);
  });

  test('L cycles the layouts through stack, and the minimap scrolls the workspace', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    const cards = page.locator('[data-cards]');
    await expect(cards).toHaveAttribute('data-layout', 'wrap');
    await page.keyboard.press('l');
    await expect(cards).toHaveAttribute('data-layout', 'row');
    await page.keyboard.press('l');
    await expect(cards).toHaveAttribute('data-layout', 'stack');
    await expect(page.getByTestId('zoom-dock').getByRole('radio', { name: 'Stack' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Stacked at 100% the workspace scrolls down: the minimap shows, and a press on it scrolls there.
    await page.keyboard.press('0');
    const minimap = page.getByTestId('minimap');
    await expect(minimap).toBeVisible();
    const workspace = page.getByTestId('workspace');
    expect(await workspace.evaluate((element) => element.scrollTop)).toBe(0);
    const box = (await minimap.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 10);
    await expect.poll(() => workspace.evaluate((element) => element.scrollTop)).toBeGreaterThan(200);

    await page.getByTestId('status-minimap').click();
    await expect(minimap).toHaveCount(0);
    await page.keyboard.press('l');
    await expect(cards).toHaveAttribute('data-layout', 'wrap');
  });

  test('the accent colour and canvas change the whole workspace', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByRole('button', { name: 'Settings' }).first().click();
    const accents = page.getByRole('radiogroup', { name: 'Accent colour' });
    await expect(accents.getByRole('radio', { name: 'Indigo' })).toBeChecked();
    await accents.locator('label[data-accent="teal"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal');
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),
    ).toBe('#0b665f');
    await page.locator('label[data-canvas="grid"]').click();
    await expect(page.getByTestId('workspace')).toHaveAttribute('data-canvas', 'grid');
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');

    // Dark theme: the dark accent, still readable.
    await page.keyboard.press('t');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),
    ).toBe('#2dd4bf');
    await page.keyboard.press('Backslash');
    // Let the theme's colour transitions finish before checking contrast.
    await page.waitForTimeout(400);
    expect(await seriousViolations(page)).toEqual([]);
    const stored = await storedSettings(page);
    expect([stored?.accent, stored?.canvas]).toEqual(['teal', 'grid']);
  });

  test('the audit’s Meta tab previews the search result and link, and checks tags and headings', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/meta') });
    await agentsReady(page, '/meta');
    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await audit.getByRole('tab', { name: 'Meta' }).click();
    const tab = audit.getByTestId('meta-tab');
    await expect(tab).toBeVisible();
    await expect(audit.getByTestId('meta-serp')).toContainText('Pricing — Meta test page');
    await expect(audit.getByTestId('meta-serp')).toContainText(' › meta');
    await expect(audit.getByTestId('meta-social')).toContainText('Social title');
    // The social image loads from the site, with its size.
    await expect(audit.getByTestId('meta-image-size')).toHaveText('1600 × 400');
    const checks = audit.getByTestId('meta-check');
    await expect(checks).toHaveCount(10);
    await expect(checks.filter({ hasText: 'Description' })).toContainText('results show about 160');
    await expect(checks.filter({ hasText: 'Canonical address' })).toContainText('This page');
    await expect(audit.getByTestId('meta-outline')).toContainText('Skips a level');
    expect(await seriousViolations(page)).toEqual([]);

    await page.evaluate(() => {
      const copies: string[] = [];
      Object.assign(window, { __copies: copies });
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => void copies.push(text),
      });
    });
    await audit.getByRole('button', { name: 'Copy as Markdown' }).click();
    const copied = await page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1) ?? '');
    expect(copied).toContain('## Meta tags and headings');
    expect(copied).toContain('| Social image | OK · Set |');

    // From the palette too.
    await page.keyboard.press('e');
    await expect(audit).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('meta & social');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('meta-tab')).toBeVisible();
  });
});
