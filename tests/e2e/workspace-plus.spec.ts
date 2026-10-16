import { expect, test } from './fixtures';
import { agentsReady, card, frameAt, openTools, previewFrames } from './helpers';

test.describe('workspace utilities', () => {
  test('reloading keeps every preview where it was scrolled', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const phone = await frameAt(page, '/long', 375);
    await phone.evaluate(() => window.scrollTo(0, 1800));
    // The others follow (synced scrolling) and settle.
    const tablet = await frameAt(page, '/long', 768);
    await expect.poll(() => tablet.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    const tabletY = await tablet.evaluate(() => window.scrollY);
    await page.waitForTimeout(500);

    await page.keyboard.press('r');
    await expect.poll(async () => (await frameAt(page, '/long', 375)) !== phone).toBe(true);
    await expect.poll(async () => (await frameAt(page, '/long', 375)).evaluate(() => window.scrollY)).toBe(1800);
    await expect
      .poll(async () => (await frameAt(page, '/long', 768)).evaluate((y) => Math.abs(window.scrollY - y), tabletY))
      .toBeLessThan(3);
  });

  test('1 to 8 focus that viewport, again shows them all', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.keyboard.press('2');
    await expect(page.getByTestId('focus-status')).toContainText('Tablet');
    await page.keyboard.press('3');
    await expect(page.getByTestId('focus-status')).toContainText('Laptop');
    await page.keyboard.press('3');
    await expect(page.getByTestId('focus-status')).toHaveCount(0);
    // There is no ninth viewport: nothing happens.
    await page.keyboard.press('9');
    await expect(page.getByTestId('focus-status')).toHaveCount(0);
  });

  test('a workspace link opens the page with its viewports, and can be undone', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive'), sizes: '320x568~Small,1024x768.dark~Wide' });
    await expect(card(page, 'Small')).toBeVisible();
    await expect(card(page, 'Wide')).toBeVisible();
    await expect(card(page, 'Wide').getByTestId('scheme-badge')).toBeVisible();
    expect(new URL(page.url()).searchParams.has('sizes')).toBe(false);
    const toast = page.getByText('Opened a shared workspace with 2 viewports');
    await expect(toast).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(card(page, 'Phone')).toBeVisible();
    await expect(card(page, 'Small')).toHaveCount(0);
  });

  test('copy a link to this workspace', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.evaluate(() => {
      const copies: string[] = [];
      Object.assign(window, { __copies: copies });
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => void copies.push(text),
      });
    });
    await (await openTools(page)).getByRole('menuitem', { name: /^Copy workspace link/ }).click();
    await expect(page.getByText(/^Link copied/)).toBeVisible();
    const link = new URL(
      await page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1) ?? ''),
    );
    expect(link.pathname).toBe('/viewer/viewer.html');
    expect(link.searchParams.get('url')).toBe(server.url('/responsive'));
    expect(link.searchParams.get('sizes')).toBe('375x667~Phone,768x1024~Tablet,1366x768~Laptop');
  });

  test('every preview shows the page’s dark styles at once, with undo', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/scheme') });
    await agentsReady(page, '/scheme');
    await page.getByRole('button', { name: 'Simulate' }).click();
    await page.getByRole('menu', { name: 'Simulate' }).getByRole('menuitemradio', { name: 'Dark' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('scheme-badge')).toHaveCount(3);
    for (const frame of previewFrames(page, '/scheme'))
      await expect
        .poll(() => frame.evaluate(() => getComputedStyle(document.body).backgroundColor))
        .toBe('rgb(0, 0, 0)');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('scheme-badge')).toHaveCount(0);
  });

  test('previews can reload automatically', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/counter') });
    const title = async () =>
      (await frameAt(page, '/counter', 375)).evaluate(() => Number(document.title.replace('Load ', '')));
    await expect.poll(title).toBeGreaterThan(0);
    const first = await title();
    await page.getByTestId('reload-menu').click();
    await page.getByRole('menuitemradio', { name: 'Every 5 s' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('auto-reload-status')).toContainText('Reloading every 5 s');
    await expect.poll(title, { timeout: 12_000 }).toBeGreaterThan(first);
    await page.getByTestId('auto-reload-status').getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByTestId('auto-reload-status')).toHaveCount(0);
  });

  test('after an update, Help shows what’s new until it is opened', async ({ openViewer }) => {
    const page = await openViewer();
    // An earlier version was used: its settings are stored, the news weren't seen.
    await page.evaluate(() => chrome.storage.local.set({ 'breakpointer.seenVersion': '0.1.0' }));
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    const help = page.getByTestId('help-button');
    await expect(help).toHaveAccessibleName('Help & keyboard shortcuts — see what’s new');
    await help.click();
    await expect(page.getByTestId('whats-new')).toContainText('New in Breakpointer 0.');
    await page.keyboard.press('Escape');
    await expect(help).toHaveAccessibleName('Help & keyboard shortcuts');
    await page.reload();
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await expect(page.getByTestId('help-button')).toHaveAccessibleName('Help & keyboard shortcuts');
  });
});
