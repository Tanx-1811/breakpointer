import type { CheckReport } from '../agent/protocol';
import type { Language, Translate } from '../i18n/translate';
import { CHECK_KIND_KEYS, issueDetail } from './checks';

export type ReportCard = {
  name: string;
  width: number;
  height: number;
  zoom: number;
  breakpoint: string | null;
  /** A data: URL of the preview as shown on screen, if it could be captured. */
  image: string | null;
  /** Responsive check results; null when the site couldn't be checked. */
  checks: CheckReport | null;
};

export type ReportInput = {
  url: string;
  title: string;
  created: Date;
  version: string;
  language: Language;
  cards: ReportCard[];
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const SAFE_LINK = /^https?:\/\//i;

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:#f6f7f9;color:#1f2430;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 20px 48px}
a{color:#4338ca;overflow-wrap:anywhere}
.eyebrow{margin:0;color:#4f46e5;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
h1{margin:4px 0 6px;font-size:28px;line-height:1.2;overflow-wrap:anywhere}
h2{margin:0 0 12px;font-size:18px}
.meta{margin:0;color:#5b6472;font-size:13px}
section{margin-top:24px;padding:20px;border:1px solid #e3e6eb;border-radius:14px;background:#fff}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid #e3e6eb;text-align:left;vertical-align:top}
th{color:#5b6472;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.tag{display:inline-block;padding:0 8px;border-radius:999px;background:#eef0ff;color:#4338ca;font:600 12px/20px ui-monospace,SFMono-Regular,Menlo,monospace}
.ok{color:#15803d;font-weight:600}
.warn{color:#b45309;font-weight:600}
.muted{color:#5b6472}
.card h2 span{margin-left:8px;color:#5b6472;font:500 14px ui-monospace,SFMono-Regular,Menlo,monospace}
figure{margin:12px 0 16px}
figure img{display:block;max-width:100%;height:auto;border:1px solid #e3e6eb;border-radius:8px}
.noimg{padding:24px;border:1px dashed #c9ced6;border-radius:8px;color:#5b6472;text-align:center}
.issues{margin:0;padding:0;list-style:none}
.issues>li{padding:10px 12px;border:1px solid #f3d9a4;border-radius:8px;background:#fffbeb}
.issues>li+li{margin-top:8px}
.samples{margin:6px 0 0;padding-left:18px;color:#5b6472;font-size:13px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow-wrap:anywhere}
footer{margin-top:28px;color:#5b6472;font-size:12px}
@media print{body{background:#fff}section{break-inside:avoid;border-color:#ccc}}
`;

/**
 * A self-contained HTML report (no scripts, no external files) of the page at
 * every visible viewport: a screenshot and the responsive check results.
 */
export function buildReportHtml(input: ReportInput, t: Translate): string {
  const { cards } = input;
  const heading = escapeHtml(input.title.trim() || input.url);
  const url = escapeHtml(input.url);
  const link = SAFE_LINK.test(input.url) ? `<a href="${url}" rel="noopener noreferrer">${url}</a>` : url;
  const created = escapeHtml(input.created.toLocaleString(input.language));

  const issueCount = (card: ReportCard) => {
    if (!card.checks) return '<span class="muted">—</span>';
    const count = card.checks.issues.length;
    return count ? `<span class="warn">⚠ ${count}</span>` : '<span class="ok">✓</span>';
  };

  const rows = cards
    .map(
      (card, index) => `<tr>
<td><a href="#vp-${index + 1}">${escapeHtml(card.name)}</a></td>
<td class="num">${card.width} × ${card.height}</td>
<td>${card.breakpoint ? `<span class="tag">${escapeHtml(card.breakpoint)}</span>` : '—'}</td>
<td>${issueCount(card)}</td>
</tr>`,
    )
    .join('\n');

  const issues = (card: ReportCard) => {
    if (!card.checks) return `<p class="muted">${escapeHtml(t('report.notChecked'))}</p>`;
    if (!card.checks.issues.length) return `<p class="ok">✓ ${escapeHtml(t('report.noIssues'))}</p>`;
    return `<ul class="issues">${card.checks.issues
      .map((issue) => {
        const samples = issue.samples.length
          ? `<ul class="samples">${issue.samples
              .map(
                (sample) =>
                  `<li><code>${escapeHtml(sample.selector)}</code>${sample.detail ? ` · ${escapeHtml(sample.detail)}` : ''}</li>`,
              )
              .join('')}</ul>`
          : '';
        return `<li><strong>${escapeHtml(t(CHECK_KIND_KEYS[issue.kind]))}</strong><br>${escapeHtml(issueDetail(issue, t))}${samples}</li>`;
      })
      .join('')}</ul>`;
  };

  const sections = cards
    .map((card, index) => {
      const size = `${card.width} × ${card.height}`;
      const image =
        card.image && SAFE_IMAGE.test(card.image)
          ? `<img src="${card.image}" alt="${escapeHtml(`${card.name}, ${size}`)}">`
          : `<div class="noimg">${escapeHtml(t('report.noImage'))}</div>`;
      const meta = [
        `${escapeHtml(t('report.zoom'))} ${Math.round(card.zoom * 100)}%`,
        card.breakpoint
          ? `${escapeHtml(t('report.breakpoint'))} <span class="tag">${escapeHtml(card.breakpoint)}</span>`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return `<section class="card" id="vp-${index + 1}">
<h2>${escapeHtml(card.name)}<span>${size}</span></h2>
<p class="meta">${meta}</p>
<figure>${image}</figure>
${issues(card)}
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="${input.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Breakpointer ${escapeHtml(input.version)}">
<title>${escapeHtml(t('report.title'))} · ${heading}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<header>
<p class="eyebrow">Breakpointer · ${escapeHtml(t('report.title'))}</p>
<h1>${heading}</h1>
<p class="meta">${escapeHtml(t('report.page'))}: ${link}<br>${escapeHtml(t('report.created'))}: ${created}</p>
</header>
<section>
<h2>${escapeHtml(t('report.summary'))}</h2>
<table>
<thead><tr><th>${escapeHtml(t('report.viewport'))}</th><th>${escapeHtml(t('report.size'))}</th><th>${escapeHtml(t('report.breakpoint'))}</th><th>${escapeHtml(t('report.issues'))}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>
${sections}
<footer>${escapeHtml(t('report.footer', { version: input.version }))}</footer>
</main>
</body>
</html>
`;
}
