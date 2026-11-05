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

  test('after Chrome updates the extension, the toolbar button and the popup say what’s new', async ({
    context,
    extensionId,
    openViewer,
  }) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    const badge = () => worker.evaluate(() => chrome.action.getBadgeText({}));
    // A fresh install has nothing to catch up on (the welcome workspace has opened by now).
    await openViewer();
    for (const page of context.pages())
      if (page.url().includes('/viewer/viewer.html'))
        await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect.poll(badge).toBe('');
    // The news of an earlier version were the last seen.
    await worker.evaluate(() => chrome.storage.local.set({ 'breakpointer.seenVersion': '0.1.0' }));
    await expect.poll(badge).toBe('NEW');
    expect(await worker.evaluate(() => chrome.action.getTitle({}))).toMatch(
      /^Breakpointer was updated to \d+\.\d+ — click to see what’s new$/,
    );

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    const notice = popup.getByTestId('popup-news');
    await expect(notice).toContainText(/^Breakpointer was updated to \d+\.\d+\./);
    expect(await seriousViolations(popup)).toEqual([]);
    await notice.getByRole('button', { name: 'See what’s new' }).click();
    // The workspace opens on What's new, and the news are seen.
    await expect
      .poll(async () => {
        for (const page of context.pages())
          if (page.url().includes('/viewer/viewer.html') && (await page.getByTestId('whats-new').count())) return true;
        return false;
      })
      .toBe(true);
    await expect.poll(badge).toBe('');
  });

  test('after an update, the workspace says so once and opens What’s new', async ({ openViewer }) => {
    const page = await openViewer();
    await page.evaluate(() => chrome.storage.local.set({ 'breakpointer.seenVersion': '0.1.0' }));
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect(page.getByText(/^Breakpointer was updated to \d+\.\d+\.$/)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole('button', { name: 'See what’s new', exact: true }).click();
    await expect(page.getByTestId('whats-new')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('help-button')).toHaveAccessibleName('Help & keyboard shortcuts');
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect(page.getByText(/^Breakpointer was updated/)).toHaveCount(0);
  });
});
