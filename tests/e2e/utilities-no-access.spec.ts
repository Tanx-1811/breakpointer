import { expect, test } from './fixtures';
import { previewWidths } from './helpers';

// The production build, without host access: vision and measuring work on every site;
// tools that run inside the page explain that they need the site's permission.
test.describe('utilities without site access', () => {
  test('vision and measuring work; stress tests ask for the site', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);

    await page.getByRole('button', { name: 'Simulate' }).click();
    const menu = page.getByRole('menu', { name: 'Simulate' });
    await expect(menu).toContainText('Page preferences and stress tests work on sites you allow.');
    await menu.getByRole('menuitemradio', { name: 'No red (protanopia)' }).click();
    const filters = () =>
      page.getByTestId('preview-frame').evaluateAll((frames) => frames.map((frame) => getComputedStyle(frame).filter));
    await expect.poll(filters).toEqual(Array(3).fill('url("#bp-vision-protanopia")'));

    await page.getByRole('button', { name: 'Simulate' }).click();
    await page.getByRole('menuitemcheckbox', { name: /^Right to left/ }).click();
    await expect(page.getByText(/Right to left works on sites you allow\. Allow 127\.0\.0\.1\?/)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('body').press('x');
    await expect(page.getByTestId('measure-overlay')).toHaveCount(3);
  });
});
