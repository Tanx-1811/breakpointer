import { resolve } from 'node:path';
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { startTestServer, type TestServer } from './test-server';

export type ExtensionOptions = {
  /** Build folder of the extension to load, relative to the project root. */
  extensionDir: string;
};

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  viewerUrl: (params?: Record<string, string>) => string;
  /** Opens the viewer and waits until the app has rendered. */
  openViewer: (params?: Record<string, string>) => Promise<Page>;
};

type WorkerFixtures = ExtensionOptions & { server: TestServer };

export const test = base.extend<Fixtures, WorkerFixtures>({
  extensionDir: ['dist-e2e', { option: true, scope: 'worker' }],

  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      const server = await startTestServer();
      await provide(server);
      await server.close();
    },
    { scope: 'worker' },
  ],

  context: async ({ extensionDir }, provide) => {
    const path = resolve(import.meta.dirname, '../..', extensionDir);
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
      args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
    });
    await provide(context);
    await context.close();
  },

  extensionId: async ({ context }, provide) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    await provide(new URL(worker.url()).host);
  },

  viewerUrl: async ({ extensionId }, provide) => {
    await provide((params = {}) => {
      const query = new URLSearchParams(params).toString();
      return `chrome-extension://${extensionId}/viewer/viewer.html${query ? `?${query}` : ''}`;
    });
  },

  openViewer: async ({ context, viewerUrl }, provide) => {
    await provide(async (params) => {
      // Reuse the blank first tab the persistent context opens with.
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(viewerUrl(params));
      await page.locator('html[data-ready]').waitFor({ state: 'attached' });
      return page;
    });
  },
});

export const expect = test.expect;
