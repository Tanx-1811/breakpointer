import { expect, test } from './fixtures';
import { agentsReady, storedSettings } from './helpers';

// Temporary: screenshots of the Chinese and Russian UI for a review (not part of the suite).
for (const language of ['ru', 'zh-CN']) {
  test(`look: ${language}`, async ({ openViewer, server }) => {
    const page = await openViewer();
    await expect.poll(async () => Boolean(await storedSettings(page))).toBe(true);
    await page.evaluate(
      (value) => chrome.storage.local.set({ 'breakpointer.settings': value }),
      { version: 1, language, theme: 'light', breakpoints: 'tailwind', panels: { sidebar: true, statusBar: true, minimap: true } },
    );
    await page.goto(page.url().split('?')[0] + `?url=${encodeURIComponent(server.url('/issues'))}`);
    await page.locator('html[data-ready]').waitFor({ state: 'attached' });
    await agentsReady(page, '/issues');
    await page.keyboard.press('e');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.LOOK_OUT}/lang-${language}.png` });
    await page.keyboard.press('e');
    await page.keyboard.press('Shift+Slash');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.LOOK_OUT}/lang-${language}-help.png` });
  });
}
