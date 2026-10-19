import { MAX_BATCH_PAGES, parseSitemap, robotsSitemaps } from '../state/batch';

/** How long one request for a sitemap may take. */
const FETCH_TIMEOUT_MS = 8000;
/** Sitemaps read at most (an index lists others; big sites split theirs). */
const MAX_SITEMAPS = 4;

/** A text file of the site, or null. Cookies stay out: a sitemap is public. */
async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: controller.signal });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The pages a site lists in its sitemap: the ones its robots.txt names, else
 * /sitemap.xml, following a sitemap index to the sitemaps it lists. Only pages
 * of `origin`, at most `limit`. Extension pages can read a site's files only
 * where the user allowed the site, so this needs the same access as checking
 * its pages.
 */
export async function sitemapPages(origin: string, limit = MAX_BATCH_PAGES): Promise<string[]> {
  const robots = await fetchText(`${origin}/robots.txt`);
  const queue = robots ? robotsSitemaps(robots) : [];
  if (queue.length === 0) queue.push(`${origin}/sitemap.xml`);
  const pages: string[] = [];
  const seen = new Set<string>();
  while (queue.length && seen.size < MAX_SITEMAPS && pages.length < limit) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    const xml = await fetchText(next);
    if (!xml) continue;
    const { urls, index } = parseSitemap(xml);
    if (index) {
      queue.push(...urls);
      continue;
    }
    for (const url of urls) {
      if (pages.length >= limit) break;
      if (sameSite(url, origin) && !pages.includes(url)) pages.push(url);
    }
  }
  return pages;
}

/** Sitemaps often list the site with or without "www.". */
const bareHost = (href: string) => new URL(href).hostname.replace(/^www\./, '');
const sameSite = (url: string, origin: string) => bareHost(url) === bareHost(origin);
