import { expect, test } from './fixtures';
import { agentsReady, card, frameAt } from './helpers';

test.describe('checks and tools hold up', () => {
  test('a highlight keeps backgrounds, and text a shadow root shows isn’t judged', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/robust') });
    await agentsReady(page, '/robust');
    const badge = card(page, 'Phone').getByTestId('checks-badge');
    // Only the small print: white text on the shadow root's dark box isn't taken for white on white.
    await expect(badge).toHaveAccessibleName('Responsive checks: 1 issue found');
    await expect(page.getByTestId('audit-toggle')).toHaveAccessibleName('Audit, 1 kind of issue found');

    await badge.click();
    const panel = page.getByRole('dialog', { name: 'Responsive checks · 375px' });
    await panel
      .getByRole('listitem')
      .filter({ hasText: 'Text smaller than 12px' })
      .getByRole('button', { name: 'Highlight' })
      .click();
    const phone = await frameAt(page, '/robust', 375);
    await expect
      .poll(() => phone.evaluate(() => document.querySelector('#badge')?.getAttribute('data-bp-issue')))
      .toBe('small-text');
    // The page changes (something now sticks out), so the checks run again with the badge
    // highlighted: its dark background still counts, so it isn't low contrast.
    await phone.evaluate(() =>
      document.body.append(Object.assign(document.createElement('div'), { style: 'width: 600px; height: 8px' })),
    );
    await expect(badge).toHaveAccessibleName('Responsive checks: 2 issues found');
    await expect(panel).not.toContainText('Low-contrast text');
  });

  test('a stopped width scan says how far it got', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/scan') });
    await agentsReady(page, '/scan');
    await page.keyboard.press('w');
    const dialog = page.getByRole('dialog', { name: 'Scan every width' });
    const status = dialog.getByTestId('scan-status');
    await dialog.getByTestId('scan-start').click();
    await expect(status).toContainText('Checking');
    await dialog.getByRole('button', { name: 'Stop' }).click();
    await expect(status).toHaveText(/^Stopped at (\d+)px: the widths from 320 to \1 px were checked\.$/);
    // What was found so far is kept.
    await expect(dialog.getByTestId('scan-finding').first()).toBeVisible();
  });

  test('focus stays put in the visual check when views change', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.keyboard.press('v');
    const dialog = page.getByRole('dialog', { name: 'Visual check' });
    await dialog.getByTestId('visual-save').click();
    await expect(page.getByText('Baseline saved for 3 viewports')).toBeVisible({ timeout: 20_000 });
    const phone = await frameAt(page, '/responsive', 375);
    await phone.evaluate(() => document.body.style.setProperty('background', 'rgb(220, 38, 38)'));
    await dialog.getByTestId('visual-compare').click();
    await expect(dialog.getByTestId('visual-summary')).toHaveText('1 of 3 viewports changed', { timeout: 20_000 });

    const tile = dialog.locator('[data-testid="visual-tile"][data-key="375x667"]');
    const view = tile.getByRole('button', { name: 'View the comparison of Phone' });
    await view.click();
    // The comparison opens with focus on its way back…
    const back = dialog.getByTestId('visual-detail').getByRole('button', { name: 'All viewports' });
    await expect(back).toBeFocused();
    // …which returns to the button that opened it.
    await back.click();
    await expect(view).toBeFocused();
    // Accepting closes the comparison; focus lands on its tile.
    await tile.getByRole('button', { name: 'Accept the capture of Phone as its new baseline' }).click();
    await expect(page.getByText('New baseline saved for Phone')).toBeVisible();
    await expect(tile).toBeFocused();
  });
});
