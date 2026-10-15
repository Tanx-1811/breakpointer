import { expect, test } from './fixtures';
import { storedSettings } from './helpers';

// Playwright can't open Chrome's side panel itself, so its page is opened in a tab
// (the same page, with an address sent from the popup or the context menu).
test.describe('side panel', () => {
  test('previews a page at a preset size, rotates, remembers the size and opens the workspace', async ({
    context,
    extensionId,
    server,
  }) => {
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 420, height: 900 });
    // A page that refuses frames shows too (allowed site).
    await panel.goto(
      `chrome-extension://${extensionId}/sidepanel/sidepanel.html?${new URLSearchParams({ url: server.url('/xfo-deny') })}`,
    );
    const frame = panel.getByTestId('sidepanel-frame');
    await expect(frame).toHaveAttribute('width', '375');
    const content = () => panel.frames().find((item) => item.url().includes('/xfo-deny'));
    await expect
      .poll(
        async () =>
          (await content()
            ?.evaluate(() => [document.title, innerWidth])
            .catch(() => null)) ?? null,
      )
      .toEqual(['XFO deny page', 375]);

    await panel.getByRole('combobox', { name: 'Size' }).selectOption('tablet-m');
    await expect(frame).toHaveAttribute('width', '768');
    await panel.getByRole('button', { name: 'Rotate' }).click();
    await expect(frame).toHaveAttribute('width', '1024');
    await expect(panel.getByTestId('sidepanel-size')).toContainText('1024×768');
    await expect
      .poll(async () => (await storedSettings(panel))?.sidePanel)
      .toEqual({ preset: 'tablet-m', landscape: true });

    // Another address typed in the panel.
    await panel.getByRole('textbox', { name: 'Website address' }).fill(server.url('/responsive'));
    await panel.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(frame).toHaveAttribute('src', server.url('/responsive'));

    // The workspace opens with that page (reusing an open workspace tab, like every entry point).
    await panel.getByTestId('sidepanel-workspace').click();
    const target = encodeURIComponent(server.url('/responsive'));
    await expect
      .poll(() =>
        context.pages().some((page) => page.url().includes('viewer/viewer.html') && page.url().includes(target)),
      )
      .toBe(true);
  });

  test('with nothing to show it explains how to send a page there', async ({ context, extensionId }) => {
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    await expect(panel.getByText(/Preview in the side panel, or type an address above/)).toBeVisible();
  });
});
