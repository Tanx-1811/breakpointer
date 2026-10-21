import type { Translate } from '../i18n/translate';
import type { BrandingSettings } from '../types';

/**
 * "Your brand on reports" (Pro): a name, a link and a small logo shown on the
 * reports and images people send to their clients, instead of Breakpointer.
 */

export const MAX_BRAND_NAME = 60;
export const MAX_BRAND_URL = 300;
/** A logo file of at most 150 KB, as a data: URL (base64 makes it a third longer). */
export const MAX_LOGO_BYTES = 150 * 1024;
export const MAX_LOGO_URL = Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 32;

/** Images only, in formats every browser shows and that can't run script (no SVG). */
export const SAFE_LOGO = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const SAFE_LINK = /^https?:\/\/[^\s"'<>]+$/i;

export const EMPTY_BRANDING: BrandingSettings = { name: '', url: '', logo: '', credit: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const normalizeBrandName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_BRAND_NAME);

/** A web address for the brand, or '' when it isn't one (only http and https). */
export function normalizeBrandUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_BRAND_URL || !SAFE_LINK.test(trimmed)) return '';
  try {
    return new URL(trimmed).href;
  } catch {
    return '';
  }
}

export const isSafeLogo = (logo: string) => logo.length <= MAX_LOGO_URL && SAFE_LOGO.test(logo);

/** Stored or imported branding is untrusted: each field is checked on its own. */
export function parseBranding(raw: unknown): BrandingSettings {
  if (!isRecord(raw)) return { ...EMPTY_BRANDING };
  return {
    name: typeof raw.name === 'string' ? normalizeBrandName(raw.name) : '',
    url: typeof raw.url === 'string' ? normalizeBrandUrl(raw.url) : '',
    logo: typeof raw.logo === 'string' && isSafeLogo(raw.logo) ? raw.logo : '',
    credit: raw.credit !== false,
  };
}

/** The branding to use: only with Pro, and only once it has a name or a logo. */
export function activeBranding(branding: BrandingSettings, pro: boolean): BrandingSettings | null {
  if (!pro || (!branding.name && !branding.logo)) return null;
  return branding;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ESCAPES[char]!);

/** Styles of the brand in report headers (added to each report's own). */
export const BRAND_STYLES =
  '.brand{display:flex;align-items:center;gap:10px;margin:0 0 6px}.brand img{display:block;max-height:40px;max-width:200px;width:auto;height:auto}.brand .eyebrow{margin:0}';

/**
 * The line above a report's title: "Breakpointer · Responsive report", or the
 * brand's logo and name instead.
 */
export function reportEyebrow(brand: BrandingSettings | null, section: string): string {
  if (!brand) return `<p class="eyebrow">Breakpointer · ${escapeHtml(section)}</p>`;
  const logo = brand.logo && isSafeLogo(brand.logo) ? `<img src="${brand.logo}" alt="${escapeHtml(brand.name)}">` : '';
  const name = brand.name ? `<p class="eyebrow">${escapeHtml(brand.name)} · ${escapeHtml(section)}</p>` : '';
  return `<div class="brand">${logo}${name}</div>`;
}

/**
 * A report's footer: Breakpointer's line, or "Prepared by" the brand (linked
 * to its site) — followed by Breakpointer's line only when the brand keeps the
 * credit.
 */
export function reportFooter(
  brand: BrandingSettings | null,
  t: Translate,
  version: string,
  homepage: string | undefined,
): string {
  const madeWith = escapeHtml(t('report.footer', { version })).replace(
    'Breakpointer',
    homepage && SAFE_LINK.test(homepage) ? `<a href="${escapeHtml(homepage)}">Breakpointer</a>` : 'Breakpointer',
  );
  if (!brand || !brand.name) return brand && !brand.credit ? escapeHtml(t('report.privateNote')) : madeWith;
  const name =
    brand.url && SAFE_LINK.test(brand.url)
      ? `<a href="${escapeHtml(brand.url)}" rel="noopener noreferrer">${escapeHtml(brand.name)}</a>`
      : escapeHtml(brand.name);
  const prepared = escapeHtml(t('report.preparedBy', { brand: '\u0000' })).replace('\u0000', name);
  return brand.credit ? `${prepared}<br>${madeWith}` : `${prepared}<br>${escapeHtml(t('report.privateNote'))}`;
}

/** The brand in an image's footer ("Acme Studio · 21 Oct 2026, 10:42"), or Breakpointer. */
export const imageFooterName = (brand: BrandingSettings | null) => brand?.name || 'Breakpointer';
