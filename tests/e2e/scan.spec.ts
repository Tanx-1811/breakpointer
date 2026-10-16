import { expect, test } from './fixtures';
import { agentsReady, card } from './helpers';

test.describe('width scanner', () => {
  test('finds the exact widths where each issue starts and stops', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/scan') });
    await agentsReady(page, '/scan');
    await page.keyboard.press('w');
    const dialog = page.getByRole('dialog', { name: 'Scan every width' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('spinbutton', { name: 'From' }).fill('320');
    await dialog.getByRole('spinbutton', { name: 'To' }).fill('900');
    await dialog.getByRole('combobox', { name: 'Step' }).selectOption('32');
    await expect(dialog.getByTestId('scan-start')).toBeEnabled();
    await dialog.getByTestId('scan-start').click();
    await expect(dialog.getByTestId('scan-status')).toContainText('widths checked', { timeout: 30_000 });

    // Found to the pixel: 400px of content overflows below 399 (1px is tolerated, as in the checks);
    // the small print stops at the 768 breakpoint.
    const overflow = dialog.locator('[data-testid="scan-finding"][data-kind="overflow"]');
    await expect(overflow).toContainText('320–398 px');
    const small = dialog.locator('[data-testid="scan-finding"][data-kind="small-text"]');
    await expect(small).toContainText('320–767 px');
    // The site's own breakpoint is drawn on the chart.
    await expect(dialog.locator('[data-tooltip="This site’s breakpoints · 768px"]')).toHaveCount(1);

    // Jump to the worst width and add a viewport there.
    await overflow.getByRole('button', { name: '320–398 px' }).click();
    await expect(dialog.getByTestId('scan-width')).toHaveText('320 × 800');
    await dialog.getByRole('slider', { name: 'Preview width' }).fill('398');
    await expect(dialog.getByTestId('scan-width')).toHaveText('398 × 800');
    await expect(dialog.locator('output')).toContainText('At 398 px: the page is');
    await expect(dialog.locator('output')).toContainText('Content wider than the screen (2px too wide)');
    await dialog.getByTestId('scan-add').click();
    await page.keyboard.press('Escape');
    await expect(card(page, '398px')).toBeVisible();

    // The result stays for the session.
    await page.keyboard.press('w');
    await expect(page.getByRole('dialog', { name: 'Scan every width' }).getByTestId('scan-status')).toContainText(
      'widths checked',
    );
  });
});
