import type { Frame } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Milestone 1 spike, kept as a regression test: can an extension page render
 * arbitrary sites at a real layout viewport? Covers a page that allows
 * framing, two ways of blocking it, and a frame-busting script. This build has
 * host access, as when the user chooses "Allow on this site".
 */
const layoutOf = (frame: Frame) =>
  frame.evaluate(() => ({
    width: window.innerWidth,
    layout: getComputedStyle(document.getElementById('layout')!, '::after').content.replaceAll('"', ''),
  }));

for (const path of ['/responsive', '/xfo-deny', '/csp-frame-ancestors', '/framebust']) {
  test(`spike: ${path} renders with real media queries`, async ({ openViewer, server }) => {
    const page = await openViewer({ url: server.url(path) });
    const frames = () => page.frames().filter((frame) => frame.url().includes(path));
    await expect.poll(() => frames().length).toBe(3);
    await expect
      .poll(async () => (await Promise.all(frames().map(layoutOf))).sort((a, b) => a.width - b.width))
      .toEqual([
        { width: 375, layout: 'mobile' },
        { width: 768, layout: 'tablet' },
        { width: 1366, layout: 'desktop' },
      ]);
    expect(page.url()).toContain('chrome-extension://');
  });
}
