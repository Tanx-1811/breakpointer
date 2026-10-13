/** The address without its #fragment: moving within a page isn't a new page. */
export function pageOf(url: string): string {
  return url.split('#')[0]!;
}

/** Query or fragment parameters that make an address single-use or secret. */
const ONE_TIME_PARAMS = new Set([
  'code',
  'token',
  'access_token',
  'id_token',
  'refresh_token',
  'auth_token',
  'oauth_token',
  'oauth_verifier',
  'ticket',
  'samlresponse',
  'samlrequest',
  'session_state',
  'otp',
  'key',
  'signature',
  'sig',
  'nonce',
]);

/**
 * True for addresses that must not be opened again in other previews (or
 * remembered): sign-in callbacks (`?code=…&state=…`), magic links, password
 * resets and signed links. Loading one several times can fail, or make the
 * provider revoke the sign-in.
 */
export function isOneTimeUrl(href: string): boolean {
  try {
    const url = new URL(href);
    const keys = [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()];
    return keys.some((key) => ONE_TIME_PARAMS.has(key.toLowerCase()));
  } catch {
    return true;
  }
}
