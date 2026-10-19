import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { agentsReady } from './helpers';

test.describe('check pages', () => {
  test('checks a list of pages at every viewport and reports which ones break', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/site/') });
    await agentsReady(page, '/site/');
    await page.evaluate(() => {
      const copies: string[] = [];
      Object.assign(window, { __copies: copies });
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => void copies.push(text),
      });
    });

    await page.keyboard.press('b');
    const dialog = page.getByRole('dialog', { name: 'Check pages' });
    await expect(dialog).toBeVisible();
    const list = dialog.getByRole('textbox', { name: 'Pages, one address per line' });
    // The workspace's page starts the list.
    await expect(list).toHaveValue(server.url('/site/'));

    // The links of this page worth checking: not the sign-out link, the file, the callback or another site.
    await dialog.getByTestId('batch-links').click();
    await expect(page.getByText('Added 2 pages linked from this page.')).toBeVisible();
    await expect(list).toHaveValue(
      [server.url('/site/'), server.url('/site/about'), server.url('/site/wide')].join('\n'),
    );
    // A page that doesn't exist.
    await list.fill(`${await list.inputValue()}\n${server.url('/site/missing')}`);
    await expect(dialog.getByText('Pages: 4 · sizes: 3')).toBeVisible();

    await dialog.getByTestId('batch-start').click();
    await expect(dialog.getByTestId('batch-status')).toContainText('1 of 3 pages checked have issues at some size.', {
      timeout: 60_000,
    });
    const row = (path: string) => dialog.locator(`[data-testid="batch-row"][data-page="${server.url(path)}"]`);
    await expect(row('/site/').locator('[data-state="ok"]')).toHaveCount(3);
    await expect(row('/site/about').locator('[data-state="ok"]')).toHaveCount(3);
    // The wide page overflows on the phone only.
    const wide = row('/site/wide').getByTestId('batch-cell');
    await expect(wide.nth(0)).toHaveAttribute('data-state', 'issues');
    await expect(wide.nth(0)).toHaveAttribute('data-kinds', /overflow/);
    await expect(wide.nth(1)).toHaveAttribute('data-state', 'ok');
    await expect(wide.nth(2)).toHaveAttribute('data-state', 'ok');
    await expect(row('/site/missing').getByTestId('batch-failed')).toContainText('HTTP 404');

    // The issues of one page at one size.
    await wide.nth(0).click();
    await expect(dialog.getByTestId('batch-details')).toContainText('Content wider than the screen');
    await expect(dialog.getByTestId('batch-details')).toContainText('div.wide');

    await dialog.getByRole('button', { name: 'Copy as Markdown' }).click();
    await expect(page.getByText('Copied as a Markdown table')).toBeVisible();
    const markdown = await page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1) ?? '');
    expect(markdown).toContain('| Page | Phone (375px) | Tablet (768px) | Laptop (1366px) |');
    expect(markdown).toMatch(/\| \/site\/wide \| ⚠ Content wider than the screen \+\d+px \| ✓ \| ✓ \|/);

    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download report' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-pages_127.0.0.1_\d{8}-\d{6}\.html$/);
    const html = await readFile(await file.path(), 'utf8');
    expect(html).toContain('Pages checked at every viewport');
    expect(html).toContain('Not checked: the page answered HTTP 404');
    expect(html).not.toMatch(/<script/i);

    // The previews in the workspace weren't touched; a page opens there from its row.
    await row('/site/about').getByRole('button', { name: 'Open' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Website address' })).toHaveValue(server.url('/site/about'));
  });

  test('reads the pages of the sitemap the site names in robots.txt', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/site/about') });
    await agentsReady(page, '/site/about');
    await (await openToolsMenu(page)).getByRole('menuitem', { name: /^Check pages/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Check pages' });
    await dialog.getByRole('button', { name: 'Clear' }).click();
    await dialog.getByTestId('batch-sitemap').click();
    await expect(page.getByText('Added 3 pages from the sitemap.')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Pages, one address per line' })).toHaveValue(
      [server.url('/site/'), server.url('/site/about'), server.url('/site/wide')].join('\n'),
    );
    // Lines that aren't addresses are pointed out before anything runs.
    await dialog.getByRole('textbox', { name: 'Pages, one address per line' }).fill('not an address\nexample.com');
    await expect(dialog.getByText('Line 1 isn’t a web address.')).toBeVisible();
    await expect(dialog.getByTestId('batch-start')).toBeDisabled();
  });
});

async function openToolsMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Tools' }).click();
  return page.getByRole('menu', { name: 'Tools' });
}

test.describe('showcase image', () => {
  test('shows the previews in device frames and saves the image', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await agentsReady(page, '/demo');
    await page.getByRole('button', { name: 'Screenshots' }).click();
    await page.getByRole('menuitem', { name: /^Showcase image/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Showcase image' });
    const image = dialog.getByTestId('showcase-image');
    await expect(image).toBeVisible({ timeout: 20_000 });
    // Three previews picked: phone, tablet and laptop.
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(3);
    const first = await image.getAttribute('src');

    await dialog.getByRole('radio', { name: 'Windows' }).click();
    await expect.poll(() => image.getAttribute('src')).not.toBe(first);
    await dialog.getByRole('radio', { name: 'Square' }).click();
    await dialog.getByRole('checkbox', { name: /Tablet/ }).uncheck();
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2);

    const download = page.waitForEvent('download');
    await dialog.getByTestId('showcase-download').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-showcase_127.0.0.1_\d{8}-\d{6}\.png$/);
    const png = await readFile(await file.path());
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    // A square image, drawn at twice its layout size or more.
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(2800);
    await expect(page.getByText(/Screenshot saved as breakpointer-showcase_/)).toBeVisible();

    // Opened again for the same page, the captures are kept (no new capture).
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    await page.getByTestId('palette-input').fill('showcase');
    await page
      .getByTestId('command-palette')
      .getByRole('option', { name: /Showcase image/ })
      .click();
    await expect(dialog.getByTestId('showcase-image')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Square' })).toBeChecked();
  });
});

test.describe('feedback', () => {
  test('Help links to feedback, the store listing and GitHub, and copies the listing to share', async ({
    openViewer,
  }) => {
    const page = await openViewer();
    await page.evaluate(() => {
      const copies: string[] = [];
      Object.assign(window, { __copies: copies });
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => void copies.push(text),
      });
    });
    await page.keyboard.press('?');
    const support = page.getByRole('dialog', { name: 'Help & keyboard shortcuts' }).getByTestId('help-support');
    await expect(support.getByRole('link', { name: 'Send feedback' })).toHaveAttribute(
      'href',
      'https://github.com/Tanx-1811/breakpointer/issues/new/choose',
    );
    // An unpacked copy rates and shares the published listing.
    const listing = 'https://chromewebstore.google.com/detail/breakpointer/naoadcallefanlcneemohjepkficejjh';
    await expect(support.getByRole('link', { name: 'Rate on the Chrome Web Store' })).toHaveAttribute(
      'href',
      `${listing}/reviews`,
    );
    await expect(support.getByRole('link', { name: 'Star on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Tanx-1811/breakpointer',
    );
    await support.getByRole('button', { name: 'Share Breakpointer' }).click();
    await expect(page.getByText('Link to Breakpointer copied. Thanks for sharing!')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1))).toBe(listing);
    // Copies that weren't installed from a store never get the rating question.
    await expect(page.getByTestId('rate-nudge')).toHaveCount(0);
  });
});
