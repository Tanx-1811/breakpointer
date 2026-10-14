import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import {
  agentsReady,
  card,
  clickInFrame,
  frameAt,
  openTools,
  previewFrames,
  previewWidths,
  storedSettings,
  visualCardNames,
} from './helpers';

test.describe('command palette', () => {
  test('finds and runs commands, and previews a typed address', async ({ openViewer, server }) => {
    const page = await openViewer();
    await page.keyboard.press('Control+k');
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    await expect(page.getByTestId('palette-input')).toBeFocused();
    await page.keyboard.type('large tablet');
    await expect(palette.getByRole('option').first()).toContainText('Add Large tablet');
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);

    await page.keyboard.press('k');
    await expect(palette).toBeVisible();
    await page.keyboard.type(server.url('/demo').replace('http://', ''));
    await expect(palette.getByRole('option').first()).toContainText(`Preview ${server.url('/demo')}`);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('address-input')).toHaveValue(server.url('/demo'));
    await expect.poll(() => previewWidths(page, '/demo')).toHaveLength(4);
  });
});

test.describe('history', () => {
  test('back and forward move between previewed pages', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/demo') });
    const back = page.getByRole('button', { name: 'Back to the previous page' });
    const forward = page.getByRole('button', { name: 'Forward to the next page' });
    await expect(back).toBeDisabled();
    const input = page.getByTestId('address-input');
    await input.fill(server.url('/responsive'));
    await input.press('Enter');
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);

    await back.click();
    await expect(input).toHaveValue(server.url('/demo'));
    await expect.poll(() => previewWidths(page, '/demo')).toEqual([375, 768, 1366]);
    expect(new URL(page.url()).searchParams.get('url')).toBe(server.url('/demo'));
    await expect(back).toBeDisabled();

    await forward.click();
    await expect(input).toHaveValue(server.url('/responsive'));
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
  });

  test('suggests saved pages in the address bar', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByTestId('save-page').click();
    const input = page.getByTestId('address-input');
    await input.fill(server.url('/demo'));
    await input.press('Enter');
    await expect(input).toHaveValue(server.url('/demo'));
    await page.locator('body').click({ position: { x: 5, y: 400 } });
    await page.keyboard.press('/');
    const list = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue(server.url('/responsive'));
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
  });
});

test.describe('resizing', () => {
  test('drag an edge to resize, snapping to breakpoints, or use the keyboard', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await page.getByRole('combobox', { name: 'Breakpoints' }).selectOption('tailwind');
    const phone = card(page, 'Phone');
    const width = phone.getByRole('spinbutton', { name: 'Width in pixels' });
    await expect.poll(() => previewWidths(page, '/responsive')).toEqual([375, 768, 1366]);
    // Let the first-run fit settle before measuring.
    await page.waitForTimeout(500);
    const frame = (await phone.getByTestId('preview-frame').boundingBox())!;
    const zoom = frame.width / 375;
    await phone.hover();
    const handle = (await phone.getByTestId('resize-width').boundingBox())!;
    const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // A few pixels short of sm (640): it snaps.
    await page.mouse.move(start.x + (637 - 375) * zoom, start.y, { steps: 6 });
    await expect(phone.getByTestId('resize-size')).toContainText('640 × 667');
    await expect(phone.getByTestId('resize-size')).toContainText('sm');
    await page.mouse.up();
    await expect(width).toHaveValue('640');
    await expect.poll(() => previewWidths(page, '/responsive')).toContain(640);

    const separator = phone.getByRole('separator', { name: 'Width of Phone' });
    await separator.focus();
    await page.keyboard.press('ArrowRight');
    await expect(width).toHaveValue('641');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(width).toHaveValue('631');
    await expect.poll(async () => ((await storedSettings(page))?.viewports as { width: number }[])[0]?.width).toBe(631);
  });
});

test.describe('focus mode', () => {
  test('show one viewport on its own, without reloading the others', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/counter') });
    await expect.poll(() => previewFrames(page, '/counter').length).toBe(3);
    const titles = async () =>
      (await Promise.all(previewFrames(page, '/counter').map((frame) => frame.locator('h1').textContent()))).sort();
    await expect.poll(async () => (await titles()).every((title) => title?.startsWith('Load'))).toBe(true);
    const before = await titles();

    await card(page, 'Tablet').getByRole('button', { name: 'More actions for Tablet' }).click();
    await page.getByRole('menuitem', { name: 'Focus on this viewport' }).click();
    await expect(page.getByTestId('focus-status')).toContainText('Tablet');
    await expect(card(page, 'Phone')).toBeHidden();
    await expect(card(page, 'Tablet')).toBeVisible();
    // The focused preview is shown larger than before.
    const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
    await expect(zoom).not.toHaveValue('none');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('focus-status')).toHaveCount(0);
    await expect(card(page, 'Phone')).toBeVisible();
    expect(await titles()).toEqual(before);
  });
});

test.describe('site breakpoints', () => {
  test('label viewports with the page’s own breakpoints and test their edges', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    const select = page.getByRole('combobox', { name: 'Breakpoints' });
    // /responsive switches its layout at 768px and 1024px.
    await expect(select.locator('option[value="site"]')).toHaveText('This site (2)');
    await select.selectOption('site');
    await expect(page.getByTestId('breakpoint-badge')).toHaveText(['<768', '≥768', '≥1024']);

    await (await openTools(page)).getByRole('menuitem', { name: 'Test breakpoint edges' }).click();
    await expect(page.getByTestId('viewport-card')).toHaveCount(4);
    await expect(card(page, '767px')).toBeVisible();
    await expect(card(page, '1024px')).toBeVisible();
    await expect(page.getByTestId('breakpoint-badge')).toHaveText(['<768', '≥768', '≥768', '≥1024']);
  });
});

test.describe('inspector', () => {
  test('pick an element in one preview and compare it at every size', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/inspect') });
    await agentsReady(page, '/inspect');
    await page.keyboard.press('i');
    await expect(page.getByTestId('inspect-status')).toBeVisible();
    const panel = page.getByTestId('inspector');
    await expect(panel).toBeVisible();

    // While picking, a click selects instead of following the link.
    await clickInFrame(page, await frameAt(page, '/inspect', 375), '#away', async () =>
      (await panel.textContent())!.includes('main > a#away'),
    );
    await expect(panel).toContainText('main > a#away');
    expect(await previewWidths(page, '/linked')).toEqual([]);

    await page.getByRole('button', { name: 'Pick an element' }).click();
    await clickInFrame(page, await frameAt(page, '/inspect', 375), '#target', async () =>
      (await panel.textContent())!.includes('main > div#target'),
    );
    await expect(panel).toContainText('main > div#target');
    await expect(panel.getByTestId('inspector-size')).toHaveCount(3);
    // Its display changes at 768px.
    await expect(panel.locator('[data-changed] dt').first()).toHaveText('Display');
    await expect(page.getByTestId('inspect-status')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});

test.describe('page colours', () => {
  test('show the page’s dark styles in one preview', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/scheme') });
    await agentsReady(page, '/scheme');
    const background = async (width: number) =>
      (await frameAt(page, '/scheme', width))
        .evaluate(() => getComputedStyle(document.body).backgroundColor)
        .catch(() => '');
    await expect.poll(() => background(375)).toBe('rgb(255, 255, 255)');

    await card(page, 'Phone').getByRole('button', { name: 'More actions for Phone' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect.poll(() => background(375)).toBe('rgb(0, 0, 0)');
    expect(await background(768)).toBe('rgb(255, 255, 255)');
    await expect(card(page, 'Phone').getByTestId('scheme-badge')).toBeVisible();

    // Kept with the viewport, and applied again to a reloaded preview.
    await card(page, 'Phone').getByRole('button', { name: 'Reload Phone' }).click();
    await expect.poll(() => background(375)).toBe('rgb(0, 0, 0)');
    await expect
      .poll(async () => ((await storedSettings(page))?.viewports as { colorScheme?: string }[])[0]?.colorScheme)
      .toBe('dark');

    await card(page, 'Phone').getByRole('button', { name: 'More actions for Phone' }).click();
    await page.getByRole('menuitemradio', { name: 'Like the browser' }).click();
    await expect.poll(() => background(375)).toBe('rgb(255, 255, 255)');
  });
});

test.describe('page colours, declared in CSS', () => {
  test('a dark override holds steady when the page declares its schemes in CSS only', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/scheme-css') });
    await agentsReady(page, '/scheme-css');
    await card(page, 'Phone').getByRole('button', { name: 'More actions for Phone' }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    const phone = await frameAt(page, '/scheme-css', 375);
    const state = () =>
      phone.evaluate(() => [
        getComputedStyle(document.body).backgroundColor,
        getComputedStyle(document.documentElement).colorScheme,
      ]);
    await expect.poll(state).toEqual(['rgb(0, 0, 0)', 'dark']);
    // It stays so (no switching back and forth as the page's styles are re-read).
    for (let sample = 0; sample < 8; sample++) {
      await page.waitForTimeout(200);
      expect(await state()).toEqual(['rgb(0, 0, 0)', 'dark']);
    }
  });
});

test.describe('scrollbars', () => {
  test('hide the previews’ scrollbars like on phones', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/long') });
    await agentsReady(page, '/long');
    const hidden = (frame: Awaited<ReturnType<typeof frameAt>>) =>
      frame.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth);
    const phone = await frameAt(page, '/long', 375);
    expect(await hidden(phone)).toBe('auto');
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: 'Hide scrollbars' }).click();
    await page.keyboard.press('Escape');
    for (const frame of previewFrames(page, '/long')) await expect.poll(() => hidden(frame)).toBe('none');
  });
});

test.describe('capture and arrange', () => {
  test('save every viewport in one image', async ({ openViewer, server }, testInfo) => {
    const page = await openViewer({ url: server.url('/demo') });
    await expect.poll(() => previewWidths(page, '/demo')).toEqual([375, 768, 1366]);
    const download = page.waitForEvent('download', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Screenshots' }).click();
    await page.getByRole('menuitem', { name: /All viewports in one image/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-all_127.0.0.1_\d{8}-\d{6}\.png$/);
    const path = testInfo.outputPath('all.png');
    await file.saveAs(path);
    const png = await readFile(path);
    expect([...png.subarray(1, 4)].map((byte) => String.fromCharCode(byte)).join('')).toBe('PNG');
    await expect(page.getByText(/Screenshot saved as breakpointer-all_/)).toBeVisible();
  });

  test('sort viewports by width, with undo', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByRole('button', { name: /^Phone, 375 × 667$/ }).focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(() => visualCardNames(page)).toEqual(['Tablet', 'Phone', 'Laptop']);
    await (await openTools(page)).getByRole('menuitem', { name: 'Sort by width' }).click();
    await expect.poll(() => visualCardNames(page)).toEqual(['Phone', 'Tablet', 'Laptop']);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => visualCardNames(page)).toEqual(['Tablet', 'Phone', 'Laptop']);
  });
});

test.describe('input to the previews', () => {
  test('on a first run, the previews start at the zoom that fits the screen', async ({
    context,
    openViewer,
    server,
  }) => {
    // Frames resized just as they finish loading can stop getting clicks, so the fit comes first.
    await context.addInitScript(() => {
      if (location.protocol !== 'chrome-extension:') return;
      const changes: string[] = [];
      Object.assign(window, { frameStyleChanges: changes });
      new MutationObserver((records) => {
        for (const record of records)
          if (record.target instanceof HTMLIFrameElement) changes.push(record.target.style.cssText);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });
    });
    const page = await openViewer({ url: server.url('/demo') });
    await agentsReady(page, '/demo');
    const zooms = await page
      .getByTestId('preview-frame')
      .evaluateAll((frames) => frames.map((frame) => (frame as HTMLIFrameElement).style.transform));
    expect(zooms.every((zoom) => zoom === zooms[0] && zoom !== 'scale(1)')).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { frameStyleChanges: string[] }).frameStyleChanges)).toEqual(
      [],
    );
  });

  test('input aimed at a preview that reaches the workspace makes the previews refresh', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/demo') });
    await agentsReady(page, '/demo');
    // Chrome delivers such input to the workspace, aimed at the <iframe> element.
    const states = await page.evaluate(async () => {
      const frames = [...document.querySelectorAll<HTMLIFrameElement>('[data-testid="preview-frame"]')];
      const seen: string[] = [];
      const observer = new MutationObserver(() => seen.push(frames.map((frame) => frame.style.translate).join('|')));
      observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });
      frames[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((done) => setTimeout(done, 300));
      observer.disconnect();
      return seen;
    });
    // Every preview moved by a hundredth of a pixel, then back.
    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(states[0].split('|').every((value) => value.startsWith('0.01px'))).toBe(true);
    expect(states.at(-1)).toBe('||');
  });
});
