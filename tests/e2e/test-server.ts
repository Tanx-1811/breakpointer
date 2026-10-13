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

type Route = { headers?: Record<string, string>; body: string };

let counter = 0;

const routes: Record<string, Route | (() => Route)> = {
  '/demo': { body: DEMO_PAGE },
  '/responsive': { body: page('Responsive page') },
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
