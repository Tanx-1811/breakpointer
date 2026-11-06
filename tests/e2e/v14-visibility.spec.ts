import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady } from './helpers';

const stubClipboard = (page: Page) =>
  page.evaluate(() => {
    const copies: string[] = [];
    Object.assign(window, { __copies: copies });
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => void copies.push(text),
    });
  });

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

const states = (page: Page, label: string) =>
  page
    .locator(`[data-testid="visibility-row"][data-label="${label}"] [data-testid="visibility-cell"]`)
    .evaluateAll((cells) => cells.map((cell) => (cell as HTMLElement).dataset.state));

test.describe('v0.14 visibility', () => {
  test('the audit shows what each size shows and hides, copies it and inspects an element', async ({
    openViewer,
    server,
  }) => {
    // The accessibility scan of the whole workspace takes a while.
    test.setTimeout(60_000);
    // The default previews: Phone 375, Tablet 768, Laptop 1366.
    const page = await openViewer({ url: server.url('/visibility') });
    await agentsReady(page, '/visibility');
    await stubClipboard(page);
    await page.keyboard.press('e');
    await page.getByRole('tab', { name: 'Visibility' }).click();

    const tab = page.getByTestId('visibility-tab');
    await expect(tab.getByTestId('visibility-summary')).toHaveText('3 elements change between sizes');
    const table = tab.getByRole('table', { name: 'What each preview shows' });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Element',
      'Phone375',
      'Tablet768',
      'Laptop1366',
      'Actions',
    ]);

    // Each preview's state of each element, and when it's shown, from the previews' widths.
    const rows = tab.getByTestId('visibility-row');
    await expect(rows).toHaveCount(3);
    expect(await states(page, 'header > button.burger')).toEqual(['shown', 'hidden', 'hidden']);
    expect(await states(page, 'header > nav.desktop-nav')).toEqual(['hidden', 'shown', 'shown']);
    expect(await states(page, 'p.tablet-note')).toEqual(['hidden', 'shown', 'hidden']);
    const row = (label: string) => tab.locator(`[data-testid="visibility-row"][data-label="${label}"]`);
    await expect(row('header > button.burger').getByTestId('visibility-when')).toHaveText('Hidden from 768 px');
    await expect(row('header > nav.desktop-nav').getByTestId('visibility-when')).toHaveText('Shown from 768 px');
    await expect(row('p.tablet-note').getByTestId('visibility-when')).toHaveText('Shown only at 768 px');
    await expect(row('header > button.burger')).toContainText('Phone: shown');
    // Hidden at every size: not a change between sizes.
    await expect(row('div.modal')).toHaveCount(0);
    await expect(row('p')).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);

    await page.getByTestId('audit').getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.join('\n')))
      .toContain('| `header > button.burger` | ✓ | – | – | Hidden from 768 px |');

    // A row opens the inspector on that element, which compares it at every size.
    await row('header > nav.desktop-nav')
      .getByRole('button', { name: 'Inspect header > nav.desktop-nav at every size' })
      .click();
    await expect(page.getByTestId('audit')).toHaveCount(0);
    const inspector = page.getByTestId('inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Hidden at this size');
  });
});
