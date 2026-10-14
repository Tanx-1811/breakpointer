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
  | 'fixed-cover';

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

/** Agent → workspace. `name` identifies the preview frame (its iframe `name`). */
export type AgentEvent =
  | { type: 'hello'; href: string; title: string }
  /** The address changed without a new page (single-page app routes, history.replaceState). */
  | { type: 'location'; href: string; title: string }
  /** The page is unloading (the next page may be on a site without an agent). */
  | { type: 'bye' }
  /** The user clicked or typed in the page (sent at most once a second). */
  | { type: 'input' }
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
  | { type: 'key'; key: 'Escape' };

export type AgentMessage = AgentEvent & { source: typeof AGENT_SOURCE; name: string };

/** Workspace → agent. */
export type AgentCommand =
  /** Say hello again (the workspace started listening after the page loaded). */
  | { type: 'ping' }
  | { type: 'scrollTo'; ratio: number; anchor?: ScrollAnchor }
  | { type: 'outlines'; on: boolean }
  /** Hide the page's scrollbars, like on phones and tablets (they take no room there). */
  | { type: 'scrollbars'; hidden: boolean }
  | { type: 'css'; css: string }
  | { type: 'highlight'; kind: CheckKind | null }
  | { type: 'checks'; enabled: boolean }
  | { type: 'colorScheme'; scheme: ColorSchemeOverride }
  /** Pick mode: hovering outlines elements, a click selects one instead of activating it. */
  | { type: 'inspect'; on: boolean }
  /** Outline this element (or none) and report its details, also after the layout changes. */
  | { type: 'select'; selector: string | null }
  /** Also report scrolls the workspace caused (a design overlay follows them); reports the position at once. */
  | { type: 'trackScroll'; on: boolean }
  /**
   * Layout stress tests: pseudo-translated text (longer, accented, in brackets)
   * and right-to-left direction. The original text and direction are restored.
   */
  | { type: 'stress'; pseudo: boolean; rtl: boolean }
  /** Show the page's `prefers-reduced-motion: reduce` styles whatever the browser prefers. */
  | { type: 'reducedMotion'; on: boolean }
  /** Freeze CSS animations and transitions (for steady screenshots). */
  | { type: 'animations'; paused: boolean };
