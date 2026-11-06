import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('Settings (v0.14)', () => {
  test('going to the last sections scrolls the settings, never the dialog', async ({ openViewer }) => {
    const page = await openViewer();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: 'Settings' }).first().click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const title = settings.getByRole('heading', { name: 'Settings', level: 2 });
    // Where the title is in the dialog (both move together while the dialog opens).
    const titleOffset = async () => {
      const [heading, dialog] = await Promise.all([title.boundingBox(), settings.boundingBox()]);
      return Math.round(heading!.y - dialog!.y);
    };
    const before = await titleOffset();
    const nav = settings.getByRole('navigation', { name: 'Settings sections' });
    for (const name of ['Plan', 'Privacy & access', 'Backup & reset']) {
      await nav.getByRole('button', { name }).click();
      await expect(nav.getByRole('button', { name })).toHaveAttribute('aria-current', 'true');
      // The title stays where it was, and the dialog itself never scrolls.
      await page.waitForTimeout(600);
      expect(await titleOffset()).toBe(before);
      expect(await settings.evaluate((dialog) => dialog.scrollTop)).toBe(0);
    }
    // The picked section stays highlighted once the content has scrolled as far as it can.
    await nav.getByRole('button', { name: 'Plan' }).click();
    await page.waitForTimeout(800);
    await expect(nav.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'true');
  });

  test('search keeps the settings that match and Ctrl + F goes to it', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByRole('button', { name: 'Settings' }).first().click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const search = settings.getByTestId('settings-search');
    await expect(search).toBeFocused();
    await settings.getByRole('switch', { name: 'Show rulers' }).focus();
    await page.keyboard.press('Control+f');
    await expect(search).toBeFocused();

    await search.fill('grid');
    await expect(settings.getByRole('status')).toHaveText('3 settings found');
    await expect(settings.getByRole('switch', { name: 'Column grid' })).toBeVisible();
    await expect(settings.getByText('Gutter (px)')).toBeVisible();
    await expect(settings.getByRole('switch', { name: 'Show rulers' })).toBeHidden();
    await expect(settings.getByRole('navigation').getByRole('button')).toHaveText(['Appearance', 'Preview tools']);
    // The words found are highlighted without changing the page.
    expect(await page.evaluate(() => CSS.highlights.get('breakpointer-settings-search')?.size ?? 0)).toBeGreaterThan(0);
    const results = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

    await search.fill('nothing like this');
    await expect(settings.getByTestId('settings-no-results')).toContainText('No settings match “nothing like this”.');
    await page.keyboard.press('Escape');
    await expect(search).toHaveValue('');
    await expect(settings).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();
  });
});
