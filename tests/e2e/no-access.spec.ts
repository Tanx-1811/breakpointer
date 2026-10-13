import { expect, test } from './fixtures';
import { card } from './helpers';

/** The production build, as installed from the store: no host access yet. */
test.describe('without site access', () => {
  test('blocked sites show the explanation and fallbacks', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/xfo-deny') });
    const notice = page.getByTestId('embed-notice');
    await expect(notice).toContainText('127.0.0.1 doesn’t allow being shown inside other pages');
    await expect(notice.getByRole('button', { name: 'Allow on 127.0.0.1' })).toBeVisible();
    await expect(notice.getByRole('button', { name: 'Open in new tab' })).toBeVisible();
    // Chrome refuses to frame the page without access.
    await expect.poll(() => page.frames().filter((frame) => frame.url().startsWith('chrome-error://')).length).toBe(3);

    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice).toBeHidden();
  });

  test('the blocked-site tip can be turned off and back on', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    const notice = page.getByTestId('embed-notice');
    await notice.getByRole('button', { name: 'Don’t show again' }).click();
    await expect(notice).toBeHidden();
    await expect(page.getByText('Tips for blocked sites are off')).toBeVisible();
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);
    await expect(notice).toBeHidden();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('switch', { name: 'Tips for blocked sites' }).click();
    await page.keyboard.press('Escape');
    await expect(notice).toBeVisible();
  });

  test('sites that allow framing still work', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await expect.poll(() => page.frames().filter((frame) => frame.url() === server.url('/demo')).length).toBe(3);
  });

  test('screenshots explain the permission first', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await card(page, 'Phone').getByRole('button', { name: 'Screenshot of Phone' }).click();
    const dialog = page.getByRole('dialog', { name: 'Allow screenshots' });
    await expect(dialog).toContainText('access to all sites');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('the manifest asks for no host access at install', async ({ openViewer }) => {
    const page = await openViewer();
    const manifest = await page.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.permissions).toEqual([
      'storage',
      'activeTab',
      'contextMenus',
      'declarativeNetRequestWithHostAccess',
    ]);
    const granted = await page.evaluate(() => chrome.permissions.getAll());
    expect(granted.origins ?? []).toEqual([]);
  });
});
