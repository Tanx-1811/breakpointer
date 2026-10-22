import { CHECK_KINDS, type CheckIssue, type CheckKind } from '../agent/protocol';
import type { Language, Translate } from '../i18n/translate';
import type { BrandingSettings, ColorScheme } from '../types';
import { parsePreviewUrl, toSafeHref } from '../utils/url';
import { issueCell } from './audit';
import { BRAND_STYLES, reportEyebrow, reportFooter } from './branding';
import { CHECK_KIND_KEYS, issueDetail, localNumbers } from './checks';
import { isOneTimeUrl } from './follow';
import { scoreIssues, type ResponsiveScore } from './score';
import { escapeHtml } from './report';
import { viewportKey } from './snapshots';

/**
 * The card id of the preview that Check pages loads every page in: `~` can't
 * occur in viewport ids, so it never meets a viewport (as with the scanner's).
 */
export const BATCH_CARD_ID = '~batch';

/** Pages checked at most in one run. */
export const MAX_BATCH_PAGES = 50;

/** A size every page is checked at: the visible viewports, one per size and page colours. */
export type BatchSize = {
  key: string;
  name: string;
  width: number;
  height: number;
  colorScheme: ColorScheme | null;
};

/** The sizes of `viewports` (the visible ones, in their order), each size and page colours once. */
export function batchSizes(
  viewports: { name: string; width: number; height: number; colorScheme?: ColorScheme }[],
): BatchSize[] {
  const sizes: BatchSize[] = [];
  for (const viewport of viewports) {
    const key = viewportKey(viewport);
    if (sizes.some((size) => size.key === key)) continue;
    const { name, width, height } = viewport;
    sizes.push({ key, name, width, height, colorScheme: viewport.colorScheme ?? null });
  }
  return sizes;
}

/**
 * The addresses in a list typed one per line: blank lines and lines starting
 * with `#` are skipped, each page counts once, and the numbers (from 1) of the
 * lines that aren't web addresses are returned in `invalid`.
 */
export function parsePageList(text: string): { pages: string[]; invalid: number[] } {
  const pages: string[] = [];
  const invalid: number[] = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const result = parsePreviewUrl(line);
    if (!result.ok) invalid.push(index + 1);
    else if (!pages.includes(result.url.href)) pages.push(result.url.href);
  });
  return { pages, invalid };
}

/**
 * The list with `additions` appended (those not in it yet), keeping what was
 * typed; at most `limit` pages in all. `added` counts the new ones.
 */
export function addToPageList(
  text: string,
  additions: string[],
  limit = MAX_BATCH_PAGES,
): { text: string; added: number } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const known = new Set(parsePageList(text).pages);
  let room = Math.max(0, limit - known.size);
  let added = 0;
  for (const page of additions) {
    if (room === 0) break;
    if (known.has(page)) continue;
    known.add(page);
    lines.push(page);
    room -= 1;
    added += 1;
  }
  return { text: lines.join('\n'), added };
}

/** Files a page links to that aren't pages (documents, archives, media, feeds). */
const FILE_EXTENSION =
  /\.(?:pdf|zip|gz|tgz|rar|7z|dmg|exe|msi|apk|ipa|jpe?g|png|gif|webp|avif|svg|ico|mp[34]|m4a|mov|webm|ogg|wav|csv|xlsx?|docx?|pptx?|json|xml|rss|atom|txt|ics)$/i;

/** Addresses that act rather than show something: loading them in a preview would sign out, delete… */
const ACTION_PATH =
  /(?:^|[/_.-])(?:log-?out|sign-?out|log-?off|unsubscribe|delete|destroy|remove|cancel)(?:$|[/_.?-])/i;

/**
 * The links worth checking: pages of the same site as `page` that a preview
 * can load safely — not files, not one-time links (sign-in callbacks, tokens)
 * and not actions such as signing out — without fragments, each once and in
 * order, leaving out `page` itself. At most `limit`.
 */
export function checkableLinks(page: string, hrefs: string[], limit = MAX_BATCH_PAGES): string[] {
  let origin: string;
  let self: string;
  try {
    const url = new URL(page);
    url.hash = '';
    origin = url.origin;
    self = url.href;
  } catch {
    return [];
  }
  const links: string[] = [];
  for (const href of hrefs) {
    if (links.length >= limit) break;
    const safe = toSafeHref(href);
    if (!safe) continue;
    const url = new URL(safe);
    url.hash = '';
    if (url.origin !== origin || url.href === self || links.includes(url.href)) continue;
    if (FILE_EXTENSION.test(url.pathname) || ACTION_PATH.test(url.pathname) || isOneTimeUrl(url.href)) continue;
    links.push(url.href);
  }
  return links;
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodeXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return XML_ENTITIES[entity.toLowerCase()] ?? match;
  });

/**
 * The addresses of a sitemap (`<loc>`), web pages only. `index` is true for a
 * sitemap index, whose addresses are other sitemaps.
 */
export function parseSitemap(xml: string): { urls: string[]; index: boolean } {
  const index = /<(?:[\w-]+:)?sitemapindex[\s>]/i.test(xml);
  const urls: string[] = [];
  for (const match of xml.matchAll(
    /<(?:[\w-]+:)?loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/(?:[\w-]+:)?loc>/gi,
  )) {
    const href = toSafeHref(decodeXml(match[1]!.trim()));
    if (href && !urls.includes(href)) urls.push(href);
  }
  return { urls, index };
}

/** The sitemaps a robots.txt names (`Sitemap:` lines). */
export function robotsSitemaps(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    const href = match ? toSafeHref(match[1]) : undefined;
    if (href && !found.includes(href)) found.push(href);
  }
  return found;
}

/* ---------- A run and its results ---------- */

export type BatchCell =
  /** Checked at this size: the issues found (none: fine). */
  | { status: 'checked'; issues: CheckIssue[] }
  /** The preview didn't answer at this size. */
  | { status: 'failed' };

/**
 * Why a page wasn't checked: no agent ran in it (the site isn't allowed, or it
 * isn't a web page), it answered with an HTTP error, or it didn't load in time.
 */
export type BatchFailure = 'noAgent' | 'http' | 'timeout';

export type BatchPage = {
  url: string;
  /** Where the page ended up, when it went to another page (e.g. a sign-in page). */
  finalUrl?: string;
  status: 'pending' | 'checking' | 'done' | 'failed';
  failure?: BatchFailure;
  /** The HTTP status of an error page (404, 500…). */
  httpStatus?: number;
  /** One per size, in the order of the sizes; null until checked. */
  cells: (BatchCell | null)[];
};

export type BatchRun = {
  sizes: BatchSize[];
  pages: BatchPage[];
  /** When it started (ms since the epoch). */
  started: number;
  /** Every page was checked (false while running, or when it was stopped). */
  complete: boolean;
};

export function newRun(pages: string[], sizes: BatchSize[], started: number): BatchRun {
  return {
    sizes,
    pages: pages.map((url) => ({ url, status: 'pending', cells: sizes.map(() => null) })),
    started,
    complete: false,
  };
}

/** The run with one page changed (`index`), as a new object. */
export function updatePage(run: BatchRun, index: number, patch: Partial<BatchPage>): BatchRun {
  return { ...run, pages: run.pages.map((page, at) => (at === index ? { ...page, ...patch } : page)) };
}

/** The run with one cell set. */
export function setCell(run: BatchRun, index: number, size: number, cell: BatchCell): BatchRun {
  const page = run.pages[index];
  if (!page) return run;
  return updatePage(run, index, { cells: page.cells.map((item, at) => (at === size ? cell : item)) });
}

/** The kinds of issue a page has at any size, in the order the checks are shown. */
export function pageIssueKinds(page: BatchPage): CheckKind[] {
  const found = new Set<CheckKind>();
  for (const cell of page.cells) if (cell?.status === 'checked') for (const issue of cell.issues) found.add(issue.kind);
  return CHECK_KINDS.filter((kind) => found.has(kind));
}

/** The responsive score of a page at the sizes it was checked at (null when none was). */
export function pageScore(page: BatchPage): ResponsiveScore | null {
  return scoreIssues(page.cells.flatMap((cell) => (cell?.status === 'checked' ? [cell.issues] : [])));
}

/** "86 · B", or "—" for a page that wasn't checked. */
export const pageScoreText = (page: BatchPage) => {
  const score = pageScore(page);
  return score ? `${score.score} · ${score.grade}` : '—';
};

export type BatchSummary = {
  pages: number;
  /** Pages checked at every size, or at some sizes before the run stopped. */
  checked: number;
  /** Checked pages with an issue at some size. */
  withIssues: number;
  failed: number;
};

export function summarizeRun(run: BatchRun): BatchSummary {
  let checked = 0;
  let withIssues = 0;
  let failed = 0;
  for (const page of run.pages) {
    if (page.status === 'failed') failed += 1;
    if (!page.cells.some((cell) => cell?.status === 'checked')) continue;
    checked += 1;
    if (pageIssueKinds(page).length) withIssues += 1;
  }
  return { pages: run.pages.length, checked, withIssues, failed };
}

/** A page in a list: its path (and query) on the site of `base`, else its host and path. */
export function pageLabel(url: string, base?: string | null): string {
  try {
    const page = new URL(url);
    const path = `${page.pathname}${page.search}`;
    if (base && new URL(base).origin === page.origin) return path;
    return `${page.host}${path === '/' ? '' : path}`;
  } catch {
    return url;
  }
}

/** The site most pages are on, to label them by path. */
export function commonOrigin(pages: string[]): string | null {
  const counts = new Map<string, number>();
  for (const page of pages) {
    try {
      const origin = new URL(page).origin;
      counts.set(origin, (counts.get(origin) ?? 0) + 1);
    } catch {
      // Not an address.
    }
  }
  let best: string | null = null;
  for (const [origin, count] of counts) if (best === null || count > counts.get(best)!) best = origin;
  return best;
}

/** Why a page wasn't checked, in a few words. */
export function failureText(page: BatchPage, t: Translate): string {
  switch (page.failure) {
    case 'http':
      return t('batch.failedHttp', { status: page.httpStatus ?? 0 });
    case 'timeout':
      return t('batch.failedTimeout');
    default:
      return t('batch.failedAgent');
  }
}

const sizeTitle = (size: BatchSize) => `${size.name} (${size.width}px)`;
const mdCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';

/** A cell of the table as text: ✓, ⚠ with each kind and its value, ✗ when it failed, — when not checked. */
function cellText(cell: BatchCell | null, t: Translate): string {
  if (!cell) return '—';
  if (cell.status === 'failed') return '✗';
  if (!cell.issues.length) return '✓';
  return `⚠ ${cell.issues.map((issue) => `${t(CHECK_KIND_KEYS[issue.kind])} ${localNumbers(issueCell(issue), t)}`).join(', ')}`;
}

/**
 * The run as a Markdown table — a row per page, a column per size — to paste
 * into a ticket or a pull request.
 */
export function batchMarkdown(run: BatchRun, t: Translate): string {
  const base = commonOrigin(run.pages.map((page) => page.url));
  const header = [t('batch.page'), ...run.sizes.map(sizeTitle), t('score.column')];
  const rows = run.pages.map((page) => {
    const label = pageLabel(page.url, base);
    const name = page.finalUrl ? `${label} → ${pageLabel(page.finalUrl, base)}` : label;
    if (page.status === 'failed') return [`${name} (${failureText(page, t)})`, ...run.sizes.map(() => '—'), '—'];
    return [name, ...page.cells.map((cell) => cellText(cell, t)), pageScoreText(page)];
  });
  const summary = summarizeRun(run);
  const lines = [
    `${t('batch.markdownTitle')} · ${t('batch.counts', { pages: run.pages.length, sizes: run.sizes.length })}`,
    '',
    `| ${header.map(mdCell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`),
    '',
    t('batch.summary', { issues: summary.withIssues, checked: summary.checked }),
  ];
  if (base) lines.push(t('batch.markdownSite', { site: base }));
  if (!run.complete) lines.push(t('batch.markdownStopped'));
  return `${lines.join('\n')}\n`;
}

const SAFE_LINK = /^https?:\/\//i;

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:#f6f7f9;color:#1f2430;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 20px 48px}
a{color:#4338ca;overflow-wrap:anywhere}
.eyebrow{margin:0;color:#4f46e5;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
h1{margin:4px 0 6px;font-size:28px;line-height:1.2}
h2{margin:0 0 4px;font-size:17px;overflow-wrap:anywhere}
h3{margin:14px 0 6px;font-size:14px}
.meta{margin:0;color:#5b6472;font-size:13px}
section{margin-top:24px;padding:20px;border:1px solid #e3e6eb;border-radius:14px;background:#fff}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid #e3e6eb;text-align:left;vertical-align:top}
th{color:#5b6472;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ok{color:#15803d;font-weight:600}
.warn{color:#b45309;font-weight:600}
.bad{color:#b91c1c;font-weight:600}
.muted{color:#5b6472}
.issues{margin:0;padding:0;list-style:none}
.issues>li{padding:10px 12px;border:1px solid #f3d9a4;border-radius:8px;background:#fffbeb}
.issues>li+li{margin-top:8px}
.samples{margin:6px 0 0;padding-left:18px;color:#5b6472;font-size:13px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow-wrap:anywhere}
footer{margin-top:28px;color:#5b6472;font-size:12px}
@media print{body{background:#fff}section{break-inside:avoid;border-color:#ccc}}
`;

export type BatchReportInput = {
  created: Date;
  version: string;
  language: Language;
  /** Where "Breakpointer" in the footer links to. */
  homepage: string;
  /** Your brand (Pro) instead of Breakpointer in the header and footer. */
  brand?: BrandingSettings | null;
};

/**
 * A self-contained HTML report of a run (no scripts, no external files): a
 * table of every page at every size, then each page's issues.
 */
export function batchReportHtml(run: BatchRun, input: BatchReportInput, t: Translate): string {
  const base = commonOrigin(run.pages.map((page) => page.url));
  const summary = summarizeRun(run);
  const link = (url: string, text: string) =>
    SAFE_LINK.test(url)
      ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(text)}</a>`
      : escapeHtml(text);

  const cellHtml = (cell: BatchCell | null) => {
    if (!cell) return '<span class="muted">—</span>';
    if (cell.status === 'failed') return '<span class="bad">✗</span>';
    if (!cell.issues.length) return '<span class="ok">✓</span>';
    return `<span class="warn">⚠ ${cell.issues.length}</span>`;
  };

  const rows = run.pages
    .map((page, index) => {
      const label = pageLabel(page.url, base);
      const name = `<a href="#page-${index + 1}">${escapeHtml(label)}</a>`;
      if (page.status === 'failed')
        return `<tr><td>${name}</td><td colspan="${run.sizes.length}" class="bad">${escapeHtml(failureText(page, t))}</td><td class="muted">—</td></tr>`;
      return `<tr><td>${name}</td>${page.cells.map((cell) => `<td>${cellHtml(cell)}</td>`).join('')}<td class="num">${escapeHtml(pageScoreText(page))}</td></tr>`;
    })
    .join('\n');

  const issueList = (issues: CheckIssue[]) =>
    `<ul class="issues">${issues
      .map((issue) => {
        const samples = issue.samples.length
          ? `<ul class="samples">${issue.samples
              .map(
                (sample) =>
                  `<li><code>${escapeHtml(sample.selector)}</code>${sample.detail ? ` · ${escapeHtml(localNumbers(sample.detail, t))}` : ''}</li>`,
              )
              .join('')}</ul>`
          : '';
        return `<li><strong>${escapeHtml(t(CHECK_KIND_KEYS[issue.kind]))}</strong><br>${escapeHtml(issueDetail(issue, t))}${samples}</li>`;
      })
      .join('')}</ul>`;

  const sections = run.pages
    .map((page, index) => {
      const heading = `<h2>${link(page.url, pageLabel(page.url, base))}</h2>`;
      const moved = page.finalUrl
        ? `<p class="meta">${escapeHtml(t('batch.redirected', { page: pageLabel(page.finalUrl, base) }))}</p>`
        : '';
      if (page.status === 'failed')
        return `<section id="page-${index + 1}">${heading}${moved}<p class="bad">${escapeHtml(failureText(page, t))}</p></section>`;
      const sizes = run.sizes
        .map((size, at) => {
          const cell = page.cells[at];
          const title = `<h3>${escapeHtml(size.name)} <span class="num muted">${size.width} × ${size.height}</span></h3>`;
          if (!cell) return `${title}<p class="muted">${escapeHtml(t('batch.notChecked'))}</p>`;
          if (cell.status === 'failed') return `${title}<p class="bad">${escapeHtml(t('batch.cellFailed'))}</p>`;
          if (!cell.issues.length) return `${title}<p class="ok">✓ ${escapeHtml(t('report.noIssues'))}</p>`;
          return `${title}${issueList(cell.issues)}`;
        })
        .join('\n');
      return `<section id="page-${index + 1}">${heading}${moved}${sizes}</section>`;
    })
    .join('\n');

  const footer = reportFooter(input.brand ?? null, t, input.version, input.homepage);

  return `<!doctype html>
<html lang="${input.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Breakpointer ${escapeHtml(input.version)}">
<title>${escapeHtml(t('batch.reportTitle'))}${base ? ` · ${escapeHtml(base)}` : ''}</title>
<style>${STYLES}${input.brand ? BRAND_STYLES : ''}</style>
</head>
<body>
<main>
<header>
${reportEyebrow(input.brand ?? null, t('batch.title'))}
<h1>${escapeHtml(t('batch.reportTitle'))}</h1>
<p class="meta">${base ? `${link(base, base)}<br>` : ''}${escapeHtml(t('batch.counts', { pages: run.pages.length, sizes: run.sizes.length }))}<br>${escapeHtml(t('report.created'))}: ${escapeHtml(input.created.toLocaleString(input.language))}</p>
<p class="meta">${escapeHtml(t('batch.summary', { issues: summary.withIssues, checked: summary.checked }))}${
    run.complete ? '' : ` ${escapeHtml(t('batch.markdownStopped'))}`
  }</p>
</header>
<section class="scroll">
<table>
<thead><tr><th>${escapeHtml(t('batch.page'))}</th>${run.sizes
    .map((size) => `<th>${escapeHtml(size.name)} <span class="num">${size.width}</span></th>`)
    .join('')}<th>${escapeHtml(t('score.column'))}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>
${sections}
<footer>${footer}</footer>
</main>
</body>
</html>
`;
}
