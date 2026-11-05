import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

test.describe('v0.12', () => {
  test('the toolkit’s grid, image markup and media query tools work at the previews’ sizes', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.keyboard.press('u');
    const dialog = page.getByRole('dialog', { name: 'CSS toolkit' });
    await dialog.getByRole('tab', { name: 'Grid' }).click();
    // 375, 768 and 1366 px: 1, 2 and 4 columns of at least 240 px.
    await expect(dialog.getByTestId('grid-columns')).toHaveText(['1', '2', '4']);
    expect(await seriousViolations(page)).toEqual([]);
    await dialog.getByRole('tab', { name: 'Images' }).click();
    await expect(dialog.getByTestId('images-code')).toContainText('<source type="image/avif"');
    expect(await seriousViolations(page)).toEqual([]);
    await dialog.getByRole('tab', { name: 'Queries' }).click();
    await dialog.getByTestId('queries-input').fill('(max-width: 800px)');
    await expect(dialog.getByTestId('queries-summary')).toHaveText('Applies in 2 of 3 viewports');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('the Images tab gives tips about formats and reserved space', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/images') });
    await agentsReady(page, '/images');
    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await audit.getByRole('tab', { name: 'Images' }).click();
    await expect(audit.getByTestId('images-summary')).toContainText('tips');
    // The large photo (the logo, shown small, has no format tip).
    const tips = audit.getByTestId('image-tips').filter({ hasText: 'A PNG file' });
    await expect(tips).toContainText('A PNG file');
    await expect(tips).toContainText('No width and height attributes');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('the score card shows the page’s score on earlier days, and forgets it', async ({ openViewer, server }) => {
    const url = server.url('/responsive');
    const page = await openViewer({ url });
    // Yesterday's score for this page, under the key the workspace makes from its address.
    await page.evaluate(async (address) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
      const key = [...new Uint8Array(digest)]
        .slice(0, 8)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      const yesterday = new Date(Date.now() - 86_400_000);
      const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
        yesterday.getDate(),
      ).padStart(2, '0')}`;
      await chrome.storage.local.set({ 'breakpointer.scores': { [key]: [{ day, score: 40, sizes: 3 }] } });
    }, url);
    await page.reload();
    await agentsReady(page, '/responsive');
    await page.keyboard.press('e');
    const history = page.getByTestId('score-history');
    // Today's score is recorded a few seconds after every preview has checked the page.
    await expect(history).toContainText('since', { timeout: 15_000 });
    await expect(history).toContainText('2 days');
    expect(await seriousViolations(page)).toEqual([]);
    await history.getByRole('button', { name: 'Forget the score history' }).click();
    await expect(history).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(async () => (await chrome.storage.local.get('breakpointer.scores'))['breakpointer.scores']),
      )
      .toBeUndefined();
  });

  test('a screenshot is annotated, a private area hidden, and the image saved', async ({ openViewer, server }) => {
    // Capturing every preview takes a few seconds (Chrome allows two captures a second).
    test.setTimeout(90_000);
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.getByRole('button', { name: 'Screenshots' }).click();
    await page.getByRole('menuitem', { name: /Annotate a screenshot/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Annotate screenshot' });
    const canvas = dialog.getByTestId('markup-canvas');
    await expect(canvas).toBeVisible({ timeout: 20_000 });
    await expect(canvas).toHaveAccessibleName('Screenshot, no marks yet');
    const box = (await canvas.boundingBox())!;
    const drag = async (from: [number, number], to: [number, number]) => {
      await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 6 });
      await page.mouse.up();
    };
    await drag([0.2, 0.3], [0.5, 0.5]);
    await expect(canvas).toHaveAccessibleName('Screenshot with 1 mark');
    await dialog.getByRole('radio', { name: 'Hide (pixelate)' }).click();
    await drag([0.6, 0.2], [0.8, 0.4]);
    await expect(canvas).toHaveAccessibleName('Screenshot with 2 marks');
    await dialog.getByTestId('markup-undo').click();
    await expect(canvas).toHaveAccessibleName('Screenshot with 1 mark');
    await dialog.getByTestId('markup-redo').click();
    await expect(canvas).toHaveAccessibleName('Screenshot with 2 marks');
    expect(await seriousViolations(page)).toEqual([]);
    const download = page.waitForEvent('download');
    await dialog.getByTestId('markup-save').click();
    expect((await download).suggestedFilename()).toMatch(/^breakpointer-annotated_.+\.png$/);
  });
});
