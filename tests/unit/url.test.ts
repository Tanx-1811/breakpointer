import { describe, expect, it } from 'vitest';
import { displayHost, parsePreviewUrl, siteAccessPattern, toSafeHref } from '../../src/utils/url';

const href = (input: string) => {
  const result = parsePreviewUrl(input);
  return result.ok ? result.url.href : result.error;
};

describe('parsePreviewUrl', () => {
  it('accepts full http(s) URLs', () => {
    expect(href('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    expect(href('  http://example.com  ')).toBe('http://example.com/');
  });

  it('adds https:// to bare domains and http:// to local hosts', () => {
    expect(href('example.com')).toBe('https://example.com/');
    expect(href('www.example.com/docs')).toBe('https://www.example.com/docs');
    expect(href('localhost:3000')).toBe('http://localhost:3000/');
    expect(href('127.0.0.1:8080/app')).toBe('http://127.0.0.1:8080/app');
    expect(href('myapp.localhost')).toBe('http://myapp.localhost/');
  });

  it('rejects empty input, other schemes and things that are not addresses', () => {
    expect(href('')).toBe('empty');
    expect(href('   ')).toBe('empty');
    expect(href('chrome://settings')).toBe('unsupported-scheme');
    expect(href('file:///Users/me/index.html')).toBe('unsupported-scheme');
    expect(href('javascript:alert(1)')).toBe('unsupported-scheme');
    expect(href('ftp://example.com')).toBe('unsupported-scheme');
    expect(href('hello world')).toBe('invalid');
    expect(href('hello')).toBe('invalid');
    expect(href('https://')).toBe('invalid');
  });
});

describe('toSafeHref', () => {
  it('only lets http(s) URLs through', () => {
    expect(toSafeHref('https://example.com')).toBe('https://example.com/');
    expect(toSafeHref('javascript:alert(1)')).toBeUndefined();
    expect(toSafeHref('data:text/html,hi')).toBeUndefined();
    expect(toSafeHref(42)).toBeUndefined();
    expect(toSafeHref(undefined)).toBeUndefined();
  });
});

describe('siteAccessPattern', () => {
  it('covers the whole registrable domain, so redirects between subdomains keep working', () => {
    expect(siteAccessPattern(new URL('https://www.example.com/a'))).toBe('*://*.example.com/*');
    expect(siteAccessPattern(new URL('https://shop.example.com'))).toBe('*://*.example.com/*');
    expect(siteAccessPattern(new URL('https://dantri.com.vn'))).toBe('*://*.dantri.com.vn/*');
    expect(siteAccessPattern(new URL('https://m.dantri.com.vn'))).toBe('*://*.dantri.com.vn/*');
    expect(siteAccessPattern(new URL('https://www.bbc.co.uk'))).toBe('*://*.bbc.co.uk/*');
    expect(siteAccessPattern(new URL('https://someone.github.io/app'))).toBe('*://*.someone.github.io/*');
    expect(siteAccessPattern(new URL('http://myapp.localhost:3000'))).toBe('*://myapp.localhost/*');
  });

  it('uses the exact host for IP addresses and localhost', () => {
    expect(siteAccessPattern(new URL('http://127.0.0.1:5173'))).toBe('*://127.0.0.1/*');
    expect(siteAccessPattern(new URL('http://localhost:3000'))).toBe('*://localhost/*');
  });
});

describe('displayHost', () => {
  it('drops www.', () => {
    expect(displayHost(new URL('https://www.example.com'))).toBe('example.com');
  });
});
