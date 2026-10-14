import { expect, test } from './fixtures';
import { previewFrames, previewWidths } from './helpers';

// The production build without host access: preview requests are left exactly as Chrome sends them.
test('without access to the site, preview requests are not changed', async ({ openViewer, server }) => {
  const page = await openViewer({ url: server.url('/fetch-metadata') });
  await expect.poll(() => previewWidths(page, '/fetch-metadata')).toEqual([375, 768, 1366]);
  const titles = () =>
    Promise.all(
      previewFrames(page, '/fetch-metadata').map((frame) => frame.evaluate(() => document.title).catch(() => '')),
    );
  await expect.poll(titles).toEqual(['Error', 'Error', 'Error']);
});
