import { expect, test } from './fixtures';
import { agentsReady, card, frameAt } from './helpers';

test.describe('v0.14 checks', () => {
  test('fields that make iPhones zoom in are flagged at phone widths only', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/v14-checks') });
    await agentsReady(page, '/v14-checks');
    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await expect(audit).toContainText('Fields that make iPhones zoom in');
    const group = audit.locator('[data-testid="audit-group"][data-kind="input-zoom"]');
    // Only the 375 px preview: the check stops at 600 px.
    await expect(group).toContainText('In 1 of 3');
    await expect(group).toContainText('Phone');
    await expect(group).not.toContainText('Tablet');
    await expect(group).not.toContainText('Laptop');
    // The 13 px email field and the 14 px select; not the 16 px, read-only or disabled fields, nor the checkbox.
    await expect(group).toContainText('2 elements · smallest 13px');
    await expect(group).toContainText('input#email');
    await expect(group).toContainText('13px · email');
    await expect(group).toContainText('select#size');
    await expect(group).not.toContainText('input#name');
    await expect(group).not.toContainText('input#locked');
    await expect(group).not.toContainText('input#off');
    await expect(group).not.toContainText('input#agree');

    // The checks of the phone preview explain it, and Highlight marks the fields.
    await card(page, 'Phone').getByTestId('checks-badge').click();
    const panel = page.getByRole('dialog', { name: 'Responsive checks · 375px' });
    await expect(panel).toContainText('2 form fields with text as small as 13px');
    await panel
      .getByRole('listitem')
      .filter({ hasText: 'Fields that make iPhones zoom in' })
      .getByRole('button', { name: 'Highlight' })
      .click();
    const phone = await frameAt(page, '/v14-checks', 375);
    await expect
      .poll(() => phone.evaluate(() => document.querySelector('#email')?.getAttribute('data-bp-issue')))
      .toBe('input-zoom');
    expect(await phone.evaluate(() => document.querySelector('#name')?.getAttribute('data-bp-issue'))).toBeNull();
  });

  test('items shown out of HTML order are flagged where CSS moves them', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/v14-checks') });
    await agentsReady(page, '/v14-checks');
    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await expect(audit).toContainText('Order on screen differs from the HTML');
    const group = audit.locator('[data-testid="audit-group"][data-kind="visual-order"]');
    // `order: -1` applies below 600 px only.
    await expect(group).toContainText('In 1 of 3');
    await expect(group).toContainText('Phone');
    await expect(group).toContainText('1 container');
    await expect(group).toContainText('div#steps');
    await expect(group).toContainText('order · 3, 1, 2');
    // Grid placement that keeps the order, and reversed items with nothing to read, aren't issues.
    await expect(group).not.toContainText('div#tidy');
    await expect(group).not.toContainText('div#icons');

    await group.getByRole('button', { name: 'Highlight in Phone' }).click();
    const phone = await frameAt(page, '/v14-checks', 375);
    await expect
      .poll(() => phone.evaluate(() => document.querySelector('#steps')?.getAttribute('data-bp-issue')))
      .toBe('visual-order');
  });
});
