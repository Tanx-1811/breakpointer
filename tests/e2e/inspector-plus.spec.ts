import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import { agentsReady, clickInFrame, frameAt, openTools } from './helpers';

test.describe('inspector and layout tools', () => {
  test('the inspected element is captured at every size in one image', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/inspect') });
    await agentsReady(page, '/inspect');
    await page.keyboard.press('i');
    const panel = page.getByTestId('inspector');
    await clickInFrame(page, await frameAt(page, '/inspect', 768), '#target', async () =>
      (await panel.textContent())!.includes('main > div#target'),
    );
    await expect(panel.getByTestId('inspector-size')).toHaveCount(3);

    const download = page.waitForEvent('download');
    await panel.getByTestId('inspector-capture').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-element_127.0.0.1_main-div-target_\d{8}-\d{6}\.png$/);
    const png = await readFile(await file.path());
    // A sheet of three element crops: wider than one crop, far smaller than a whole preview.
    expect(png.readUInt32BE(16)).toBeGreaterThan(300);
    await expect(page.getByText(/Screenshot saved as breakpointer-element_/)).toBeVisible();
    // The workspace is back as it was (not left focused on the last preview).
    await expect(page.getByTestId('focus-status')).toHaveCount(0);
  });

  test('grid and flex containers are labelled in the page', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/audit') });
    await agentsReady(page, '/audit');
    const labels = async () =>
      (await frameAt(page, '/audit', 1366)).evaluate(
        () => document.querySelector('[data-breakpointer-overlay][data-labels]')?.getAttribute('data-labels') ?? null,
      );
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: /^Grid & flex layouts/ }).click();
    await page.keyboard.press('Escape');
    // Only what is in view is labelled: the grid of cards and the flex row are at the bottom.
    await (await frameAt(page, '/audit', 1366)).evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(labels).toBe('2');
    await (await openTools(page)).getByRole('menuitemcheckbox', { name: /^Grid & flex layouts/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(labels).toBeNull();
  });
});
