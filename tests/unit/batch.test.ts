import { describe, expect, it } from 'vitest';
import type { CheckIssue } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import {
  BATCH_CARD_ID,
  MAX_BATCH_PAGES,
  addToPageList,
  batchMarkdown,
  batchReportHtml,
  batchSizes,
  checkableLinks,
  commonOrigin,
  newRun,
  pageIssueKinds,
  pageLabel,
  parsePageList,
  parseSitemap,
  robotsSitemaps,
  setCell,
  summarizeRun,
  updatePage,
  type BatchRun,
} from '../../src/state/batch';
import { compareCardId, isCompareCardId } from '../../src/state/compare';
import { SCAN_CARD_ID } from '../../src/state/scan';

const t = createTranslator('en');

const overflow: CheckIssue = { kind: 'overflow', count: 1, detail: '130px', samples: [{ selector: 'div.hero > img' }] };
const small: CheckIssue = { kind: 'small-text', count: 3, samples: [{ selector: 'p.note', detail: '11px' }] };

const sizes = batchSizes([
  { name: 'Phone', width: 390, height: 844 },
  { name: 'Tablet', width: 768, height: 1024 },
]);

/** Two pages checked at two sizes: the first with issues on the phone, the second without; a third failed. */
function finishedRun(): BatchRun {
  let run = newRun(
    ['https://example.com/', 'https://example.com/pricing', 'https://example.com/missing'],
    sizes,
    Date.UTC(2026, 9, 19),
  );
  run = setCell(run, 0, 0, { status: 'checked', issues: [overflow, small] });
  run = setCell(run, 0, 1, { status: 'checked', issues: [] });
  run = updatePage(run, 0, { status: 'done' });
  run = setCell(run, 1, 0, { status: 'checked', issues: [] });
  run = setCell(run, 1, 1, { status: 'failed' });
  run = updatePage(run, 1, { status: 'done', finalUrl: 'https://example.com/login' });
  run = updatePage(run, 2, { status: 'failed', failure: 'http', httpStatus: 404 });
  return { ...run, complete: true };
}

describe('check pages: the list', () => {
  it("uses a card id viewports and the scanner can't have", () => {
    expect(BATCH_CARD_ID).toContain('~');
    expect(BATCH_CARD_ID).not.toBe(SCAN_CARD_ID);
    expect(isCompareCardId(BATCH_CARD_ID)).toBe(false);
    expect(compareCardId('a')).not.toBe(BATCH_CARD_ID);
  });

  it('reads one address per line, each page once, and points out the lines that are not addresses', () => {
    const { pages, invalid } = parsePageList(
      'example.com\n\n# a comment\nhttps://example.com/pricing\nexample.com/\nnot an address\nftp://example.com/file',
    );
    expect(pages).toEqual(['https://example.com/', 'https://example.com/pricing']);
    expect(invalid).toEqual([6, 7]);
  });

  it('adds pages at the end, skips those in the list and stops when it is full', () => {
    expect(addToPageList('example.com', ['https://example.com/', 'https://example.com/a'])).toEqual({
      text: 'example.com\nhttps://example.com/a',
      added: 1,
    });
    expect(addToPageList('', ['https://example.com/a'])).toEqual({ text: 'https://example.com/a', added: 1 });
    const many = Array.from({ length: MAX_BATCH_PAGES + 5 }, (_, index) => `https://example.com/${index}`);
    const full = addToPageList('', many);
    expect(full.added).toBe(MAX_BATCH_PAGES);
    expect(addToPageList(full.text, ['https://example.com/new']).added).toBe(0);
  });

  it('keeps one size per size and page colours, in the workspace order', () => {
    expect(
      batchSizes([
        { name: 'Phone', width: 390, height: 844 },
        { name: 'Phone copy', width: 390, height: 844 },
        { name: 'Phone dark', width: 390, height: 844, colorScheme: 'dark' },
        { name: 'Laptop', width: 1440, height: 900 },
      ]).map((size) => [size.name, size.colorScheme]),
    ).toEqual([
      ['Phone', null],
      ['Phone dark', 'dark'],
      ['Laptop', null],
    ]);
  });
});

describe('check pages: links worth checking', () => {
  const page = 'https://example.com/blog/#top';

  it('keeps pages of the same site, without fragments, each once and not the page itself', () => {
    expect(
      checkableLinks(page, [
        'https://example.com/blog/',
        'https://example.com/about#team',
        'https://example.com/about',
        'https://other.com/',
        'http://example.com/http-only',
        'https://example.com/pricing?plan=pro',
      ]),
    ).toEqual(['https://example.com/about', 'https://example.com/pricing?plan=pro']);
  });

  it('leaves out files, one-time links and actions such as signing out', () => {
    expect(
      checkableLinks(page, [
        'https://example.com/guide.pdf',
        'https://example.com/photo.JPG',
        'https://example.com/feed.xml',
        'https://example.com/logout',
        'https://example.com/account/sign-out',
        'https://example.com/users/12/delete',
        'https://example.com/auth/callback?code=abc',
        'https://example.com/reset?token=xyz',
        'mailto:hello@example.com',
        'javascript:void(0)',
        'https://example.com/removal-policy',
        'https://example.com/docs/cancellation',
      ]),
    ).toEqual(['https://example.com/removal-policy', 'https://example.com/docs/cancellation']);
  });

  it('stops at the limit, and gives nothing for an invalid page', () => {
    const hrefs = Array.from({ length: 80 }, (_, index) => `https://example.com/p/${index}`);
    expect(checkableLinks(page, hrefs, 10)).toHaveLength(10);
    expect(checkableLinks('not a url', hrefs)).toEqual([]);
  });
});

describe('check pages: sitemaps', () => {
  it('reads the pages of a sitemap, decoding entities and CDATA', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc> https://example.com/search?q=a&amp;page=2 </loc></url>
        <url><loc><![CDATA[https://example.com/caf&#233;]]></loc></url>
        <url><loc>https://example.com/</loc></url>
        <url><loc>javascript:alert(1)</loc></url>
      </urlset>`;
    expect(parseSitemap(xml)).toEqual({
      index: false,
      urls: ['https://example.com/', 'https://example.com/search?q=a&page=2', 'https://example.com/caf%C3%A9'],
    });
  });

  it('tells a sitemap index, also with a namespace prefix', () => {
    const xml = `<sm:sitemapindex xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sm:sitemap><sm:loc>https://example.com/sitemap-pages.xml</sm:loc></sm:sitemap></sm:sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({ index: true, urls: ['https://example.com/sitemap-pages.xml'] });
  });

  it('finds the sitemaps a robots.txt names', () => {
    expect(
      robotsSitemaps(
        'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml\r\nsitemap:https://example.com/news.xml\nSitemap: /relative.xml',
      ),
    ).toEqual(['https://example.com/sitemap.xml', 'https://example.com/news.xml']);
  });
});

describe('check pages: results', () => {
  it('summarizes pages with issues, checked and failed', () => {
    const run = finishedRun();
    expect(summarizeRun(run)).toEqual({ pages: 3, checked: 2, withIssues: 1, failed: 1 });
    expect(pageIssueKinds(run.pages[0]!)).toEqual(['overflow', 'small-text']);
    expect(pageIssueKinds(run.pages[1]!)).toEqual([]);
  });

  it('labels pages by path on the main site, by host elsewhere', () => {
    expect(commonOrigin(['https://a.com/', 'https://b.com/x', 'https://b.com/y'])).toBe('https://b.com');
    expect(pageLabel('https://b.com/x?y=1', 'https://b.com')).toBe('/x?y=1');
    expect(pageLabel('https://a.com/', 'https://b.com')).toBe('a.com');
    expect(pageLabel('https://a.com/docs', null)).toBe('a.com/docs');
  });

  it('writes a Markdown table of pages and sizes', () => {
    const markdown = batchMarkdown(finishedRun(), t);
    expect(markdown).toContain('**Check pages** · Breakpointer · Pages: 3 · sizes: 2');
    expect(markdown).toContain('| Page | Phone (390px) | Tablet (768px) |');
    expect(markdown).toContain('| / | ⚠ Content wider than the screen +130px, Text smaller than 12px 3 | ✓ |');
    expect(markdown).toContain('| /pricing → /login | ✓ | ✗ |');
    expect(markdown).toContain('| /missing (Not checked: the page answered HTTP 404) | — | — |');
    expect(markdown).toContain('1 of 2 pages checked have issues at some size.');
    expect(markdown).toContain('Site: https://example.com');
    expect(markdown).not.toContain('stopped');
    expect(batchMarkdown({ ...finishedRun(), complete: false }, t)).toContain('stopped before the end');
  });

  it('writes a self-contained, escaped HTML report', () => {
    let run = finishedRun();
    run = setCell(run, 1, 0, {
      status: 'checked',
      issues: [{ kind: 'tap-targets', count: 1, samples: [{ selector: 'a[href="<x>"]' }] }],
    });
    const html = batchReportHtml(
      run,
      { created: new Date('2026-10-19T10:00:00Z'), version: '0.5.0', language: 'en', homepage: 'https://example.org/' },
      t,
    );
    expect(html).toContain('<title>Pages checked at every viewport · https://example.com</title>');
    expect(html).toContain('a[href=&quot;&lt;x&gt;&quot;]');
    expect(html).not.toContain('<x>');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('Not checked: the page answered HTTP 404');
    expect(html).toContain('Went to /login');
    expect(html).toContain('<a href="https://example.org/">Breakpointer</a>');
  });
});
