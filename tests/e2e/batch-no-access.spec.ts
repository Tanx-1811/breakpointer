import { expect, test } from './fixtures';
import { previewWidths } from './helpers';

// The production build, without host access: Check pages names the sites it can't check
// and marks their pages at once instead of waiting for them.
test.describe('check pages without site access', () => {
  test('asks for the sites in the list and marks their pages as not checked', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/site/') });
    await expect.poll(() => previewWidths(page, '/site/')).toEqual([375, 768, 1366]);
    await page.keyboard.press('b');
    const dialog = page.getByRole('dialog', { name: 'Check pages' });
    await expect(dialog.getByTestId('batch-access')).toContainText('127.0.0.1 isn’t allowed yet');
    await expect(dialog.getByRole('button', { name: 'Allow 127.0.0.1…' })).toBeVisible();

    // Reading the page's links needs the site's permission too.
    await dialog.getByTestId('batch-links').click();
    await expect(page.getByText('Allow 127.0.0.1 to read its links and sitemap.')).toBeVisible();

    await dialog.getByTestId('batch-list').fill(`${server.url('/site/')}\n${server.url('/site/about')}`);
    await dialog.getByTestId('batch-start').click();
    await expect(dialog.getByTestId('batch-failed')).toHaveCount(2);
    await expect(dialog.getByTestId('batch-failed').first()).toContainText('the site isn’t allowed');
    await expect(dialog.getByTestId('batch-status')).toContainText('No page could be checked.');
  });
});
