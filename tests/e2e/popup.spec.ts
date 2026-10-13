import { expect, test } from './fixtures';

test.describe('popup', () => {
  test('opens a valid address in the workspace', async ({ context, extensionId, server }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    // Opened as a tab, the "current tab" is the popup itself, which can't be previewed.
    await expect(popup.getByText('This page can’t be previewed')).toBeVisible();

    const input = popup.getByRole('textbox', { name: 'Preview another address' });
    await input.fill('chrome://flags');
    await input.press('Enter');
    await expect(popup.getByRole('alert')).toHaveText('Only http:// and https:// pages can be previewed.');

    await input.fill(server.url('/demo'));
    const viewer = context.waitForEvent('page');
    const closed = popup.waitForEvent('close');
    // The popup closes itself once the workspace opens, so don't wait on the key press.
    await input.press('Enter').catch(() => {});
    const page = await viewer;
    await closed;
    await page.waitForURL(/viewer\.html/);
    expect(new URL(page.url()).searchParams.get('url')).toBe(server.url('/demo'));
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);
  });

  test('opens the workspace with a chosen group', async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popup.getByRole('combobox', { name: 'Viewports' }).selectOption({ label: 'Mobile QA (5)' });
    const viewer = context.waitForEvent('page');
    await popup
      .getByRole('button', { name: 'Open workspace' })
      .click()
      .catch(() => {});
    const page = await viewer;
    await expect(page.getByTestId('viewport-card')).toHaveCount(5);
    expect(new URL(page.url()).searchParams.has('group')).toBe(false);
  });
});
