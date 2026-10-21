/** The public repository: source, issues, releases and the privacy policy. */
export const REPO_URL = 'https://github.com/Tanx-1811/breakpointer';

/** Breakpointer's id on the Chrome Web Store, where it is published (as "Breakpointer — Responsive Viewport Tester"). */
export const CHROME_WEB_STORE_ID = 'naoadcallefanlcneemohjepkficejjh';

/** "Send feedback": GitHub's choice of issue forms (a problem, an idea, a site that won't show). */
export const FEEDBACK_URL = `${REPO_URL}/issues/new/choose`;

/**
 * Breakpointer's home on the web: the "Visit website" link in Chrome, the
 * footer of reports and what "Share Breakpointer" copies (unless it was
 * installed from a store, whose page is shared then).
 */
export const HOMEPAGE_URL = REPO_URL;

/**
 * Where Breakpointer Pro is bought (a checkout page of the payment provider,
 * which emails the licence key). Empty until sales open: the product then
 * offers the free trial and says licences go on sale soon, and
 * `npm run package` refuses to build a release without it unless told to.
 */
export const PRO_CHECKOUT_URL: string = '';
