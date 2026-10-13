import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** The workspace tab showing `predicate`, whether a new tab was opened or an existing one reused. */
async function workspaceTab(context: BrowserContext, predicate: (url: URL) => boolean): Promise<Page> {
  let found: Page | undefined;
  await expect
    .poll(() => {
      found = context.pages().find((page) => {
        const url = new URL(page.url());
        return url.pathname.endsWith('/viewer/viewer.html') && predicate(url);
      });
      return Boolean(found);
    })
    .toBe(true);
  return found!;
}

async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  return popup;
}

test.describe('popup', () => {
  test('opens a valid address in the workspace', async ({ context, extensionId, server }) => {
    const popup = await openPopup(context, extensionId);
    // Opened as a tab, the "current tab" is the popup or the welcome workspace —
    // neither can be previewed, so there is no "Preview this page" button.
    await expect(popup.getByRole('button', { name: 'Open workspace' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Preview this page' })).toHaveCount(0);

    const input = popup.getByRole('textbox', { name: 'Preview another address' });
    await input.fill('chrome://flags');
    await input.press('Enter');
    await expect(popup.getByRole('alert')).toHaveText('Only http:// and https:// pages can be previewed.');

    await input.fill('https://user:pass@example.com');
    await input.press('Enter');
    await expect(popup.getByRole('alert')).toContainText('username or password');

    await input.fill(server.url('/demo'));
    const closed = popup.waitForEvent('close');
    // The popup closes itself once the workspace opens, so don't wait on the key press.
    await input.press('Enter').catch(() => {});
    await closed;
    const page = await workspaceTab(context, (url) => url.searchParams.get('url') === server.url('/demo'));
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);
  });

  test('reuses an open workspace tab instead of piling up new ones', async ({
    context,
    extensionId,
    server,
    openViewer,
  }) => {
    await openViewer({ url: server.url('/responsive') });
    const countWorkspaces = () => context.pages().filter((page) => page.url().includes('/viewer/viewer.html')).length;
    const before = countWorkspaces();

    const popup = await openPopup(context, extensionId);
    const input = popup.getByRole('textbox', { name: 'Preview another address' });
    await input.fill(server.url('/demo'));
    const closed = popup.waitForEvent('close');
    await input.press('Enter').catch(() => {});
    await closed;
    await workspaceTab(context, (url) => url.searchParams.get('url') === server.url('/demo'));
    expect(countWorkspaces()).toBe(before);
  });

  for (const [where, url, message] of [
    ['the workspace itself', 'viewer', 'You’re in the Breakpointer workspace'],
    [
      'the Chrome Web Store',
      'https://chromewebstore.google.com/detail/abc',
      'Chrome doesn’t let extensions show the Chrome Web Store',
    ],
  ] as const) {
    test(`explains when it is opened on ${where}`, async ({ context, extensionId }) => {
      const popup = await context.newPage();
      // As if opened from the toolbar on that tab (activeTab).
      await popup.addInitScript(
        ([tabUrl]) => {
          chrome.tabs.query = (async () => [{ url: tabUrl }]) as unknown as typeof chrome.tabs.query;
        },
        [
          url === 'viewer'
            ? `chrome-extension://${extensionId}/viewer/viewer.html?url=https%3A%2F%2Fexample.com%2F`
            : url,
        ],
      );
      await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(popup.getByText(message)).toBeVisible();
      await expect(popup.getByRole('button', { name: 'Preview this page' })).toHaveCount(0);
    });
  }

  test('opens the workspace with a chosen group', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.getByRole('combobox', { name: 'Viewports' }).selectOption({ label: 'Mobile QA (5)' });
    await popup
      .getByRole('button', { name: 'Open workspace' })
      .click()
      .catch(() => {});
    const page = await workspaceTab(context, (url) => !url.searchParams.has('group'));
    await expect(page.getByTestId('viewport-card')).toHaveCount(5);
  });
});
