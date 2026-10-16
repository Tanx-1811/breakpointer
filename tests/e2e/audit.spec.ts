import { expect, test } from './fixtures';
import { agentsReady, card, frameAt } from './helpers';

test.describe('audit', () => {
  test('new checks flag low contrast, cut-off text and layout shifts — not text over a picture', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/audit') });
    await agentsReady(page, '/audit');
    const phoneBadge = card(page, 'Phone').getByTestId('checks-badge');
    await expect(phoneBadge).toHaveAccessibleName('Responsive checks: 3 issues found');
    await expect(card(page, 'Laptop').getByTestId('checks-badge')).toHaveAccessibleName(
      'Responsive checks: 3 issues found',
    );

    await phoneBadge.click();
    const panel = page.getByRole('dialog', { name: 'Responsive checks · 375px' });
    await expect(panel).toContainText('Low-contrast text');
    await expect(panel).toContainText('1 element · 1.98:1');
    await expect(panel).toContainText('p#faint');
    await expect(panel).toContainText('Text cut off by its box');
    await expect(panel).toContainText('div#label');
    await expect(panel).toContainText('The layout shifts while loading');
    // White text over a picture, an ellipsis and a slide outside its carousel aren't issues.
    await expect(panel).not.toContainText('h3');
    await expect(panel).not.toContainText('div#ellipsis');
    await expect(panel).not.toContainText('div.slide');

    // Highlight marks the cut-off label in the page.
    const phone = await frameAt(page, '/audit', 375);
    const clipped = panel.getByRole('listitem').filter({ hasText: 'Text cut off by its box' });
    await clipped.getByRole('button', { name: 'Highlight' }).click();
    await expect
      .poll(() => phone.evaluate(() => document.querySelector('#label')?.getAttribute('data-bp-issue')))
      .toBe('clipped-text');
  });

  test('checks can be switched off one by one in Settings', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/audit') });
    await agentsReady(page, '/audit');
    const phoneBadge = card(page, 'Phone').getByTestId('checks-badge');
    await expect(phoneBadge).toHaveAccessibleName('Responsive checks: 3 issues found');

    await page.getByRole('button', { name: 'Settings' }).click();
    const kinds = page.getByTestId('check-kinds');
    await kinds.getByRole('checkbox', { name: 'Low-contrast text' }).uncheck();
    await kinds.getByRole('checkbox', { name: 'The layout shifts while loading' }).uncheck();
    await page.keyboard.press('Escape');
    await expect(phoneBadge).toHaveAccessibleName('Responsive checks: 1 issue found');

    // Kept after a reload.
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect(card(page, 'Phone').getByTestId('checks-badge')).toHaveAccessibleName(
      'Responsive checks: 1 issue found',
    );
  });

  test('the audit panel compares issues, page stats and type across sizes', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/audit') });
    await agentsReady(page, '/audit');
    await expect(page.getByTestId('audit-toggle-count')).toHaveText('3');

    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await expect(audit).toBeVisible();
    await expect(audit.getByTestId('audit-summary')).toHaveText('3 kinds of issue in 3 previews');
    const groups = audit.getByTestId('audit-group');
    await expect(groups).toHaveCount(3);
    const contrast = audit.locator('[data-testid="audit-group"][data-kind="low-contrast"]');
    await expect(contrast).toContainText('In 3 of 3');

    // Highlight from the panel marks the text in that preview.
    await contrast.getByRole('button', { name: 'Highlight in Tablet' }).click();
    const tablet = await frameAt(page, '/audit', 768);
    await expect
      .poll(() => tablet.evaluate(() => document.querySelector('#faint')?.getAttribute('data-bp-issue')))
      .toBe('low-contrast');
    await expect(contrast.getByRole('button', { name: 'Hide the highlight in Tablet' })).toBeVisible();

    // Performance: one bar per preview for every metric.
    await audit.getByRole('tab', { name: 'Performance' }).click();
    const weight = audit.locator('[data-metric="transferred"]');
    await expect(weight.getByRole('listitem')).toHaveCount(3);
    await expect(audit.locator('[data-metric="height"]')).toContainText('px');
    await expect(audit.locator('[data-metric="cls"]')).toContainText('Layout shift');

    // Type: the heading grows from tablet sizes, marked as a change.
    await audit.getByRole('tab', { name: 'Type' }).click();
    const heading = audit.locator('[data-tag="h2"]');
    await expect(heading).toHaveAttribute('data-changed', 'true');
    await expect(heading).toContainText('22px');
    await expect(heading).toContainText('30px');

    // The inspector and the audit share the side: opening one closes the other.
    await page.keyboard.press('i');
    await expect(audit).toHaveCount(0);
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect(page.getByTestId('audit')).toBeVisible();
    await page.keyboard.press('e');
    await expect(page.getByTestId('audit')).toHaveCount(0);
  });

  test('the audit is copied as a Markdown table', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/audit') });
    await agentsReady(page, '/audit');
    // Playwright can't grant clipboard access to an extension page: keep what is written instead.
    await page.evaluate(() => {
      const copies: string[] = [];
      Object.assign(window, { __copies: copies });
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => void copies.push(text),
      });
    });
    await page.getByTestId('audit-toggle').click();
    await page.getByTestId('audit').getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect(page.getByText('Copied as a Markdown table')).toBeVisible();
    const text = await page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1) ?? '');
    expect(text).toContain('**Responsive checks**');
    expect(text).toContain('| Check | Phone (375px) | Tablet (768px) | Laptop (1366px) |');
    expect(text).toMatch(/\| Low-contrast text \| ⚠ 1 · 1\.98:1 \|/);
    expect(text).toMatch(/\| Content wider than the screen \| ✓ \| ✓ \| ✓ \|/);
  });
});
