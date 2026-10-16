import { expect, test } from './fixtures';
import { previewWidths } from './helpers';

test.describe('viewports as real windows', () => {
  // Otherwise Playwright resizes each new window to its emulated viewport.
  test.use({ realWindows: true });

  test('open side by side at their sizes, follow the address and close together', async ({
    context,
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
    const windows = (path: string) => context.pages().filter((other) => other !== page && other.url().includes(path));

    await page.getByTestId('open-windows').click();
    await expect(page.getByTestId('windows-banner')).toContainText('3 viewports are open as real windows');
    await expect.poll(() => windows('/responsive').length).toBe(3);
    // Each window's content area has the viewport's size, as Chrome reports it. (The headless screen
    // can't fit the laptop's window exactly, so the two smaller ones are checked.)
    const sizes = () =>
      page.evaluate(async () =>
        (await chrome.tabs.query({ windowType: 'popup' })).map((tab) => `${tab.width}x${tab.height}`),
      );
    await expect.poll(sizes).toEqual(expect.arrayContaining(['375x667', '768x1024']));
    expect(await sizes()).toHaveLength(3);

    // They follow the workspace to another page.
    await page.getByTestId('address-input').fill(server.url('/linked'));
    await page.keyboard.press('Enter');
    await expect.poll(() => windows('/linked').length).toBe(3);

    await page.getByTestId('windows-banner').getByRole('button', { name: 'Close windows' }).click();
    await expect.poll(() => windows('/linked').length).toBe(0);
    await expect(page.getByTestId('windows-banner')).toHaveCount(0);
  });

  test('closing the windows by hand clears the banner', async ({ context, openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByTestId('open-windows').click();
    await expect(page.getByTestId('windows-banner')).toBeVisible();
    await expect
      .poll(() => context.pages().filter((other) => other !== page && other.url().includes('/responsive')).length)
      .toBe(3);
    for (const other of context.pages().filter((item) => item !== page && item.url().includes('/responsive')))
      await other.close();
    await expect(page.getByTestId('windows-banner')).toHaveCount(0);
  });

  test('the floating preview stays on top, follows the workspace and switches viewports', async ({
    context,
    openViewer,
    server,
  }) => {
    // A page that refuses frames shows too (allowed site).
    const page = await openViewer({ url: server.url('/xfo-deny') });
    const opened = context.waitForEvent('page');
    await page.getByTestId('open-floating').click();
    const floating = await opened;
    await expect(floating.getByTestId('floating-preview')).toBeVisible();
    const viewport = floating.getByRole('combobox', { name: 'Viewport' });
    // The narrowest viewport, a phone.
    await expect(viewport.locator('option:checked')).toHaveText('Phone · 375×667');
    const frameTitle = (path: string) => async () => {
      const frame = floating.frames().find((item) => item.url().includes(path));
      return frame ? frame.evaluate(() => document.title).catch(() => '') : '';
    };
    await expect.poll(frameTitle('/xfo-deny')).toBe('XFO deny page');

    await page.getByTestId('address-input').fill(server.url('/responsive'));
    await page.keyboard.press('Enter');
    await expect.poll(frameTitle('/responsive')).toBe('Responsive page');

    await viewport.selectOption({ label: 'Tablet · 768×1024' });
    await expect(floating.locator('iframe')).toHaveAttribute('width', '768');

    await floating.getByRole('button', { name: 'Close the floating preview' }).click();
    await expect.poll(() => floating.isClosed()).toBe(true);
  });
});
