import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agentsReady, frameAt, openTools } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('[data-testid="preview-frame"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

const stubClipboard = (page: Page) =>
  page.evaluate(() => {
    const copies: string[] = [];
    Object.assign(window, { __copies: copies });
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async (text: string) => void copies.push(text),
    });
  });

const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copies: string[] }).__copies.join('\n'));

async function openSimulate(page: Page) {
  await page.getByRole('button', { name: 'Simulate' }).click();
  return page.getByRole('menu', { name: 'Simulate' });
}

test.describe('v0.11', () => {
  test('the CSS toolkit works out values at the previews’ sizes and copies them', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/responsive') });
    await agentsReady(page, '/responsive');
    await stubClipboard(page);
    await page.keyboard.press('u');
    const dialog = page.getByRole('dialog', { name: 'CSS toolkit' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Use my previews’ widths' }).click();
    await expect(dialog.getByTestId('fluid-min-viewport')).toHaveValue('375');
    await expect(dialog.getByTestId('fluid-max-viewport')).toHaveValue('1366');
    await expect(dialog.getByTestId('fluid-code')).toContainText('font-size: clamp(1rem,');
    expect(await seriousViolations(page)).toEqual([]);

    for (const name of ['Units', 'Breakpoints', 'Colours', 'Aspect ratio']) {
      await dialog.getByRole('tab', { name }).click();
      expect(await seriousViolations(page), name).toEqual([]);
    }
    await dialog.getByRole('tab', { name: 'Breakpoints' }).click();
    await dialog.getByTestId('code-format').selectOption('scss');
    await dialog.getByRole('button', { name: 'Copy' }).click();
    await expect.poll(() => copied(page)).toContain('@mixin up($name)');

    // Tools opens it too, where it was left.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    const tools = await openTools(page);
    await tools.getByRole('menuitem', { name: /CSS toolkit/ }).click();
    await expect(dialog.getByRole('tab', { name: 'Breakpoints' })).toHaveAttribute('aria-selected', 'true');
  });

  test('touch-screen styles use the page’s CSS for touch screens, and go away', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/v11') });
    await agentsReady(page, '/v11');
    const phone = await frameAt(page, '/v11', 375);
    // Only a browser with a mouse has hover styles to swap.
    test.skip(
      !(await phone.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)),
      'no fine pointer',
    );
    const color = async () =>
      (await frameAt(page, '/v11', 375)).evaluate(() => getComputedStyle(document.querySelector('#touch')!).color);
    expect(await color()).toBe('rgb(200, 0, 0)');
    await (await openSimulate(page)).getByRole('menuitemcheckbox', { name: /^Touch-screen styles/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(color).toBe('rgb(0, 128, 0)');
    await (await openSimulate(page)).getByRole('menuitemcheckbox', { name: /^Touch-screen styles/ }).click();
    await page.keyboard.press('Escape');
    await expect.poll(color).toBe('rgb(200, 0, 0)');
  });

  test('long lines are flagged on wide screens only, and the score copies as a badge', async ({
    openViewer,
    server,
  }) => {
    const page = await openViewer({ url: server.url('/v11') });
    await agentsReady(page, '/v11');
    await stubClipboard(page);
    await page.keyboard.press('e');
    const audit = page.getByTestId('audit');
    await expect(audit).toContainText('Long lines of text');
    const group = audit.locator('[data-testid="audit-group"][data-kind="long-lines"]');
    // Only the 1366 px preview: about 169 characters a line there, under 100 at 768 and 375 px.
    await expect(group).toContainText('In 1 of 3');
    await expect(group).toContainText('Laptop');
    await expect(group).toContainText('p#essay');
    await audit.getByTestId('badge-copy').click();
    await expect.poll(() => copied(page)).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('auto-scroll scrolls every preview in present mode until stopped', async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url('/v11') });
    await agentsReady(page, '/v11');
    const scrolled = async () =>
      (await frameAt(page, '/v11', 375)).evaluate(() => Math.round(window.scrollY)).catch(() => 0);
    await page.keyboard.press('d');
    const button = page.getByTestId('present-autoscroll');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(scrolled, { timeout: 5000 }).toBeGreaterThan(100);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    const stoppedAt = await scrolled();
    await page.waitForTimeout(600);
    expect(Math.abs((await scrolled()) - stoppedAt)).toBeLessThan(5);
    expect(await seriousViolations(page)).toEqual([]);
  });
});
