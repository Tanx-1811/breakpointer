import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, clickInFrame, frameAt } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

test.describe('v0.13', () => {
  test('Elements shows the HTML tree and the CSS of a picked element, at the preview’s size', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/elements') });
    await agentsReady(page, '/elements');
    await page.keyboard.press('j');
    const panel = page.getByTestId('elements-panel');
    const tree = panel.getByTestId('elements-tree');
    await expect(tree).toContainText('<body');
    await expect(tree).toContainText('id="hero"');
    expect(await seriousViolations(page)).toEqual([]);

    // Pick the card in the phone preview: its rules, the winner first, the loser struck through.
    await panel.getByTestId('elements-pick').click();
    const phone = await frameAt(page, '/elements', 375);
    await clickInFrame(page, phone, '#hero');
    const rules = panel.getByTestId('elements-rule');
    await expect(rules.first()).toContainText('#hero.card');
    await expect(rules.first()).toContainText('rgb(200, 0, 0)');
    const card = rules.filter({ hasText: /^\.card/ }).first();
    await expect(card.locator('li[data-overridden]')).toContainText('color');
    await expect(panel.getByTestId('elements-styles')).toContainText('element.style');
    await expect(panel.getByTestId('elements-styles')).not.toContainText('@media (min-width: 768px)');
    expect(await seriousViolations(page)).toEqual([]);

    // In the laptop preview the media query applies.
    await panel.getByTestId('elements-card').selectOption({ label: 'Laptop · 1366' });
    await expect(panel.getByTestId('elements-styles')).toContainText('@media (min-width: 768px)', { timeout: 10_000 });

    await panel.getByTestId('elements-tab-computed').click();
    await expect(panel.getByTestId('elements-computed')).toContainText('padding-top');
    await panel.getByTestId('elements-tab-box').click();
    await expect(panel.getByTestId('elements-box')).toHaveAccessibleName(/padding 24 24 24 24/);
    await panel.getByTestId('elements-tab-summary').click();
    const summary = panel.getByTestId('elements-summary');
    await expect(summary).toContainText('dup (2)');
    await expect(summary).toContainText('center (1)');
    expect(await seriousViolations(page)).toEqual([]);

    await page.keyboard.press('j');
    await expect(panel).toHaveCount(0);
  });
});
