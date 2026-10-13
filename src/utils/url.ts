export type UrlParseError = 'empty' | 'unsupported-scheme' | 'invalid' | 'credentials';

export type UrlParseResult = { ok: true; url: URL } | { ok: false; error: UrlParseError };

const HTTP_SCHEME = /^https?:\/\//i;
const ANY_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const OPAQUE_SCHEME =
  /^(about|blob|chrome|chrome-extension|chrome-search|data|devtools|edge|file|javascript|mailto|tel|view-source):/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isIpAddress(hostname: string): boolean {
  return IPV4.test(hostname) || hostname.startsWith('[');
}

/** localhost, *.localhost or an IP address. */
export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost') || isIpAddress(hostname);
}

/**
 * Turns what a user typed into a previewable http(s) URL.
 * Bare hosts get https://, except local hosts which get http://.
 */
export function parsePreviewUrl(input: string): UrlParseResult {
  const value = input.trim();
  if (!value) return { ok: false, error: 'empty' };

  if (HTTP_SCHEME.test(value)) {
    try {
      return checked(new URL(value));
    } catch {
      return { ok: false, error: 'invalid' };
    }
  }

  if (ANY_SCHEME.test(value) || OPAQUE_SCHEME.test(value)) {
    return { ok: false, error: 'unsupported-scheme' };
  }

  if (/\s/.test(value)) return { ok: false, error: 'invalid' };

  const hostGuess = value.split(/[/:?#]/, 1)[0]?.toLowerCase() ?? '';
  const scheme = isLocalHost(hostGuess) ? 'http' : 'https';
  let url: URL;
  try {
    url = new URL(`${scheme}://${value}`);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  // Without an explicit scheme, require something that looks like a domain.
  if (!url.hostname.includes('.') && !isLocalHost(url.hostname)) {
    return { ok: false, error: 'invalid' };
  }
  return checked(url);
}

/**
 * Chrome refuses to load frames whose URL embeds credentials
 * (https://user:pass@host), so say so instead of showing blank previews.
 */
function checked(url: URL): UrlParseResult {
  if (url.username || url.password) return { ok: false, error: 'credentials' };
  return { ok: true, url };
}

/** Returns the href only if the value is a previewable http(s) URL (no embedded credentials). */
export function toSafeHref(value: unknown): string | undefined {
  if (typeof value !== 'string' || !HTTP_SCHEME.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.username || url.password ? undefined : url.href;
  } catch {
    return undefined;
  }
}

/**
 * Suffixes under which anyone can register a name, so the "site" is one label
 * longer (e.g. dantri.com.vn, bbc.co.uk, user.github.io). A small, practical
 * subset of the Public Suffix List.
 */
const MULTI_PART_SUFFIXES = new Set([
  'com.vn',
  'net.vn',
  'org.vn',
  'edu.vn',
  'gov.vn',
  'info.vn',
  'biz.vn',
  'name.vn',
  'pro.vn',
  'health.vn',
  'int.vn',
  'ac.vn',
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'me.uk',
  'ltd.uk',
  'plc.uk',
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'gov.au',
  'co.jp',
  'ne.jp',
  'or.jp',
  'ac.jp',
  'go.jp',
  'co.kr',
  'or.kr',
  'ac.kr',
  'com.cn',
  'net.cn',
  'org.cn',
  'com.hk',
  'com.tw',
  'com.sg',
  'com.my',
  'com.ph',
  'co.id',
  'co.th',
  'in.th',
  'co.in',
  'co.nz',
  'co.za',
  'com.br',
  'com.mx',
  'com.ar',
  'com.tr',
  'github.io',
  'gitlab.io',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'web.app',
  'firebaseapp.com',
  'herokuapp.com',
  'azurewebsites.net',
  'blogspot.com',
  'onrender.com',
  'fly.dev',
  'glitch.me',
  'surge.sh',
  'ngrok.io',
  'ngrok-free.app',
  'trycloudflare.com',
]);

/** The registrable domain of a host: shop.example.com → example.com, news.dantri.com.vn → dantri.com.vn. */
export function registrableDomain(hostname: string): string {
  const host = hostname.replace(/\.$/, '').toLowerCase();
  if (isIpAddress(host) || !host.includes('.')) return host;
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  const size = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-size).join('.');
}

/**
 * Host permission pattern covering the whole site — its registrable domain and
 * every subdomain — so redirects such as example.com → www.example.com or
 * shop.example.com → example.com keep working.
 */
export function siteAccessPattern(url: URL): string {
  const host = url.hostname;
  if (isIpAddress(host) || host === 'localhost' || host.endsWith('.localhost')) return `*://${host}/*`;
  return `*://*.${registrableDomain(host)}/*`;
}

/** Pages Chrome never lets an extension show or access (the Chrome Web Store). */
export function isRestrictedHost(url: URL): boolean {
  return (
    url.hostname === 'chromewebstore.google.com' ||
    (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))
  );
}

/** Short, readable host for messages, e.g. "example.com". */
export function displayHost(url: URL): string {
  return url.hostname.replace(/^www\./, '');
}
