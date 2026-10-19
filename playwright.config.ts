import { defineConfig } from '@playwright/test';
import type { ExtensionOptions } from './tests/e2e/fixtures';

/**
 * Two builds of the extension are tested:
 * - with-access: the e2e build, which has host access up front (as if the user
 *   allowed all sites), so blocked sites, screenshots etc. can be exercised.
 * - no-access: the production build, exactly as installed from the store.
 */
export default defineConfig<ExtensionOptions>({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'with-access', testIgnore: /no-access|store-screenshots|demo-video/, use: { extensionDir: 'dist-e2e' } },
    { name: 'no-access', testMatch: /no-access/, use: { extensionDir: 'dist' } },
    { name: 'screenshots', testMatch: /store-screenshots/, use: { extensionDir: 'dist-e2e' } },
    { name: 'video', testMatch: /demo-video/, use: { extensionDir: 'dist-e2e' } },
  ],
});
