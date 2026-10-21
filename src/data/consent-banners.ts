/**
 * Cookie and consent banners of common consent tools, hidden in previews by
 * "Hide cookie banners" (Pro) so screenshots and checks show the page itself.
 * Only each tool's own ids and classes are listed — never generic names such
 * as `.cookie` that a page may use for its content. Nothing is accepted or
 * refused: the banner is only out of sight in the preview.
 */
export const CONSENT_BANNER_SELECTORS: readonly string[] = [
  // OneTrust
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '.onetrust-pc-dark-filter',
  // Cookiebot
  '#CybotCookiebotDialog',
  '#CybotCookiebotDialogBodyUnderlay',
  // Didomi
  '#didomi-host',
  '.didomi-popup-backdrop',
  // Quantcast Choice
  '#qc-cmp2-container',
  '.qc-cmp2-container',
  // TrustArc
  '#truste-consent-track',
  '#consent_blackbar',
  '.truste_overlay',
  '.truste_box_overlay',
  // Usercentrics
  '#usercentrics-root',
  '#usercentrics-cmp-ui',
  // Osano, and the cookieconsent library
  '.osano-cm-window',
  '.cc-window.cc-banner',
  '.cc-window.cc-floating',
  // Complianz
  '#cmplz-cookiebanner-container',
  // CookieYes
  '.cky-consent-container',
  '.cky-overlay',
  // CookieLawInfo (GDPR Cookie Consent)
  '#cookie-law-info-bar',
  '.cli-modal-backdrop',
  // Cookie Notice
  '#cookie-notice',
  // Borlabs Cookie
  '#BorlabsCookieBox',
  // Klaro
  '.klaro .cookie-notice',
  '.klaro .cookie-modal',
  // iubenda
  '#iubenda-cs-banner',
  // Sourcepoint
  '[id^="sp_message_container_"]',
  // Google's consent messages (Funding Choices)
  '.fc-consent-root',
  // Axeptio
  '#axeptio_overlay',
  // Ketch
  '#lanyard_root',
  // Shopify
  '#shopify-pc__banner',
  // HubSpot
  '#hs-eu-cookie-confirmation',
  // Moove GDPR
  '#moove_gdpr_cookie_info_bar',
  // Cookie Script
  '#cookiescript_injected',
  // consentmanager
  '#cmpbox',
  '#cmpbox2',
  // Piwik PRO
  '#ppms_cm_popup_overlay',
  // Commanders Act TrustCommander
  '#tc-privacy-wrapper',
  '#footer_tc_privacy',
  // CookieHub
  '.ch2-container',
];

/** Classes some tools put on `<html>` or `<body>` to stop the page scrolling while their banner shows. */
export const CONSENT_SCROLL_LOCKS: readonly string[] = ['didomi-popup-open', 'sp-message-open', 'qc-cmp-ui-showing'];

/** The style that hides the banners and lets the page scroll again. */
export function consentBannerCss(): string {
  const locks = CONSENT_SCROLL_LOCKS.flatMap((name) => [`html.${name}`, `body.${name}`]).join(',');
  return `${CONSENT_BANNER_SELECTORS.join(',')}{display:none !important}${locks}{overflow:visible !important}`;
}
