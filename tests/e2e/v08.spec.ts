import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, card, clickInFrame, frameAt } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

/** Collects what the page copies to the clipboard. */
async function catchCopies(page: Page) {
  await page.evaluate(() => {
    const copies: string[] = [];
    Object.assign(window, { __copies: copies });
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => void copies.push(text),
    });
  });
  return () => page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.at(-1) ?? '');
}

test.describe('v0.8', () => {
  test('the audit sizes each image and collects the page’s colours', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/images') });
    await agentsReady(page, '/images');
    const lastCopy = await catchCopies(page);
    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');

    await audit.getByRole('tab', { name: 'Images' }).click();
    const rows = audit.getByTestId('image-row');
    await expect(rows).toHaveCount(2);
    // The logo shows a 1600 px file at 120 px: it wastes the most, so it comes first.
    await expect(rows.first()).toContainText('photo.png');
    await expect(rows.first()).toContainText('Shown 120 px · file 1600 px');
    await expect(rows.first().getByText('Too large').first()).toBeVisible();
    await expect(rows.first()).toContainText('One file');
    await expect(rows.nth(1).getByTestId('image-sizes')).toContainText('vw');
    await expect(audit.getByTestId('images-summary')).toContainText('2 images');
    expect(await seriousViolations(page)).toEqual([]);
    await rows.first().getByRole('button', { name: 'Copy srcset and sizes' }).click();
    await expect(page.getByText('srcset and sizes copied')).toBeVisible();
    expect(await lastCopy()).toMatch(/^srcset="photo-120\.png 120w, photo-240\.png 240w"\nsizes="120px"$/);

    await audit.getByRole('tab', { name: 'Colours' }).click();
    await expect(audit.getByTestId('colors-summary')).toBeVisible();
    await expect(audit.locator('[data-hex="#0055aa"]')).toBeVisible();
    await expect(audit.getByRole('region', { name: 'Text' }).locator('[data-hex="#111111"]')).toBeVisible();
    await expect(audit.getByRole('region', { name: 'Borders' }).locator('[data-hex="#003377"]')).toBeVisible();
    await audit.getByRole('button', { name: 'Copy as CSS variables' }).click();
    expect(await lastCopy()).toContain(': #0055aa; /*');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('performance budgets come with Pro and mark previews over them', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/images') });
    await agentsReady(page, '/images');

    // On the free plan the budgets are shown but locked.
    await page.getByRole('button', { name: 'Settings' }).click();
    let settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings.getByTestId('budgets').getByRole('spinbutton', { name: 'Requests' })).toBeDisabled();
    await settings.getByTestId('budgets').getByRole('button', { name: 'See Pro' }).click();
    await expect(page.getByRole('dialog', { name: 'Breakpointer Pro' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Breakpointer Pro' }).getByTestId('start-trial').click();
    await expect(page.getByTestId('pro-button')).toHaveAccessibleName('Pro trial, 7 days left');

    // The page loads two files after the document: a limit of one is exceeded at every size.
    if (!(await page.getByRole('dialog', { name: 'Settings' }).isVisible()))
      await page.getByRole('button', { name: 'Settings' }).click();
    settings = page.getByRole('dialog', { name: 'Settings' });
    const requests = settings.getByTestId('budgets').getByRole('spinbutton', { name: 'Requests' });
    await requests.fill('1');
    await requests.press('Enter');
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();

    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await audit.getByRole('tab', { name: 'Performance' }).click();
    await expect(audit.getByTestId('budget-summary')).toContainText('1 budget exceeded');
    await expect(audit.locator('[data-over-budget]')).toHaveCount(3);
    await expect(audit.getByTestId('budget-limit')).toHaveText('Budget: 1');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('the inspector measures the distance to a second element at every size', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/inspect') });
    await agentsReady(page, '/inspect');
    const lastCopy = await catchCopies(page);
    await page.keyboard.press('i');
    const panel = page.getByTestId('inspector');
    await clickInFrame(page, await frameAt(page, '/inspect', 768), '#target', async () =>
      (await panel.textContent())!.includes('main > div#target'),
    );

    await panel.getByTestId('inspector-distance-pick').click();
    await expect(page.getByTestId('inspect-status')).toContainText('Click a second element');
    await clickInFrame(
      page,
      await frameAt(page, '/inspect', 768),
      '#away',
      async () => (await panel.getByTestId('inspector-distance').count()) > 0,
    );
    await expect(panel.getByTestId('inspector-distance')).toContainText('Distance to main > a#away');
    // The link is below the box at every size.
    const gaps = panel.getByTestId('inspector-gap');
    await expect(gaps).toHaveCount(3);
    for (const gap of await gaps.all()) await expect(gap).toHaveText(/↕ \d+(\.\d)? px/);
    // The first element is still the one inspected.
    await expect(panel).toContainText('main > div#target');
    expect(await seriousViolations(page)).toEqual([]);

    await panel.getByRole('button', { name: 'Copy table' }).click();
    expect(await lastCopy()).toContain('| Distance to main > a#away |');

    await panel.getByRole('button', { name: 'Remove the distance' }).click();
    await expect(panel.getByTestId('inspector-gap')).toHaveCount(0);
  });

  test('a tour walks through the workspace from the welcome screen and Help', async ({ openViewer }) => {
    const page = await openViewer();
    await page.getByTestId('welcome-tour').click();
    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible();
    await expect(tour).toContainText('Open any page');
    await expect(tour).toContainText(/Step 1 of \d+/);
    await expect(tour.getByRole('button', { name: 'Next' })).toBeFocused();
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('ArrowRight');
    await expect(tour).toContainText('Your viewports');
    await tour.getByRole('button', { name: 'Back' }).click();
    await expect(tour).toContainText('Open any page');
    // Escape ends it, and the workspace's shortcuts work again.
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);
    await expect(page.getByTestId('welcome-tour')).toBeFocused();

    await page.getByTestId('help-button').click();
    await page.getByRole('dialog', { name: /Help/ }).getByTestId('help-tour').click();
    await expect(page.getByRole('dialog', { name: /Help/ })).toBeHidden();
    await expect(tour).toBeVisible();
    // Each step points at a control that is shown; the last one is Help.
    const steps = Number((await tour.textContent())!.match(/Step 1 of (\d+)/)![1]);
    for (let step = 1; step < steps; step++) await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('Help');
    await tour.getByRole('button', { name: 'Done' }).click();
    await expect(tour).toHaveCount(0);
  });

  test('notes are saved with the previews as one image', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await page.keyboard.press('n');
    await card(page, 'Phone')
      .getByTestId('notes-overlay')
      .click({ position: { x: 40, y: 60 } });
    await page.keyboard.type('Logo overlaps the menu');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('notes-status')).toContainText('1 note on this page');

    const download = page.waitForEvent('download');
    await page.getByTestId('notes-save-image').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^breakpointer-all_127.0.0.1_\d{8}-\d{6}\.png$/);
    // The note is still there, closed.
    await expect(card(page, 'Phone').getByTestId('note-pin')).toHaveCount(1);
    await expect(page.getByTestId('note-editor')).toHaveCount(0);
  });
});
