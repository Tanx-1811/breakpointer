/**
 * Messages between the workspace and the small agent script that runs inside
 * preview frames of sites the user has allowed (see docs/ARCHITECTURE.md).
 * Shared by both sides, so it holds only types and constants: the agent is
 * bundled on its own and must stay small.
 */

export const AGENT_SOURCE = 'breakpointer-agent';
export const AGENT_SCRIPT_ID = 'breakpointer-agent';

export type CheckKind =
  | 'overflow'
  | 'viewport-meta'
  | 'small-text'
  | 'tap-targets'
  /** Images shown larger than their real size (they look blurry). */
  | 'upscaled-images'
  /** Fixed or stuck elements covering much of a phone or tablet screen. */
  | 'fixed-cover'
  /** Text cut off by its own box (overflow hidden, without an ellipsis). */
  | 'clipped-text'
  /** Text whose contrast with a known, solid background is under WCAG AA (4.5:1, 3:1 for large text). */
  | 'low-contrast'
  /** The layout moved while the page loaded: a cumulative layout shift of 0.1 or more. */
  | 'layout-shift'
  /** Images without a text alternative (no `alt`, and not hidden from assistive technology). Pro. */
  | 'missing-alt'
  /** Buttons and links with no accessible name (icon-only, no label). Pro. */
  | 'unnamed-control'
  /** Form fields with no label (no `<label>`, `aria-label`, title or placeholder). Pro. */
  | 'unlabeled-field'
  /** Focusable elements the user can't see at this size: off screen, or hidden from assistive technology. Pro. */
  | 'hidden-focus'
  /** The page's language isn't set (`<html lang>`). Pro. */
  | 'missing-lang';

/** Every check, in the order they are shown. */
export const CHECK_KINDS: readonly CheckKind[] = [
  'overflow',
  'viewport-meta',
  'small-text',
  'tap-targets',
  'clipped-text',
  'low-contrast',
  'upscaled-images',
  'fixed-cover',
  'layout-shift',
  'missing-alt',
  'unnamed-control',
  'unlabeled-field',
  'hidden-focus',
  'missing-lang',
];

export type CheckSample = {
  /** A short CSS-like description, e.g. "div.hero > img". */
  selector: string;
  /** Extra detail, e.g. "+184px" or "11px". */
  detail?: string;
};

export type CheckIssue = {
  kind: CheckKind;
  /** How many elements are affected (1 for page-level issues). */
  count: number;
  /** Page-level detail, e.g. the overflow amount or the viewport meta content. */
  detail?: string;
  samples: CheckSample[];
};

export type CheckReport = {
  width: number;
  issues: CheckIssue[];
};

/** Breakpoints found in the page's own stylesheets. */
export type MediaReport = {
  /** Widths (CSS px) where a media query starts or stops applying, sorted. */
  breakpoints: number[];
  /** Stylesheets the page loads from another origin without CORS, which can't be read. */
  unreadable: number;
  /** The page has styles for `prefers-color-scheme`. */
  colorScheme: boolean;
};

/** A forced `prefers-color-scheme` for one preview; null follows the browser. */
export type ColorSchemeOverride = 'light' | 'dark' | null;

/** Where the user is in a page, so other previews can show the same content. */
export type ScrollAnchor = {
  /** Selectors of the element at the reading line and up to two ancestors (first found wins). */
  selectors: string[];
  /** For each selector, where the reading line falls inside that element (0 = top, 1 = bottom). */
  offsets: number[];
  /** The reading line, as a fraction of the window height. */
  line: number;
};

/** What the inspector shows about one element at one viewport size. */
export type ElementInfo = {
  /** Short description, e.g. "main > section.hero > h1". */
  label: string;
  /** Rendered size and position on the page, in CSS pixels. */
  width: number;
  height: number;
  top: number;
  left: number;
  /** False when not rendered at this size (display: none, hidden, zero size). */
  visible: boolean;
  display: string;
  position: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  margin: string;
  padding: string;
  /** Flex or grid details, e.g. "row wrap · gap 16px" or "3 columns · gap 24px". */
  layout: string;
};

/** Where an element is in the preview's window (CSS pixels), e.g. to crop a screenshot to it. */
export type ElementRect = { x: number; y: number; width: number; height: number };

/**
 * Numbers about how the page loaded at this size — never its content. Sizes are
 * what the browser reports: other sites' files only count when they share their
 * timing (`Timing-Allow-Origin`), and files from the cache weigh nothing.
 */
export type PageStats = {
  /** Files the page loaded after the document (scripts, styles, images, fonts, API calls). */
  requests: number;
  /** Bytes transferred for the document and the files whose size is known. */
  transferred: number;
  /** Files whose size isn't known (another site that doesn't share it, or the cache). */
  unknownSize: number;
  /** Images shown on the page (loaded, visible). */
  images: number;
  /** Pixels of those image files (their natural size)… */
  imagePixels: number;
  /** …and of the area they are shown at, in CSS pixels. */
  shownPixels: number;
  /** Device pixels per CSS pixel of this screen: images need this density to look sharp. */
  dpr: number;
  /** Elements in the document. */
  elements: number;
  /** The page's height in CSS pixels. */
  height: number;
  /** Largest contentful paint, in milliseconds from the start of the navigation; null when not reported. */
  lcp: number | null;
  /** Cumulative layout shift: the worst burst of layout shifts while the page was used. */
  cls: number;
  /** Web fonts loaded. */
  fonts: number;
};

/** The type used by one kind of element (the first one shown), for the type scale. */
export type TypeSample = {
  /** e.g. "h1", "p", "button". */
  tag: string;
  /** How many of them the page shows. */
  count: number;
  /** In CSS pixels. */
  fontSize: number;
  /** In CSS pixels; null for `normal`. */
  lineHeight: number | null;
  fontWeight: string;
  /** The first family of the font stack, e.g. "Inter". */
  fontFamily: string;
};

/**
 * Something the user did in one preview that the others do too (synced
 * interactions). Elements are found by structural selector, as the inspector
 * does. Submitting a form is never repeated, and neither is typing in password
 * or payment fields.
 */
export type Interaction =
  | { kind: 'click'; selector: string }
  /** The value of a text field, text area or select changed. */
  | { kind: 'value'; selector: string; value: string }
  /** A checkbox or radio button was switched. */
  | { kind: 'checked'; selector: string; checked: boolean };

/** Agent → workspace. `name` identifies the preview frame (its iframe `name`). */
export type AgentEvent =
  /**
   * A page started (or the workspace asked again). `status` is the HTTP status
   * the page was served with (Navigation Timing; 0 when unknown).
   */
  | { type: 'hello'; href: string; title: string; status?: number }
  /** The address changed without a new page (single-page app routes, history.replaceState). */
  | { type: 'location'; href: string; title: string }
  /** The page is unloading (the next page may be on a site without an agent). */
  | { type: 'bye' }
  /** The user clicked or typed in the page (sent at most once a second). */
  | { type: 'input' }
  /** The user clicked or changed a field, to be done in the other previews (only while asked to with `mirror`). */
  | { type: 'interaction'; interaction: Interaction }
  /**
   * The page scrolled. `y` is the scroll position in CSS pixels (a design
   * overlay follows it). `synced` marks a scroll the workspace asked for (synced
   * scrolling, a highlight): only reported when asked to with `trackScroll`.
   */
  | { type: 'scroll'; ratio: number; anchor?: ScrollAnchor; y: number; synced?: boolean }
  /** Ctrl + wheel (or a pinch) over the page: zoom the workspace instead of the browser tab. */
  | { type: 'zoom'; direction: 1 | -1 }
  | { type: 'checks'; report: CheckReport }
  | { type: 'media'; report: MediaReport }
  /** The user picked an element while inspecting. */
  | { type: 'pick'; selector: string; element: ElementInfo }
  /** The selected element at this size (null when the page has no such element). */
  | { type: 'element'; selector: string; element: ElementInfo | null }
  /** A key the workspace handles was pressed inside the preview (only while inspecting). */
  | { type: 'key'; key: 'Escape' }
  /** Answer to `pageMetrics`: the page's height and the window's, in CSS pixels. */
  | { type: 'metrics'; id?: number; scrollHeight: number; viewportHeight: number; scrollY: number }
  /** Answer to `captureScroll`, once the page has painted at its new position. */
  | { type: 'scrolled'; id?: number; y: number }
  /** Answer to `scanProbe`: the checks at that width (the window's real width) and the page's height. */
  | { type: 'scanned'; id?: number; width: number; report: CheckReport; height: number }
  /** Answer to `getStats`. */
  | { type: 'stats'; id?: number; stats: PageStats }
  /** Answer to `getTypeScale`. */
  | { type: 'typeScale'; id?: number; samples: TypeSample[] }
  /** Answer to `getElementRect` (null when the element isn't shown). */
  | { type: 'elementRect'; id?: number; rect: ElementRect | null }
  /**
   * Answer to `getLinks`: the addresses of the page's links to other pages of
   * the same site, in document order, without fragments — never their text.
   */
  | { type: 'links'; id?: number; hrefs: string[] };

/** Events that answer a request from the workspace; they carry the `id` of the request. */
export type AgentReplyType = 'metrics' | 'scrolled' | 'scanned' | 'stats' | 'typeScale' | 'elementRect' | 'links';
export type AgentReply = Extract<AgentEvent, { type: AgentReplyType }>;

export type AgentMessage = AgentEvent & { source: typeof AGENT_SOURCE; name: string };

/** Workspace → agent. */
type Command =
  /** Say hello again (the workspace started listening after the page loaded). */
  | { type: 'ping' }
  /**
   * Scroll to `ratio` of the page (or to the content of `anchor`). With `y`, to
   * that position instead — the one a preview had before it reloaded — once the
   * page is tall enough (it may still be loading).
   */
  | { type: 'scrollTo'; ratio: number; anchor?: ScrollAnchor; y?: number }
  | { type: 'outlines'; on: boolean }
  /** Hide the page's scrollbars, like on phones and tablets (they take no room there). */
  | { type: 'scrollbars'; hidden: boolean }
  | { type: 'css'; css: string }
  | { type: 'highlight'; kind: CheckKind | null }
  /** Run the checks (all but those in `skip`), or stop. */
  | { type: 'checks'; enabled: boolean; skip?: CheckKind[] }
  | { type: 'colorScheme'; scheme: ColorSchemeOverride }
  /** Pick mode: hovering outlines elements, a click selects one instead of activating it. */
  | { type: 'inspect'; on: boolean }
  /** Outline this element (or none) and report its details, also after the layout changes. */
  | { type: 'select'; selector: string | null }
  /** Also report scrolls the workspace caused (a design overlay follows them); reports the position at once. */
  | { type: 'trackScroll'; on: boolean }
  /**
   * Layout stress tests: pseudo-translated text (longer, accented, in brackets),
   * right-to-left direction, WCAG text spacing and text at 200% (every font size
   * doubled, as with text-only zoom). Everything is restored.
   */
  | { type: 'stress'; pseudo: boolean; rtl: boolean; spacing: boolean; textZoom?: boolean }
  /**
   * The page's styles for preferences the browser doesn't have:
   * `prefers-reduced-motion: reduce`, `prefers-contrast: more`, and `@media print`.
   */
  | { type: 'preferences'; reducedMotion: boolean; moreContrast: boolean; print: boolean }
  /**
   * Labels drawn over the page: each image's sizes, the keyboard (Tab) order,
   * and the columns and rows of grid containers and the direction of flex ones.
   */
  | { type: 'annotate'; images: boolean; tabOrder: boolean; layout?: boolean }
  /** Full-page screenshots: report the page's size… */
  | { type: 'pageMetrics' }
  /** …scroll to `y` (hiding fixed and stuck elements after the first screen) and say when painted… */
  | { type: 'captureScroll'; y: number; hideFixed: boolean }
  /** …and show those elements again. */
  | { type: 'captureEnd' }
  /** Freeze CSS animations and transitions (for steady screenshots). */
  | { type: 'animations'; paused: boolean }
  /**
   * The width scanner: once the window is `width` wide (the workspace resizes
   * the frame), run the checks and answer `scanned`.
   */
  | { type: 'scanProbe'; width: number }
  /** Answer `stats`. */
  | { type: 'getStats' }
  /** Answer `typeScale`. */
  | { type: 'getTypeScale' }
  /** Answer `elementRect` for the element (scrolled into view first with `reveal`). */
  | { type: 'getElementRect'; selector: string; reveal: boolean }
  /** Answer `links` (Check pages: the pages this one links to). */
  | { type: 'getLinks' }
  /** Hide cookie and consent banners of the common consent tools (nothing is accepted or refused). */
  | { type: 'cookieBanners'; hidden: boolean }
  /** Report the user's clicks and field changes as `interaction` events. */
  | { type: 'mirror'; on: boolean }
  /** Do what the user did in another preview (skipped when the element isn't shown here). */
  | { type: 'replay'; interaction: Interaction };

/** A command as sent: a request that is answered carries an `id`, sent back with its answer. */
export type AgentCommand = Command & { id?: number };
