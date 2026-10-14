import { useEffect, useState } from 'react';

/** The parts of the Navigation API used here (Chrome 102+). */
type NavigationLike = EventTarget & { canGoBack: boolean; canGoForward: boolean };

/**
 * Whether the workspace tab can go back or forward to another page it
 * previewed. Each previewed address is a history entry of the workspace, so
 * Chrome's own back button, Alt+← and mouse buttons work too. The Navigation
 * API only lists entries of the workspace itself, never the site before it.
 */
export function useNavigationHistory(): { canGoBack: boolean; canGoForward: boolean } {
  const [state, setState] = useState({ canGoBack: false, canGoForward: false });

  useEffect(() => {
    const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
    if (!navigation) return;
    const update = () => setState({ canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward });
    update();
    navigation.addEventListener('currententrychange', update);
    return () => navigation.removeEventListener('currententrychange', update);
  }, []);

  return state;
}
