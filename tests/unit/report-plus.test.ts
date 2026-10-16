import { describe, expect, it } from 'vitest';
import type { PageStats } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import { buildReportHtml, type ReportCard } from '../../src/state/report';

const t = createTranslator('en');

const stats: PageStats = {
  requests: 12,
  transferred: 1_480_000,
  unknownSize: 0,
  images: 2,
  imagePixels: 800_000,
  shownPixels: 200_000,
  dpr: 2,
  elements: 640,
  height: 2400,
  lcp: 1200,
  cls: 0.02,
  fonts: 2,
};

const card = (patch: Partial<ReportCard> = {}): ReportCard => ({
  name: 'Phone',
  width: 375,
  height: 667,
  zoom: 0.75,
  breakpoint: null,
  image: null,
  checks: { width: 375, issues: [] },
  ...patch,
});

const build = (input: Partial<Parameters<typeof buildReportHtml>[0]>) =>
  buildReportHtml(
    {
      url: 'https://example.com/',
      title: 'Example',
      created: new Date('2026-10-16T10:00:00Z'),
      version: '0.4.0',
      language: 'en',
      cards: [card()],
      ...input,
    },
    t,
  );

describe('report: page stats, width scan and inspector', () => {
  it('leaves the new sections out when there is nothing to show', () => {
    const html = build({});
    expect(html).not.toContain('Page stats');
    expect(html).not.toContain('Width scan');
    expect(html).not.toContain('Element compared at every size');
  });

  it('lists the page stats of every measured preview', () => {
    const html = build({ cards: [card({ stats }), card({ name: 'Laptop', width: 1366, stats: null })] });
    expect(html).toContain('<h2>Page stats</h2>');
    expect(html).toContain('<th>Phone <span class="num">375</span></th>');
    // Only measured previews get a column.
    expect(html).not.toContain('<th>Laptop');
    expect(html).toContain('<td class="num">1.5 MB</td>');
    expect(html).toContain('<td class="num">1.2 s</td>');
  });

  it('writes the width scan, or that it found nothing', () => {
    expect(
      build({
        scan: { from: 320, to: 1920, findings: [{ name: 'Content wider than the screen', widths: '320–398 px' }] },
      }),
    ).toContain('<td>Content wider than the screen</td><td class="num">320–398 px</td>');
    expect(build({ scan: { from: 320, to: 1920, findings: [] } })).toContain('No issues from 320 to 1920 px.');
  });

  it('escapes everything that comes from the page', () => {
    const html = build({
      inspector: {
        selector: 'main > div#<script>',
        header: ['Viewport', 'Size'],
        rows: [['Phone (375px)', '<img src=x onerror=alert(1)>']],
      },
      scan: { from: 320, to: 400, findings: [{ name: '<b>x</b>', widths: '"&' }] },
    });
    expect(html).toContain('<code>main &gt; div#&lt;script&gt;</code>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<td>&lt;b&gt;x&lt;/b&gt;</td><td class="num">&quot;&amp;</td>');
    expect(html).not.toContain('<script>');
  });
});
