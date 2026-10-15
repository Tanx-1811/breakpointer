import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

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

/** A 1×1 image shown at 180px (blurry) and a cookie banner covering half of a phone screen. */
const COVER_PAGE = page(
  'Cover page',
  `<style>#photo { display: block; width: 180px; height: 180px; }
  #cookies { position: fixed; left: 0; right: 0; bottom: 0; height: 55vh; background: #fef3c7; }</style>
  <script>addEventListener('DOMContentLoaded', () => {
    document.body.append(Object.assign(document.createElement('img'), {
      id: 'photo',
      alt: 'Photo',
      src: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    }));
    document.body.append(Object.assign(document.createElement('div'), { id: 'cookies', textContent: 'We use cookies' }));
  });</script>`,
);

type Route = { status?: number; headers?: Record<string, string | string[]>; body: string };

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
  '/responsive': { body: page('Responsive page') },
  '/long': { body: LONG_PAGE },
  '/linked': { body: page('Linked page') },
  '/issues': { body: ISSUES_PAGE },
  '/scheme': { body: SCHEME_PAGE },
  '/scheme-css': { body: SCHEME_CSS_PAGE },
  '/inspect': { body: INSPECT_PAGE },
  '/utilities': { body: UTILITIES_PAGE },
  '/cover': { body: COVER_PAGE },
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
