import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { card, previewFrames, previewWidths, storedSettings } from './helpers';

test.describe('previews', () => {
  test('render each page at the real viewport width', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);
    await expect.poll(() => previewWidths(page, '/demo')).toEqual([375, 768, 1366]);
    // Media queries respond to the real width: the demo shows a burger menu below 1024px.
    const burgers = await Promise.all(
      previewFrames(page, '/demo').map((frame) =>
        frame.evaluate(() => [window.innerWidth, getComputedStyle(document.querySelector('.burger')!).display]),
      ),
    );
    expect(burgers.sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
      [375, 'grid'],
      [768, 'grid'],
      [1366, 'none'],
    ]);
  });

  test('show sites that block framing once access is granted', async ({ openViewer, server }) => {
    for (const path of ['/xfo-deny', '/csp-frame-ancestors']) {
      const page = await openViewer({ url: server.url(path) });
      await expect.poll(() => previewWidths(page, path)).toEqual([375, 768, 1366]);
      await expect(page.getByTestId('embed-notice')).toHaveCount(0);
    }
  });

  test('frame-busting scripts cannot replace the workspace', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/framebust') });
    await expect.poll(() => previewWidths(page, '/framebust')).toEqual([375, 768, 1366]);
    expect(page.url()).toContain('chrome-extension://');
  });

  test('reload a single preview', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/counter') });
    await expect.poll(() => previewFrames(page, '/counter').length).toBe(3);
    const loads = async () => {
      const titles = await Promise.all(
        previewFrames(page, '/counter').map((frame) =>
          frame.evaluate(() => [window.innerWidth, document.querySelector('h1')?.textContent ?? '']),
        ),
      );
      return new Map(titles.map(([width, title]) => [width, title]));
    };
    await expect.poll(async () => (await loads()).size).toBe(3);
    const before = await loads();
    await card(page, 'Phone').getByRole('button', { name: 'Reload Phone' }).click();
    await expect.poll(async () => (await loads()).get(375)).not.toBe(before.get(375));
    const after = await loads();
    expect(after.get(768)).toBe(before.get(768));
    expect(after.get(1366)).toBe(before.get(1366));
  });
});

test.describe('address bar', () => {
  test('rejects invalid addresses with a helpful message', async ({ openViewer }) => {
    const page = await openViewer();
    const input = page.getByRole('textbox', { name: 'Website address' });
    await input.fill('chrome://settings');
    await input.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('Only http:// and https:// pages can be previewed.');
    await input.fill('not a website');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('doesn’t look like a website address');
    await expect(page.getByTestId('preview-frame')).toHaveCount(0);
  });

  test('accepts bare hosts and keeps the address in the URL', async ({ openViewer, server }) => {
    const page = await openViewer();
    const input = page.getByRole('textbox', { name: 'Website address' });
    await input.fill(server.url('/demo').replace('http://', ''));
    await input.press('Enter');
    await expect(page.getByTestId('preview-frame')).toHaveCount(3);
    expect(new URL(page.url()).searchParams.get('url')).toBe(server.url('/demo'));
    await expect(page).toHaveTitle(/127\.0\.0\.1 — Breakpointer/);
  });
});

test.describe('viewports', () => {
  test('add a preset, resize, rotate, and remove with undo', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByRole('button', { name: 'Add viewport' }).click();
    await page.getByTestId('preset-tablet-l').click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);

    const large = card(page, 'Large tablet');
    await expect.poll(() => previewWidths(page, '/responsive')).toContain(820);

    const width = large.getByRole('spinbutton', { name: 'Width in pixels' });
    await width.fill('900');
    await width.press('Enter');
    await expect.poll(() => previewWidths(page, '/responsive')).toContain(900);

    await width.fill('50');
    await width.press('Enter');
    await expect(large.getByRole('alert')).toContainText('from 200 to 3840');
    await expect(width).toHaveValue('900');

    await large.getByRole('button', { name: 'Rotate to landscape' }).click();
    await expect(large.getByRole('spinbutton', { name: 'Width in pixels' })).toHaveValue('1180');
    await expect.poll(() => previewWidths(page, '/responsive')).toContain(1180);

    await large.getByRole('button', { name: 'Remove Large tablet' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);
  });

  test('add a custom size and validate it', async ({ openViewer }) => {
    const page = await openViewer();
    await page.keyboard.press('a');
    const dialog = page.getByRole('dialog', { name: 'Add viewport' });
    await dialog.getByRole('spinbutton', { name: 'Width' }).fill('99999');
    await dialog.getByRole('button', { name: 'Add custom viewport' }).click();
    await expect(dialog.getByRole('alert')).toContainText('from 200 to 3840');
    await dialog.getByRole('textbox', { name: 'Name (optional)' }).fill('Kiosk');
    await dialog.getByRole('spinbutton', { name: 'Width' }).fill('1080');
    await dialog.getByRole('spinbutton', { name: 'Height' }).fill('1920');
    await dialog.getByRole('button', { name: 'Add custom viewport' }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, 'Kiosk')).toBeVisible();
  });

  test('rename, duplicate and hide from the card menu', async ({ openViewer }) => {
    const page = await openViewer();
    const phone = card(page, 'Phone');
    await phone.getByRole('button', { name: 'Rename Phone' }).click();
    await page.getByRole('textbox', { name: 'Viewport name' }).fill('Checkout phone');
    await page.keyboard.press('Enter');
    const renamed = card(page, 'Checkout phone');
    await expect(renamed).toBeVisible();

    await renamed.getByRole('button', { name: 'More actions for Checkout phone' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);

    await renamed.first().getByRole('button', { name: 'More actions for Checkout phone' }).click();
    await page.getByRole('menuitem', { name: 'Hide' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
    await expect(page.getByTestId('viewport-chip').and(page.locator('[aria-pressed="false"]'))).toHaveCount(1);
  });

  test('show and hide viewports from the chips', async ({ openViewer }) => {
    const page = await openViewer();
    const chip = page.getByRole('button', { name: /^Tablet, 768 × 1024$/ });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('viewport-card')).toHaveCount(2);
    await chip.click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
  });

  test('reorder with the keyboard on the chips', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByRole('button', { name: /^Phone, 375 × 667$/ }).focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.getByTestId('viewport-chip').first()).toContainText('Tablet');
    await expect(page.getByTestId('viewport-card').first()).toHaveAttribute('aria-label', /^Tablet/);
  });

  test('fit makes every viewport visible at once', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Fit' }).click();
    const viewport = page.viewportSize()!;
    for (const box of await Promise.all((await page.getByTestId('viewport-card').all()).map((c) => c.boundingBox()))) {
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
  });
});

test.describe('groups', () => {
  test('apply a built-in group and undo it', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByRole('button', { name: /Groups/ }).click();
    await page.getByRole('menuitem', { name: /Mobile QA/ }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(5);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
  });

  test('save, persist and delete a group', async ({ openViewer }) => {
    const page = await openViewer();
    await page.keyboard.press('g');
    await page.getByRole('menuitem', { name: 'Save current as group…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save viewport group' });
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Give the group a name.');
    await dialog.getByRole('textbox', { name: 'Group name' }).fill('Checkout QA');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved group “Checkout QA”')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: /Groups/ }).click();
    await expect(page.getByRole('menuitem', { name: /Checkout QA/ })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Manage groups…' }).click();
    await page.getByRole('button', { name: 'Delete Checkout QA' }).click();
    await expect(page.getByRole('dialog', { name: 'Manage groups' })).toContainText('No saved groups yet');
  });
});

test.describe('settings', () => {
  test('persist across reloads', async ({ openViewer }) => {
    const page = await openViewer();
    await page.keyboard.press('a');
    await page.getByTestId('preset-desktop-fhd').click();
    await page.getByRole('radio', { name: 'Row' }).click();
    await expect.poll(async () => (await storedSettings(page))?.layout).toBe('row');
    await page.reload();
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);
    await expect(page.getByRole('radio', { name: 'Row' })).toHaveAttribute('aria-checked', 'true');
  });

  test('recover from malformed stored data', async ({ openViewer }) => {
    const page = await openViewer();
    await page.evaluate(() =>
      chrome.storage.local.set({
        'breakpointer.settings': {
          theme: 42,
          viewports: [{ width: 'wide' }, { width: 500, height: 99999, zoom: 9 }],
          groups: 'x',
        },
      }),
    );
    await page.reload();
    await expect(page.getByTestId('viewport-card')).toHaveCount(1);
    await expect(page.getByRole('spinbutton', { name: 'Height in pixels' })).toHaveValue('3840');
    await page.evaluate(() => chrome.storage.local.set({ 'breakpointer.settings': 'garbage' }));
    await page.reload();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
  });

  test('switch the interface to Vietnamese', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('combobox', { name: 'Language' }).selectOption('vi');
    await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Thêm viewport' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  });

  test('theme, breakpoint labels and rulers', async ({ openViewer }) => {
    const page = await openViewer();
    const html = page.locator('html');
    await page.keyboard.press('t');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('t');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('combobox', { name: 'Breakpoints' }).selectOption('tailwind');
    await expect(page.getByTestId('breakpoint-badge')).toHaveText(['base', 'md', 'xl']);
    await page.getByRole('combobox', { name: 'Breakpoints' }).selectOption('bootstrap');
    await expect(page.getByTestId('breakpoint-badge')).toHaveText(['xs', 'md', 'xl']);

    await page.keyboard.press('m');
    await expect(page.getByRole('button', { name: 'Rulers' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('export and import settings', async ({ openViewer }, testInfo) => {
    const page = await openViewer();
    await page.keyboard.press('a');
    await page.getByTestId('preset-mobile-xl').click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export settings' }).click();
    const file = testInfo.outputPath('settings.json');
    await (await download).saveAs(file);
    const exported = JSON.parse(await readFile(file, 'utf8'));
    expect(exported).toMatchObject({ app: 'Breakpointer', kind: 'settings', version: 1 });
    expect(exported.settings.viewports).toHaveLength(4);
    expect(exported.settings).not.toHaveProperty('recentUrls');

    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(3);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByTestId('import-input').setInputFiles(file);
    await expect(page.getByText('Settings imported')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);

    await page.getByRole('button', { name: 'Settings' }).click();
    await page
      .getByTestId('import-input')
      .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
    await expect(page.getByText('isn’t a Breakpointer settings file')).toBeVisible();
  });

  test('remember recent addresses only when enabled', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await expect.poll(async () => (await storedSettings(page))?.recentUrls).toEqual([]);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('switch', { name: 'Remember recent addresses' }).click();
    await page.keyboard.press('Escape');
    const input = page.getByRole('textbox', { name: 'Website address' });
    await input.fill(server.url('/demo'));
    await input.press('Enter');
    await expect.poll(async () => (await storedSettings(page))?.recentUrls).toEqual([server.url('/demo')]);
  });
});

test.describe('tools', () => {
  test('keyboard shortcuts and help', async ({ openViewer }) => {
    const page = await openViewer();
    await page.locator('body').press('/');
    await expect(page.getByRole('textbox', { name: 'Website address' })).toBeFocused();
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Help & keyboard shortcuts' });
    await expect(help).toBeVisible();
    await expect(help).toContainText('Preview the current page');
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });

  test('screenshot of a single preview', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await expect.poll(() => previewWidths(page, '/demo')).toEqual([375, 768, 1366]);
    const download = page.waitForEvent('download');
    await card(page, 'Phone').getByRole('button', { name: 'Screenshot of Phone' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer_127.0.0.1_phone_375x667_\d{8}-\d{6}\.png$/);
    await expect(page.getByText(/Screenshot saved as/)).toBeVisible();
  });

  test('open a preview in a new tab', async ({ openViewer, server, context }) => {
    const page = await openViewer({ url: server.url('/demo') });
    const opened = context.waitForEvent('page');
    await card(page, 'Tablet').getByRole('button', { name: 'More actions for Tablet' }).click();
    await page.getByRole('menuitem', { name: 'Open in new tab' }).click();
    expect((await opened).url()).toBe(server.url('/demo'));
  });

  test('site access dialog lists the granted access', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await page.getByRole('button', { name: /^Site access/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Site access' });
    await expect(dialog).toContainText('127.0.0.1');
    await expect(dialog).toContainText('Allowed (all sites)');
  });
});
