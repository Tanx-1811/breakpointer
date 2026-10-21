// Zips the production build (dist/) into release/breakpointer-<version>.zip for the Chrome Web Store.
//
// Refuses a build that isn't fit for the store: the e2e build (host access at
// install), a build that accepts the public test licence key, or a build without
// a Pro checkout address (set PRO_CHECKOUT_URL in src/utils/links.ts; pass
// --allow-no-checkout to package a release before sales open).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const manifestPath = resolve(dist, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('dist/manifest.json not found. Run `npm run build` first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.host_permissions?.length) {
  console.error('Refusing to package a build with install-time host permissions (is this the e2e build?).');
  process.exit(1);
}

// The test licence key's private half is in the repository: a build that accepts it can be unlocked by anyone.
const testKey = JSON.parse(readFileSync(resolve(root, 'tests/e2e/fixtures/license-test-key.json'), 'utf8'));
const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
const leaking = files(dist).filter(
  (file) => /\.(js|json|html)$/.test(file) && readFileSync(file, 'utf8').includes(testKey.x),
);
if (leaking.length) {
  console.error(`Refusing to package: the test licence key is built into ${leaking.join(', ')}.`);
  process.exit(1);
}

const links = readFileSync(resolve(root, 'src/utils/links.ts'), 'utf8');
const checkout = /export const PRO_CHECKOUT_URL: string = '([^']*)'/.exec(links)?.[1] ?? '';
if (!/^https:\/\//.test(checkout) && !process.argv.includes('--allow-no-checkout')) {
  console.error(
    'Refusing to package: PRO_CHECKOUT_URL in src/utils/links.ts is not set, so nobody could buy Pro.\n' +
      'Set it to the checkout page, or run `npm run package -- --allow-no-checkout` to ship the trial only.',
  );
  process.exit(1);
}

const out = resolve(root, 'release');
mkdirSync(out, { recursive: true });
const file = resolve(out, `breakpointer-${manifest.version}.zip`);
rmSync(file, { force: true });
execFileSync('zip', ['-r', '-X', '-q', file, '.', '-x', '*.map', '-x', '.DS_Store'], { cwd: dist, stdio: 'inherit' });
console.log(`Packaged ${file}`);
