import { expect, test } from './fixtures';
import { testLicense } from './license';

// The production build, as installed from the store.
test.describe('Breakpointer Pro in the production build', () => {
  test('refuses licences signed with the test key, and the trial works without site access', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/pro') });
    await expect(page.getByTestId('pro-button')).toHaveAccessibleName('Get Pro');

    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('textbox', { name: 'Licence key' }).fill(await testLicense());
    await settings.getByRole('button', { name: 'Activate' }).click();
    await expect(settings.getByRole('alert')).toContainText('This key is for a newer version of Breakpointer');
    await expect(settings.getByTestId('plan-status')).toContainText('Free plan');

    await settings.getByTestId('settings-start-trial').click();
    await expect(page.getByText('Your Pro trial has started: 7 days of every Pro feature.')).toBeVisible();
    await expect(settings.getByTestId('plan-status')).toContainText('Pro trial · 7 days left');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pro-button')).toHaveAccessibleName('Pro trial, 7 days left');

    // Pro tools that run inside previews still need the site's permission, and say so.
    await page.getByRole('button', { name: 'Tools' }).click();
    await page.getByRole('menuitemcheckbox', { name: /Hide cookie banners/ }).click();
    await expect(page.getByText('Hide cookie banners works on sites you allow. Allow 127.0.0.1?')).toBeVisible();
  });
});
