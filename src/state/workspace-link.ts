import type { ViewportConfig, ViewportTemplate } from '../types';
import { MAX_VIEWPORTS } from '../utils/constants';
import { clampDimension, normalizeName, suggestedZoom } from './viewports';

/**
 * Workspace links: an address of the workspace that opens a page with a set of
 * viewports, to share with a team (anyone with Breakpointer installed from the
 * same place opens the same setup). The viewports are in one parameter:
 * `sizes=375x667~Phone,768x1024.dark~Tablet` — width × height, page colours
 * after a dot, the name after a tilde.
 */
export const SIZES_PARAM = 'sizes';

const ENTRY = /^(\d{3,4})x(\d{3,4})(?:\.(light|dark))?(?:~(.*))?$/;

/** The viewports in the link's form; names lose commas (they separate the viewports). */
export function encodeSizes(viewports: Pick<ViewportConfig, 'width' | 'height' | 'name' | 'colorScheme'>[]): string {
  return viewports
    .slice(0, MAX_VIEWPORTS)
    .map((vp) => {
      const scheme = vp.colorScheme ? `.${vp.colorScheme}` : '';
      const name = vp.name.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      return `${vp.width}x${vp.height}${scheme}${name ? `~${name}` : ''}`;
    })
    .join(',');
}

/** The viewports a link asks for, checked like stored settings (sizes clamped, names cleaned, at most 8). */
export function parseSizes(text: string | null | undefined): ViewportTemplate[] {
  if (!text) return [];
  const templates: ViewportTemplate[] = [];
  for (const entry of text.split(',')) {
    const match = ENTRY.exec(entry.trim());
    if (!match) continue;
    const width = clampDimension(Number(match[1]));
    const height = clampDimension(Number(match[2]));
    templates.push({
      name: normalizeName(match[4] ?? '', width, height),
      width,
      height,
      zoom: suggestedZoom(width, height),
      ...(match[3] ? { colorScheme: match[3] as 'light' | 'dark' } : {}),
    });
    if (templates.length === MAX_VIEWPORTS) break;
  }
  return templates;
}

/** The workspace address that opens `page` (if any) with these viewports. */
export function workspaceLink(
  viewerPage: string,
  page: string | null,
  viewports: Pick<ViewportConfig, 'width' | 'height' | 'name' | 'colorScheme'>[],
): string {
  const params = new URLSearchParams();
  if (page) params.set('url', page);
  if (viewports.length) params.set(SIZES_PARAM, encodeSizes(viewports));
  const query = params.toString();
  return query ? `${viewerPage}?${query}` : viewerPage;
}
