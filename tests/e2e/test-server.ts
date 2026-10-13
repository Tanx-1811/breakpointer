import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
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

type Route = { headers?: Record<string, string>; body: string };

let counter = 0;

const routes: Record<string, Route | (() => Route)> = {
  '/demo': { body: DEMO_PAGE },
  '/responsive': { body: page('Responsive page') },
  '/long': { body: LONG_PAGE },
  '/linked': { body: page('Linked page') },
  '/issues': { body: ISSUES_PAGE },
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
    const route = typeof entry === 'function' ? entry() : entry;
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...route.headers });
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
