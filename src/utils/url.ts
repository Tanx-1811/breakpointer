export type UrlParseError = 'empty' | 'unsupported-scheme' | 'invalid';

export type UrlParseResult = { ok: true; url: URL } | { ok: false; error: UrlParseError };

const HTTP_SCHEME = /^https?:\/\//i;
const ANY_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const OPAQUE_SCHEME =
  /^(about|blob|chrome|chrome-extension|chrome-search|data|devtools|edge|file|javascript|mailto|tel|view-source):/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isIpAddress(hostname: string): boolean {
  return IPV4.test(hostname) || hostname.startsWith('[');
}

function isLocalHost(hostname: string): boolean {
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
      return { ok: true, url: new URL(value) };
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
  return { ok: true, url };
}

/** Returns the href only if the value is a valid http(s) URL. */
export function toSafeHref(value: unknown): string | undefined {
  if (typeof value !== 'string' || !HTTP_SCHEME.test(value)) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function urlErrorMessage(error: UrlParseError): string {
  switch (error) {
    case 'empty':
      return 'Enter a website address, for example example.com.';
    case 'unsupported-scheme':
      return 'Only http:// and https:// pages can be previewed.';
    case 'invalid':
      return 'That doesn’t look like a website address. Try something like example.com.';
  }
}

/**
 * Host permission pattern covering a site and its subdomains, so that common
 * redirects (example.com → www.example.com) keep working.
 */
export function siteAccessPattern(url: URL): string {
  const host = url.hostname;
  if (isIpAddress(host) || host === 'localhost') return `*://${host}/*`;
  return `*://*.${host.replace(/^www\./, '')}/*`;
}

/** Short, readable host for messages, e.g. "example.com". */
export function displayHost(url: URL): string {
  return url.hostname.replace(/^www\./, '');
}
