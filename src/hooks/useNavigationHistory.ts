import { useCallback, useEffect, useState } from 'react';

/** The parts of the Navigation API used here (Chrome 102+). */
type NavigationLike = EventTarget & {
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => { finished: Promise<unknown> };
  forward: () => { finished: Promise<unknown> };
};

const navigationApi = (): NavigationLike | undefined =>
  (window as unknown as { navigation?: NavigationLike }).navigation;

/**
 * Back and forward between the pages the workspace previewed. Each previewed
 * address is a history entry of the workspace, so Chrome's own back button,
 * Alt+← and mouse buttons work too. The Navigation API lists only the
 * workspace's own entries (never the site before it), and its back() and
 * forward() skip the entries that links followed inside a preview add to the tab.
 */
export function useNavigationHistory() {
  const [state, setState] = useState({ canGoBack: false, canGoForward: false });

  useEffect(() => {
    const navigation = navigationApi();
    if (!navigation) return;
    const update = () => setState({ canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward });
    update();
    navigation.addEventListener('currententrychange', update);
    return () => navigation.removeEventListener('currententrychange', update);
  }, []);

  const back = useCallback(() => {
    const navigation = navigationApi();
    if (!navigation) history.back();
    else if (navigation.canGoBack) navigation.back().finished.catch(() => {});
  }, []);

  const forward = useCallback(() => {
    const navigation = navigationApi();
    if (!navigation) history.forward();
    else if (navigation.canGoForward) navigation.forward().finished.catch(() => {});
  }, []);

  return { ...state, back, forward };
}
