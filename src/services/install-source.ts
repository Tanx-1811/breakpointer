import { storeOf, type Store } from '../state/store-links';

/**
 * The store this copy came from (see state/store-links.ts). `management.getSelf`
 * needs no permission.
 */
export async function installStore(): Promise<Store | null> {
  try {
    const self = await chrome.management.getSelf();
    return storeOf(self.updateUrl, self.installType);
  } catch {
    return null;
  }
}
