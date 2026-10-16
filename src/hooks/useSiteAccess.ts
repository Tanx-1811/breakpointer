import { useCallback, useEffect, useState } from 'react';
import { addSessionGrant, forgetSessionGrants, sessionGrants } from '../services/session-access';
import {
  hasAllSitesAccess,
  hasSiteAccess,
  listGrantedPatterns,
  onSiteAccessChanged,
  requestAllSitesAccess,
  requestSiteAccess,
  revokePatterns,
} from '../services/site-access';
import { siteAccessPattern } from '../utils/url';

export type SiteAccessState = {
  /** Access to the current preview's site; null while unknown or without a URL. */
  site: boolean | null;
  allSites: boolean;
  granted: string[];
  /** Granted patterns that are removed when Chrome starts again. */
  session: string[];
};

async function readAccess(href: string | null): Promise<SiteAccessState> {
  const [site, allSites, granted, session] = await Promise.all([
    href ? hasSiteAccess(new URL(href)) : Promise.resolve(null),
    hasAllSitesAccess(),
    listGrantedPatterns().catch(() => [] as string[]),
    sessionGrants(),
  ]);
  return { site, allSites, granted, session: session.filter((pattern) => granted.includes(pattern)) };
}

/** Host access for the current site, kept in sync with grants made anywhere in the extension. */
export function useSiteAccess(url: URL | null) {
  const href = url?.href ?? null;
  const [state, setState] = useState<SiteAccessState & { href: string | null }>({
    href: null,
    site: null,
    allSites: false,
    granted: [],
    session: [],
  });
  const [refresh, setRefresh] = useState(0);

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
  }, [href, refresh]);

  const allowSite = useCallback(async () => {
    if (!href) return false;
    const url = new URL(href);
    // Asked first, while the click still counts as a user gesture.
    const granted = await requestSiteAccess(url);
    // Allowing for good what was allowed until Chrome closes.
    if (granted) await forgetSessionGrants([siteAccessPattern(url)]);
    return granted;
  }, [href]);
  /** Access to the current site that is removed the next time Chrome starts. */
  const allowSiteForSession = useCallback(async () => {
    if (!href) return false;
    const url = new URL(href);
    const granted = await requestSiteAccess(url);
    if (granted) {
      await addSessionGrant(siteAccessPattern(url));
      setRefresh((count) => count + 1);
    }
    return granted;
  }, [href]);
  const allowAllSites = useCallback(() => requestAllSitesAccess(), []);
  // Revoking fires chrome.permissions.onRemoved, which refreshes the state.
  const revoke = useCallback(async (patterns: string[]) => {
    const removed = await revokePatterns(patterns);
    if (removed) await forgetSessionGrants(patterns);
    return removed;
  }, []);
  /** Keeps access granted until Chrome closes after that too. */
  const keep = useCallback(async (pattern: string) => {
    await forgetSessionGrants([pattern]);
    setRefresh((count) => count + 1);
  }, []);

  // Until the check for a new URL finishes, its access is unknown.
  const site = state.href === href ? state.site : null;
  return {
    site,
    allSites: state.allSites,
    granted: state.granted,
    session: state.session,
    allowSite,
    allowSiteForSession,
    allowAllSites,
    revoke,
    keep,
  };
}
