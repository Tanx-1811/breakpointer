import { expect, test } from './fixtures';
import { agentsReady, frameAt } from './helpers';

test.describe('visual check', () => {
  test('save a baseline, change the page, see what changed and accept it', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');

    await page.keyboard.press('v');
    const dialog = page.getByRole('dialog', { name: 'Visual check' });
    await expect(dialog.getByTestId('visual-summary')).toHaveText(
      'No baseline for this page yet. Save one, change something, then compare.',
    );
    await dialog.getByTestId('visual-save').click();
    await expect(page.getByText('Baseline saved for 3 viewports')).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByTestId('visual-tile')).toHaveCount(3);
    await expect(dialog.getByTestId('visual-summary')).toContainText('Baseline from');

    // Nothing changed yet.
    await dialog.getByTestId('visual-compare').click();
    await expect(dialog.getByTestId('visual-summary')).toHaveText('No viewport changed', { timeout: 20_000 });
    await expect(dialog.locator('[data-state="same"]')).toHaveCount(3);

    // The phone preview's page changes colour.
    const phone = await frameAt(page, '/responsive', 375);
    await phone.evaluate(() => document.body.style.setProperty('background', 'rgb(220, 38, 38)'));
    await dialog.getByTestId('visual-compare').click();
    await expect(dialog.getByTestId('visual-summary')).toHaveText('1 of 3 viewports changed', { timeout: 20_000 });
    const tile = dialog.locator('[data-testid="visual-tile"][data-key="375x667"]');
    await expect(tile).toHaveAttribute('data-state', 'changed');
    await expect(tile.getByTestId('visual-state')).toContainText('% changed');

    // The comparison, three ways.
    await tile.getByRole('button', { name: 'View the comparison of Phone' }).click();
    const detail = dialog.getByTestId('visual-detail');
    await expect(detail).toContainText('% changed');
    await expect(detail.getByRole('radio', { name: 'Differences' })).toHaveAttribute('aria-checked', 'true');
    await detail.getByRole('radio', { name: 'Slider' }).click();
    await detail.getByRole('slider', { name: 'Baseline shown up to' }).fill('30');
    await detail.getByRole('radio', { name: 'Side by side' }).click();
    await expect(detail.getByRole('img', { name: 'Phone · Baseline' })).toBeVisible();

    // Accepting makes it the new baseline: comparing again finds no change.
    await detail.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('New baseline saved for Phone')).toBeVisible();
    await dialog.getByTestId('visual-compare').click();
    await expect(dialog.getByTestId('visual-summary')).toHaveText('No viewport changed', { timeout: 20_000 });
  });

  test('baselines stay in this browser and can be deleted from Settings', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.keyboard.press('v');
    const dialog = page.getByRole('dialog', { name: 'Visual check' });
    await dialog.getByTestId('visual-save').click();
    await expect(page.getByText('Baseline saved for 3 viewports')).toBeVisible({ timeout: 20_000 });

    // Still there after a reload.
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await page.keyboard.press('v');
    await expect(page.getByRole('dialog', { name: 'Visual check' }).getByTestId('visual-summary')).toContainText(
      'Baseline from',
    );
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Settings' }).click();
    const list = page.getByTestId('snapshot-list');
    await expect(list).toContainText(server.url('/responsive'));
    await expect(list).toContainText('3 viewports');
    await list.getByRole('button', { name: `Delete the baselines of ${server.url('/responsive')}` }).click();
    await expect(list).toContainText('No baselines saved.');
  });
});
