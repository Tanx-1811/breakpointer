/** The stores Breakpointer can be installed from. */
export type Store = 'chrome' | 'edge';

/**
 * The store this copy was installed from, told by the address Chrome updates
 * it from; null when it wasn't installed from a store (unpacked, sideloaded,
 * installed by an administrator).
 */
export function storeOf(updateUrl: string | undefined, installType: string | undefined): Store | null {
  if (installType !== 'normal' || !updateUrl) return null;
  let host: string;
  try {
    host = new URL(updateUrl).hostname;
  } catch {
    return null;
  }
  if (host === 'clients2.google.com' || host.endsWith('.google.com')) return 'chrome';
  if (host === 'edge.microsoft.com' || host.endsWith('.microsoft.com')) return 'edge';
  return null;
}

/** The store's page of the extension with id `id`. */
export function listingUrl(store: Store, id: string): string {
  const safe = encodeURIComponent(id);
  return store === 'chrome'
    ? `https://chromewebstore.google.com/detail/breakpointer/${safe}`
    : `https://microsoftedge.microsoft.com/addons/detail/${safe}`;
}

/** Where to rate it: the store's reviews (Edge shows them on the listing). */
export function reviewUrl(store: Store, id: string): string {
  return store === 'chrome' ? `${listingUrl(store, id)}/reviews` : listingUrl(store, id);
}
