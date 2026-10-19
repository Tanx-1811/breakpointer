/**
 * Builds the Breakpointer landing page: `site/` → `dist-site/` (published by .github/workflows/pages.yml).
 *
 *   node scripts/build-site.mjs
 *   BREAKPOINTER_STORE_URL=https://chromewebstore.google.com/detail/… node scripts/build-site.mjs
 *
 * THE INSTALL BUTTON IS SWITCHED HERE, AND ONLY HERE: `STORE_URL` below.
 * - Set (the default: the Chrome Web Store listing, tagged so the store's dashboard counts visits from this
 *   site): every install button links to the store, says "Add to Chrome — it's free", and has no note.
 * - Empty (BREAKPOINTER_STORE_URL= ): every install button links to the install instructions on GitHub, says
 *   "Get Breakpointer (free)", and a note under it says the store listing is coming soon.
 * Set it with the BREAKPOINTER_STORE_URL environment variable, or change the default after `??`.
 *
 * Tokens replaced in the .html, .xml and .txt files of site/ (English, or Vietnamese for files in site/vi/):
 *   {{installUrl}}        where the install buttons go: STORE_URL, or GitHub's #install section
 *   {{installLabel}}      the main install button's text
 *   {{installLabelShort}} the header's install button text ("Install" / "Add to Chrome")
 *   {{installNote}}       a line under the main install buttons, or nothing (the empty element is hidden by CSS)
 *   {{siteUrl}}           the published address with a trailing slash (canonical, hreflang, Open Graph, sitemap)
 *   {{basePath}}          the path of {{siteUrl}} ("/breakpointer/"), for 404.html's <base>, which is served
 *                         at any depth
 * Values are HTML-escaped (JSON-escaped inside <script type="application/ld+json">). An unknown or leftover
 * {{token}}, or a relative src/href that points to a file missing from dist-site/, fails the build.
 *
 * Other files of site/ are copied as they are, and the brand assets the pages use are copied from brand/ into
 * dist-site/assets/. Node built-ins only.
 */
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE_URL =
  process.env.BREAKPOINTER_STORE_URL ??
  'https://chromewebstore.google.com/detail/naoadcallefanlcneemohjepkficejjh?utm_source=breakpointer-site&utm_medium=website&utm_campaign=landing';

const SITE_URL = 'https://tanx-1811.github.io/breakpointer/';
const GITHUB_INSTALL_URL = 'https://github.com/Tanx-1811/breakpointer#install';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE_DIR = join(ROOT, 'site');
const OUT_DIR = join(ROOT, 'dist-site');

/** Brand files the pages use: [source in the repo, destination in dist-site]. Folders copy their .png files. */
const ASSETS = [
  ['brand/logo/mark.svg', 'assets/mark.svg'],
  ['brand/logo/mark-512.png', 'assets/mark-512.png'],
  ['brand/logo/lockup-horizontal-light.svg', 'assets/lockup-horizontal-light.svg'],
  ['brand/logo/lockup-horizontal-dark.svg', 'assets/lockup-horizontal-dark.svg'],
  ['brand/logo/lockup-horizontal-on-indigo.svg', 'assets/lockup-horizontal-on-indigo.svg'],
  ['brand/social/github-social-1280x640.png', 'assets/og-1280x640.png'],
  ['brand/social/demo.mp4', 'assets/demo.mp4'],
  ['brand/store/screenshots/en', 'assets/screenshots/en'],
  ['brand/store/screenshots/vi', 'assets/screenshots/vi'],
];

/** Files whose {{tokens}} are filled in (render() escapes each value for its file type). */
const TEMPLATED = new Set(['.html', '.xml', '.txt']);

function storeUrl() {
  const value = STORE_URL.trim();
  if (!value) return '';
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`BREAKPOINTER_STORE_URL is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'https:') throw new Error(`BREAKPOINTER_STORE_URL must be an https:// URL: ${value}`);
  return url.href;
}

function tokensFor(lang, store) {
  // A no-break space (\u00a0) keeps "miễn phí" ("free") on one line when a label wraps on a narrow phone.
  const install = store
    ? {
        en: { installLabel: 'Add to Chrome — it’s free', installLabelShort: 'Add to Chrome', installNote: '' },
        vi: { installLabel: 'Thêm vào Chrome — miễn\u00a0phí', installLabelShort: 'Thêm vào Chrome', installNote: '' },
      }
    : {
        en: {
          installLabel: 'Get Breakpointer (free)',
          installLabelShort: 'Install',
          installNote: 'Chrome Web Store listing coming soon — install from GitHub in a minute.',
        },
        vi: {
          installLabel: 'Tải Breakpointer (miễn\u00a0phí)',
          installLabelShort: 'Cài đặt',
          installNote: 'Sắp có trên Chrome Web Store — cài từ GitHub chỉ mất một phút.',
        },
      };
  return {
    installUrl: store || GITHUB_INSTALL_URL,
    ...install[lang],
    siteUrl: SITE_URL,
    basePath: new URL(SITE_URL).pathname,
  };
}

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const escapeJson = (value) => JSON.stringify(value).slice(1, -1).replace(/</g, '\\u003c');

function fillTokens(text, tokens, escape, file) {
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, name) => {
    if (!Object.hasOwn(tokens, name)) throw new Error(`${file}: unknown token ${match}`);
    return escape(tokens[name]);
  });
}

function render(text, ext, tokens, file) {
  if (ext === '.txt') return fillTokens(text, tokens, (v) => v, file);
  if (ext === '.xml') return fillTokens(text, tokens, escapeHtml, file);
  // HTML: JSON-LD blocks get JSON escaping, everything else HTML escaping.
  return text
    .split(/(<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>)/i)
    .map((part, i) => fillTokens(part, tokens, i % 2 ? escapeJson : escapeHtml, file))
    .join('');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])),
  );
  return files.flat().sort();
}

async function copyInto(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

/**
 * Relative src/href/srcset/poster values of a page that point to files missing from dist-site/. A page with a
 * <base> (404.html) resolves them from the site's root, as do paths that start with {{basePath}}.
 */
function missingLinks(html, file) {
  const basePath = new URL(SITE_URL).pathname;
  const hasBase = /<base\s[^>]*>/i.test(html);
  const attributes = /\s(?:src|href|srcset|poster)="([^"]+)"/gi;
  const urls = [...html.replace(/<base\s[^>]*>/gi, '').matchAll(attributes)].flatMap((match) =>
    match[1].split(',').map((candidate) => candidate.trim().split(/\s+/)[0]),
  );
  return urls
    .filter((url) => url && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url))
    .filter((url) => {
      const path = decodeURIComponent(url.split(/[?#]/)[0]);
      const target = path.startsWith(basePath)
        ? join(OUT_DIR, path.slice(basePath.length), path.endsWith('/') ? sep : '')
        : join(hasBase ? OUT_DIR : dirname(file), path);
      if (!existsSync(target)) return true;
      return target.endsWith(sep) && !existsSync(join(target, 'index.html'));
    })
    .map((url) => `${relative(OUT_DIR, file)}: ${url}`);
}

const formatSize = (bytes) =>
  bytes < 1000 ? `${bytes} B` : bytes < 1e6 ? `${(bytes / 1e3).toFixed(1)} kB` : `${(bytes / 1e6).toFixed(2)} MB`;

async function main() {
  const store = storeUrl();
  await rm(OUT_DIR, { recursive: true, force: true });

  const written = [];
  const pages = [];

  for (const file of await walk(SITE_DIR)) {
    const rel = relative(SITE_DIR, file);
    const to = join(OUT_DIR, rel);
    const ext = extname(file).toLowerCase();
    if (TEMPLATED.has(ext)) {
      const lang = rel.split(sep)[0] === 'vi' ? 'vi' : 'en';
      const text = render(await readFile(file, 'utf8'), ext, tokensFor(lang, store), rel);
      await mkdir(dirname(to), { recursive: true });
      await writeFile(to, text);
      if (ext === '.html') pages.push([to, text]);
    } else {
      await copyInto(file, to);
    }
    written.push(to);
  }

  for (const [from, dest] of ASSETS) {
    const source = join(ROOT, from);
    if ((await stat(source)).isDirectory()) {
      for (const name of (await readdir(source)).filter((n) => n.endsWith('.png')).sort()) {
        await copyInto(join(source, name), join(OUT_DIR, dest, name));
        written.push(join(OUT_DIR, dest, name));
      }
    } else {
      await copyInto(source, join(OUT_DIR, dest));
      written.push(join(OUT_DIR, dest));
    }
  }

  const broken = pages.flatMap(([file, html]) => missingLinks(html, file));
  if (broken.length) throw new Error(`Links to files that are not in dist-site/:\n  ${broken.join('\n  ')}`);

  const sizes = await Promise.all(written.map(async (file) => (await stat(file)).size));
  const names = written.map((file) => relative(OUT_DIR, file).split(sep).join(posix.sep));
  const width = Math.max(...names.map((name) => name.length)) + 2;

  console.log(`Breakpointer site → ${relative(ROOT, OUT_DIR)}/`);
  console.log(
    store
      ? `  install buttons: Chrome Web Store (${store})`
      : `  install buttons: GitHub (${GITHUB_INSTALL_URL}) — set BREAKPOINTER_STORE_URL for the Chrome Web Store`,
  );
  console.log(`  site address:    ${SITE_URL}\n`);
  names.forEach((name, i) => console.log(`  ${name.padEnd(width)}${formatSize(sizes[i]).padStart(9)}`));
  console.log(`\n  ${names.length} files, ${formatSize(sizes.reduce((a, b) => a + b, 0))}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
