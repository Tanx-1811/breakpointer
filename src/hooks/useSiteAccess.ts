import { useCallback, useEffect, useState } from 'react';
import {
  hasAllSitesAccess,
  hasSiteAccess,
  listGrantedPatterns,
  onSiteAccessChanged,
  requestAllSitesAccess,
  requestSiteAccess,
  revokePatterns,
} from '../services/site-access';

export type SiteAccessState = {
  /** Access to the current preview's site; null while unknown or without a URL. */
  site: boolean | null;
  allSites: boolean;
  granted: string[];
};

async function readAccess(href: string | null): Promise<SiteAccessState> {
  const [site, allSites, granted] = await Promise.all([
    href ? hasSiteAccess(new URL(href)) : Promise.resolve(null),
    hasAllSitesAccess(),
    listGrantedPatterns().catch(() => []),
  ]);
  return { site, allSites, granted };
}

/** Host access for the current site, kept in sync with grants made anywhere in the extension. */
export function useSiteAccess(url: URL | null) {
  const href = url?.href ?? null;
  const [state, setState] = useState<SiteAccessState & { href: string | null }>({
    href: null,
    site: null,
    allSites: false,
    granted: [],
  });

  useEffect(() => {
    let active = true;
    const load = () =>
      readAccess(href).then((next) => {
        if (active) setState({ ...next, href });
      });
    void load();
    const unsubscribe = onSiteAccessChanged(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [href]);

  const allowSite = useCallback(async () => (href ? requestSiteAccess(new URL(href)) : false), [href]);
  const allowAllSites = useCallback(() => requestAllSitesAccess(), []);
  // Revoking fires chrome.permissions.onRemoved, which refreshes the state.
  const revoke = useCallback((patterns: string[]) => revokePatterns(patterns), []);

  // Until the check for a new URL finishes, its access is unknown.
  const site = state.href === href ? state.site : null;
  return { site, allSites: state.allSites, granted: state.granted, allowSite, allowAllSites, revoke };
}
