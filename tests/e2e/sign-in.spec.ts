import { expect, test } from './fixtures';
import { frameAt, previewFrames, previewWidths } from './helpers';

const titles = (page: Parameters<typeof previewFrames>[0], path: string) =>
  Promise.all(previewFrames(page, path).map((frame) => frame.evaluate(() => document.title).catch(() => '')));

test.describe('sites that refuse frames, and sites you are signed in to', () => {
  test('a site that refuses to load as a frame (Fetch Metadata) shows in every preview', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/fetch-metadata') });
    await expect.poll(() => previewWidths(page, '/fetch-metadata')).toEqual([375, 768, 1366]);
    // The site's page at each real width, not its "something went wrong" page.
    await expect.poll(() => titles(page, '/fetch-metadata')).toEqual(Array(3).fill('Fetch metadata page'));
  });

  test('a preview the site serves with an error is pointed out', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/forbidden') });
    await expect(page.getByTestId('http-status')).toHaveCount(3);
    await expect(page.getByTestId('http-status').first()).toHaveText(/HTTP 403/);
    // A page served normally has no such label.
    await page.getByTestId('address-input').fill(server.url('/responsive'));
    await page.keyboard.press('Enter');
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
    await expect(page.getByTestId('http-status')).toHaveCount(0);
  });

  test('the session cookies of a site you are signed in to reach its previews', async ({
    context,
    openViewer,
    server,
  }) => {
    // Sign in in a normal tab, with cookies of every SameSite kind.
    const tab = await context.newPage();
    await tab.goto(server.url('/session/login'));
    await tab.close();

    const page = await openViewer({ url: server.url('/session/check') });
    const phone = await frameAt(page, '/session/check', 375);
    const serverCookies = () => phone.evaluate(() => (window as Window & { __serverCookies?: string }).__serverCookies);
    await expect.poll(serverCookies).toBe('sid_lax sid_none sid_strict');

    // The page's own requests (e.g. its API calls) carry them too.
    const fromPage = await phone.evaluate(async () => {
      const html = await (await fetch('/session/check')).text();
      return /__serverCookies = "([^"]*)"/.exec(html)?.[1];
    });
    expect(fromPage).toBe('sid_lax sid_none sid_strict');
  });
});
