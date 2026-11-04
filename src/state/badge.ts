import type { ResponsiveScore, ScoreGrade } from './score';

/**
 * The responsive score as a small SVG badge (label on grey, score on the
 * grade's colour), for a README or a client report. Text widths are
 * estimated from Verdana's average advance at 11 px, as badge services do.
 */
export const BADGE_COLORS: Record<ScoreGrade, string> = {
  A: '#1a7f37',
  B: '#4d7c0f',
  C: '#9a6700',
  D: '#bc4c00',
  F: '#cf222e',
};

const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Approximate width of a text in Verdana 11 px. */
export function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (/[ilj.,:;!|'’]/.test(char)) width += 3.4;
    else if (/[mwMW]/.test(char)) width += 10.2;
    else if (/[A-Z0-9]/.test(char)) width += 7.6;
    else if (char === ' ' || char === '·') width += 3.9;
    else width += 6.6;
  }
  return Math.round(width);
}

export function scoreBadgeSvg(score: Pick<ResponsiveScore, 'score' | 'grade'>, label = 'responsive'): string {
  const value = `${score.score} · ${score.grade}`;
  const labelWidth = textWidth(label) + 12;
  const valueWidth = textWidth(value) + 12;
  const width = labelWidth + valueWidth;
  const title = escapeXml(`${label}: ${score.score} (${score.grade})`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>',
    `<clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${BADGE_COLORS[score.grade]}"/><rect width="${width}" height="20" fill="url(#s)"/></g>`,
    '<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">',
    `<text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>`,
    `<text x="${labelWidth + valueWidth / 2}" y="14">${escapeXml(value)}</text>`,
    '</g>',
    '</svg>',
  ].join('');
}

/** A file name for the badge of a page: `responsive-score-example.com.svg`. */
export function badgeFileName(page: string | null): string {
  let host: string;
  try {
    host = page ? new URL(page).hostname.replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  const safe = host.replace(/[^a-z0-9.-]+/gi, '-');
  return safe ? `responsive-score-${safe}.svg` : 'responsive-score.svg';
}
