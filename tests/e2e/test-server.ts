import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { deflateSync } from 'node:zlib';

const DEMO_PAGE = readFileSync(new URL('./fixtures/demo.html', import.meta.url), 'utf8');

/**
 * Pages used to check how previews behave. Each page reports the layout
 * viewport it was given, so tests can assert the real width, not a scaled one.
 */
const page = (title: string, extraHead = '') => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  ${extraHead}
  <style>
    body { font: 16px system-ui, sans-serif; margin: 0; padding: 24px; }
    #layout::after { content: 'desktop'; }
    @media (max-width: 767px) { #layout::after { content: 'mobile'; } }
    @media (min-width: 768px) and (max-width: 1023px) { #layout::after { content: 'tablet'; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Viewport: <span id="vw"></span> × <span id="vh"></span> — <span id="layout"></span></p>
  <script>
    function report() {
      document.getElementById('vw').textContent = String(window.innerWidth);
      document.getElementById('vh').textContent = String(window.innerHeight);
    }
    report();
    addEventListener('resize', report);
  </script>
</body>
</html>`;

/** A tall page with a link, for synced scrolling and navigation. */
const LONG_PAGE = page(
  'Long page',
  `<style>section { height: 900px; border-top: 1px solid #ccc; }</style>
  <script>addEventListener('DOMContentLoaded', () => {
    const link = Object.assign(document.createElement('a'), { id: 'next', href: '/linked', textContent: 'Next page' });
    const signIn = Object.assign(document.createElement('a'), { id: 'callback', href: '/linked?code=abc&state=xyz', textContent: 'Sign-in callback' });
    document.body.append(link, ' ', signIn);
    for (let i = 1; i <= 5; i++) document.body.append(Object.assign(document.createElement('section'), { textContent: 'Section ' + i }));
  });</script>`,
);

/** A page with responsive problems: no viewport tag, a too-wide banner, tiny text and tiny buttons. */
const ISSUES_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Page with issues</title>
<style>body { margin: 0; font: 16px system-ui, sans-serif; } .banner { width: 1500px; height: 40px; background: #fde68a; }
.fine { font-size: 10px; } .tiny { width: 16px; height: 16px; padding: 0; } h1 { margin: 8px; }</style></head>
<body>
  <h1>Page with issues</h1>
  <div class="banner">Wide banner</div>
  <p class="fine">Terms and conditions in tiny print</p>
  <button class="tiny" aria-label="Previous">‹</button><button class="tiny" aria-label="Next">›</button>
</body>
</html>`;

/** Light and dark styles chosen with prefers-color-scheme. */
const SCHEME_PAGE = page(
  'Scheme page',
  `<meta name="color-scheme" content="light dark">
  <style>body { background: rgb(255, 255, 255); color: rgb(20, 20, 20); }
  @media (prefers-color-scheme: dark) { body { background: rgb(0, 0, 0); color: rgb(240, 240, 240); } }</style>`,
);

/** Both schemes declared in CSS only (no color-scheme meta tag). */
const SCHEME_CSS_PAGE = page(
  'Scheme page (CSS)',
  `<style>:root { color-scheme: light dark; } body { background: rgb(255, 255, 255); }
  @media (prefers-color-scheme: dark) { body { background: rgb(0, 0, 0); } }</style>`,
);

/** An element whose layout changes at 768px, for the inspector. */
const INSPECT_PAGE = page(
  'Inspect page',
  `<style>#target { display: block; padding: 12px; background: #eef; font-size: 18px; }
  @media (min-width: 768px) { #target { display: flex; gap: 16px; padding: 24px; } }</style>
  <script>addEventListener('DOMContentLoaded', () => {
    const main = document.createElement('main');
    main.append(Object.assign(document.createElement('div'), { id: 'target', textContent: 'Inspect this box' }));
    main.append(Object.assign(document.createElement('a'), { id: 'away', href: '/linked', textContent: 'A link' }));
    document.body.append(main);
  });</script>`,
);

/** Text, a field, reduced-motion styles and an animation, to try the simulations and stress tests on. */
const UTILITIES_PAGE = page(
  'Utilities page',
  `<style>#motion { outline: 0 solid transparent; }
  @media (prefers-reduced-motion: reduce) { #motion { outline: 3px solid rgb(255, 0, 0); } }
  @media (prefers-contrast: more) { #motion { color: rgb(0, 0, 255); } }
  @media print { #code { display: none; } }
  @media screen { #label { font-style: italic; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  #spinner { width: 24px; height: 24px; background: #6366f1; animation: spin 1s linear infinite; }
  section { height: 700px; border-top: 1px solid #ccc; }</style>
  <script>addEventListener('DOMContentLoaded', () => {
    document.body.append(
      Object.assign(document.createElement('p'), { id: 'label', textContent: 'Sign in to continue' }),
      Object.assign(document.createElement('input'), { id: 'field', placeholder: 'Search products' }),
      Object.assign(document.createElement('div'), { id: 'motion', textContent: 'Moving banner' }),
      Object.assign(document.createElement('div'), { id: 'spinner' }),
      Object.assign(document.createElement('code'), { id: 'code', textContent: 'const keep = true;' }),
      Object.assign(document.createElement('a'), { id: 'first', href: '#first', textContent: 'First link' }),
      Object.assign(document.createElement('button'), { id: 'second', textContent: 'Second' }),
      Object.assign(document.createElement('a'), { id: 'jump', href: '#jump', tabIndex: 1, textContent: 'Jumps the queue' }),
    );
    for (let i = 1; i <= 4; i++) document.body.append(Object.assign(document.createElement('section'), { textContent: 'Section ' + i }));
  });</script>`,
);

/** A 4×4 image shown at 180px (blurry) and a cookie banner covering half of a phone screen. */
const COVER_PAGE = page(
  'Cover page',
  `<style>#photo { display: block; width: 180px; height: 180px; }
  #cookies { position: fixed; left: 0; right: 0; bottom: 0; height: 55vh; background: #fef3c7; }</style>
  <script>addEventListener('DOMContentLoaded', () => {
    document.body.append(Object.assign(document.createElement('img'), {
      id: 'photo',
      alt: 'Photo',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4UWEDRwzEcQBykhfBWhDcSAAAAABJRU5ErkJggg==',
    }));
    document.body.append(Object.assign(document.createElement('div'), { id: 'cookies', textContent: 'We use cookies' }));
  });</script>`,
);

/** A wide picture (an SVG, so it is never "upscaled") for the hero of the audit page. */
const WIDE_PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000"><rect width="2000" height="1000" fill="#0b3d2e"/></svg>',
)}`;

/**
 * The new checks: light grey text (low contrast), a label cut off by its box, a
 * banner inserted after load that pushes the page down (a layout shift) — and
 * what must not be flagged: white text over a picture, an ellipsis, a carousel
 * slide outside its box. Plus headings and a grid and a flex row for the audit.
 */
const AUDIT_PAGE = page(
  'Audit page',
  `<style>
  body { background: #fff; color: #111; }
  h2 { font-size: 22px; } @media (min-width: 768px) { h2 { font-size: 30px; } }
  .faint { color: #b8b8b8; }
  .label-box { width: 120px; overflow: hidden; white-space: nowrap; border: 1px solid #ccc; }
  .ellipsis { width: 120px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .hero { position: relative; height: 140px; }
  .hero img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hero h3 { position: relative; margin: 0; padding: 16px; color: #fff; }
  .carousel { width: 200px; overflow: hidden; white-space: nowrap; }
  .slide { display: inline-block; width: 200px; }
  #cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  #row { display: flex; gap: 8px; }
  </style>
  <script>addEventListener('DOMContentLoaded', () => {
    const add = (tag, props) => document.body.append(Object.assign(document.createElement(tag), props));
    add('h2', { id: 'subtitle', textContent: 'A responsive heading' });
    add('p', { id: 'faint', className: 'faint', textContent: 'Light grey text that is hard to read' });
    add('div', { id: 'label', className: 'label-box', textContent: 'A label that is much too long for its box' });
    add('div', { id: 'ellipsis', className: 'ellipsis', textContent: 'An ellipsis that shortens on purpose' });
    const hero = Object.assign(document.createElement('div'), { className: 'hero' });
    hero.append(Object.assign(document.createElement('img'), { alt: '', src: ${JSON.stringify(WIDE_PICTURE)} }));
    hero.append(Object.assign(document.createElement('h3'), { textContent: 'White text over a picture' }));
    document.body.append(hero);
    const carousel = Object.assign(document.createElement('div'), { className: 'carousel' });
    carousel.append(Object.assign(document.createElement('div'), { className: 'slide', textContent: 'First slide' }));
    carousel.append(Object.assign(document.createElement('div'), { className: 'slide', textContent: 'Second slide' }));
    document.body.append(carousel);
    const cards = Object.assign(document.createElement('div'), { id: 'cards' });
    for (const name of ['One', 'Two', 'Three']) cards.append(Object.assign(document.createElement('p'), { textContent: name }));
    document.body.append(cards);
    const row = Object.assign(document.createElement('div'), { id: 'row' });
    for (const name of ['A', 'B']) row.append(Object.assign(document.createElement('span'), { textContent: name }));
    document.body.append(row);
  });
  addEventListener('load', () => setTimeout(() => {
    document.body.prepend(Object.assign(document.createElement('div'), {
      id: 'late', textContent: 'Late banner', style: 'height: 300px; background: #e0e7ff',
    }));
  }, 400));</script>`,
);

/**
 * Text that keeps its own background: a small dark badge (to highlight), and
 * white text that a closed shadow root shows on a dark box of its own.
 */
const ROBUST_PAGE = page(
  'Robust page',
  `<style>body { background: #fff; color: #111; } #badge { background: #111; color: #fff; font-size: 10px; padding: 2px 4px; }</style>
  <script>
    customElements.define('x-banner', class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'closed' }).innerHTML =
          '<div style="background: #1e3a8a; color: #fff; padding: 8px"><slot></slot></div>';
      }
    });
    addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('beforeend',
      '<p><span id="badge">NEW</span> A new feature</p><x-banner><p id="slotted">Sale ends today</p></x-banner>'));
  </script>`,
);

/** For the width scanner: wider than the screen below 400px, tiny text below 768px. */
const SCAN_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Scan page</title>
<style>body { margin: 0; font: 16px system-ui, sans-serif; } .wide { width: 400px; height: 40px; background: #c7d2fe; }
p { margin: 8px; } @media (max-width: 767px) { .note { font-size: 10px; } } section { height: 600px; }</style></head>
<body><div class="wide">400px wide</div><p class="note">A note in small print on narrow screens</p><section>Content</section></body>
</html>`;

/** A small site for Check pages: its home links to pages worth checking and to some that must not be loaded. */
const SITE_HOME = page(
  'Site home',
  `<script>addEventListener('DOMContentLoaded', () => {
    const links = [['/site/about', 'About'], ['/site/wide', 'Wide'], ['/site/about#team', 'Team'], ['/site/logout', 'Sign out'],
      ['/site/guide.pdf', 'Guide'], ['/site/callback?code=abc', 'Callback'], ['https://example.com/', 'Elsewhere']];
    for (const [href, text] of links) document.body.append(Object.assign(document.createElement('a'), { href, textContent: text }), ' ');
  });</script>`,
);

/** Wider than a phone: content overflows below about 570px. */
const SITE_WIDE = page(
  'Wide page',
  `<style>.wide { width: 520px; height: 24px; background: #c7d2fe; }</style>
  <script>addEventListener('DOMContentLoaded', () => document.body.append(Object.assign(document.createElement('div'), { className: 'wide' })));</script>`,
);

const sitemapRoute = (req: IncomingMessage): Route => {
  const origin = `http://${req.headers.host}`;
  const pages = ['/site/', '/site/about', '/site/wide'].map((path) => `<url><loc>${origin}${path}</loc></url>`);
  return {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.join('')}</urlset>`,
  };
};

type Route = { status?: number; headers?: Record<string, string | string[]>; body: string | Buffer };

/** A plain-coloured PNG of the given size (a real raster image, unlike the SVG pictures). */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PHOTO = solidPng(1600, 400, [11, 61, 46]);

/** A full-width photo and a small logo from the same large file, on a page with a few colours. */
const IMAGES_PAGE = page(
  'Images page',
  `<style>
  body { background: #ffffff; color: #111111; }
  .hero { display: block; width: 100%; height: auto; }
  .logo { display: block; width: 120px; height: 30px; }
  .cta { display: inline-block; padding: 8px 12px; background: #0055aa; color: #ffffff; border: 2px solid #003377; }
  </style>
  <script>addEventListener('DOMContentLoaded', () => {
    const add = (tag, props) => document.body.append(Object.assign(document.createElement(tag), props));
    add('img', { className: 'hero', src: '/photo.png', alt: 'Hero' });
    add('img', { className: 'logo', src: '/photo.png?logo', alt: 'Logo' });
    add('a', { className: 'cta', href: '#', textContent: 'Buy now' });
  });</script>`,
);

/** Answers like Facebook: a request that says it is for a frame (`Sec-Fetch-Dest: iframe`) gets an error page. */
const fetchMetadataRoute = (req: IncomingMessage): Route =>
  req.headers['sec-fetch-dest'] === 'iframe'
    ? { status: 400, body: '<!doctype html><title>Error</title><p>Sorry, something went wrong.</p>' }
    : { body: page('Fetch metadata page') };

/** A page that shows which of the session cookies set by /session/login reached the server. */
const sessionRoute = (req: IncomingMessage): Route => {
  const names = (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter((name) => name?.startsWith('sid_'))
    .sort();
  return {
    body: page('Session page', `<script>window.__serverCookies = ${JSON.stringify(names.join(' '))};</script>`),
  };
};

let counter = 0;

/**
 * Breakpointer Pro: accessibility issues (no page language, an image without alt
 * text, an icon-only button, a field without a label, a closed off-canvas menu
 * that the Tab key still reaches), a cookie banner of a common consent tool, and
 * controls to repeat in other previews (a menu button, a text field, a checkbox
 * and a form that must never be submitted elsewhere).
 */
const PRO_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pro page</title>
<style>
  body { margin: 0; padding: 16px; font: 16px system-ui, sans-serif; }
  .drawer { position: fixed; top: 0; left: 0; width: 260px; height: 100vh; background: #fff; transform: translateX(-100%); }
  #onetrust-banner-sdk { position: fixed; left: 0; right: 0; bottom: 0; height: 90px; background: #222; color: #fff; }
  #hamburger { width: 40px; height: 40px; }
  #menu { display: none; } #menu.open { display: block; }
</style></head>
<body>
  <h1>Pro page</h1>
  <img id="photo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==" width="80" height="40">
  <button id="hamburger" aria-expanded="false"><svg width="16" height="16" aria-hidden="true"><rect width="16" height="2"></rect></svg></button>
  <ul id="menu"><li>Menu item</li></ul>
  <form id="form">
    <input id="name" type="text">
    <label><input id="agree" type="checkbox"> I agree</label>
    <button id="send" type="submit">Send</button>
  </form>
  <p>Opened: <span id="opened">0</span> · Sent: <span id="sent">0</span></p>
  <nav class="drawer"><a href="/linked">Drawer link</a></nav>
  <div id="onetrust-banner-sdk">We use cookies <button>Accept</button></div>
  <script>
    const button = document.getElementById('hamburger');
    const menu = document.getElementById('menu');
    button.addEventListener('click', () => {
      const open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
      document.getElementById('opened').textContent = String(Number(document.getElementById('opened').textContent) + 1);
    });
    document.getElementById('form').addEventListener('submit', (event) => {
      event.preventDefault();
      document.getElementById('sent').textContent = String(Number(document.getElementById('sent').textContent) + 1);
    });
  </script>
</body>
</html>`;

const routes: Record<string, Route | ((req: IncomingMessage) => Route)> = {
  '/fetch-metadata': fetchMetadataRoute,
  // Signs in: session cookies with every SameSite value, as sites set them.
  '/session/login': {
    headers: {
      'Set-Cookie': [
        'sid_lax=1; Path=/; SameSite=Lax',
        'sid_strict=1; Path=/; SameSite=Strict',
        'sid_none=1; Path=/; SameSite=None; Secure',
      ],
    },
    body: page('Signed in'),
  },
  '/session/check': sessionRoute,
  // Served with an error status, as a site that refuses a preview (a bot check, a missing sign-in).
  '/forbidden': { status: 403, body: page('Forbidden page') },
  '/demo': { body: DEMO_PAGE },
  '/pro': { body: PRO_PAGE },
  '/responsive': { body: page('Responsive page') },
  '/long': { body: LONG_PAGE },
  '/linked': { body: page('Linked page') },
  '/issues': { body: ISSUES_PAGE },
  '/scheme': { body: SCHEME_PAGE },
  '/scheme-css': { body: SCHEME_CSS_PAGE },
  '/inspect': { body: INSPECT_PAGE },
  '/images': { body: IMAGES_PAGE },
  '/photo.png': { headers: { 'Content-Type': 'image/png' }, body: PHOTO },
  '/utilities': { body: UTILITIES_PAGE },
  '/cover': { body: COVER_PAGE },
  '/audit': { body: AUDIT_PAGE },
  '/scan': { body: SCAN_PAGE },
  '/site/': { body: SITE_HOME },
  '/site/about': { body: page('About page') },
  '/site/wide': { body: SITE_WIDE },
  '/site/logout': { body: page('Signed out') },
  '/robots.txt': (req) => ({
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: `User-agent: *\nDisallow:\nSitemap: http://${req.headers.host}/sitemap.xml\n`,
  }),
  '/sitemap.xml': sitemapRoute,
  '/robust': { body: ROBUST_PAGE },
  // A site that sends narrow screens to another page, which sends wide screens back.
  '/bounce': {
    body: page(
      'Wide home',
      `<script>addEventListener('load', () => setTimeout(() => { if (innerWidth < 600) location.replace('/bounce-narrow'); }, 300));</script>`,
    ),
  },
  '/bounce-narrow': {
    body: page(
      'Narrow home',
      `<script>addEventListener('load', () => setTimeout(() => { if (innerWidth >= 600) location.replace('/bounce'); }, 300));</script>`,
    ),
  },
  // Overwrites window.name (which identifies the preview) before anything else runs.
  '/renames': {
    body: page(
      'Renaming page',
      '<script>window.name = "app-state"; addEventListener("DOMContentLoaded", () => document.body.append(Object.assign(document.createElement("a"), { id: "next", href: "/linked", textContent: "Next" })));</script>',
    ),
  },
  // Each load gets a new number, so tests can tell whether a frame reloaded.
  '/counter': () => ({ body: page(`Load ${++counter}`) }),
  // Paints right away, but its load event waits ~4 s for an image (like ad-heavy sites).
  // Each load gets its own image URL so Chrome doesn't queue identical requests.
  '/slow-load': () => ({ body: page('Slow page', `<img src="/hang?n=${++counter}" alt="" width="1" height="1">`) }),
  '/xfo-deny': { headers: { 'X-Frame-Options': 'DENY' }, body: page('XFO deny page') },
  '/csp-frame-ancestors': {
    headers: { 'Content-Security-Policy': "frame-ancestors 'none'" },
    body: page('CSP frame-ancestors page'),
  },
  '/framebust': {
    body: page('Frame-busting page', '<script>if (top !== self) { top.location = self.location.href; }</script>'),
  },
};

export type TestServer = { origin: string; url: (path: string) => string; close: () => Promise<void> };

export async function startTestServer(): Promise<TestServer> {
  const server: Server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/hang') {
      setTimeout(() => res.writeHead(204).end(), 4000);
      return;
    }
    const entry = routes[path];
    const route = typeof entry === 'function' ? entry(req) : entry;
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(route.status ?? 200, { 'Content-Type': 'text/html; charset=utf-8', ...route.headers });
    res.end(req.method === 'HEAD' ? undefined : route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  return {
    origin,
    url: (path) => `${origin}${path}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
