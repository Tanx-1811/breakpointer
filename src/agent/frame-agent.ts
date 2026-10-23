/**
 * Breakpointer frame agent. Registered as a content script only while a
 * workspace tab is open, and only effective on sites the user allowed. It does
 * nothing unless it runs in a preview frame placed directly in a Breakpointer
 * workspace; on every other page it returns immediately.
 *
 * It never sends page content anywhere: it reports the page address and title,
 * scroll position, the results of layout checks, the widths used by the page's
 * media queries and the box of an element the user inspects — to the workspace
 * tab only. Stress tests (pseudo-translated text, right-to-left) change the
 * page only inside the preview and are undone when switched off. With synced
 * interactions on, the user's clicks and field values go to the other previews
 * of the same workspace (never form submissions, passwords or payment fields).
 */
import { consentBannerCss } from '../data/consent-banners';
import { blend, contrastRatio, formatRatio, toHex, type Rgb } from '../state/contrast';
import {
  CONTROL_SELECTOR,
  FIELD_SELECTOR,
  FOCUSABLE_SELECTOR,
  accessibleName,
  clickTarget,
  hiddenFromAssistiveTech,
  inTabOrder,
  isSensitiveField,
  lacksTextAlternative,
  mirrorsClick,
} from './a11y';
import {
  compressBox,
  cssPath,
  cumulativeLayoutShift,
  cutOff,
  describeElement,
  distributeTracks,
  firstFontFamily,
  formatShift,
  gridTracks,
  imageDensity,
  isLargeText,
  isVectorImage,
  parseCssColor,
  mediaQueryEdges,
  mentionsColorScheme,
  mentionsMediaType,
  mentionsPrefersContrast,
  mentionsReducedMotion,
  printMedia,
  pseudoLocalize,
  scheduler,
  swapColorScheme,
  swapPrefersContrast,
  swapReducedMotion,
  tabOrder,
  TEXT_SPACING_CSS,
  type ShiftEntry,
} from './page-utils';
import {
  AGENT_SOURCE,
  type AgentCommand,
  type AgentEvent,
  type CheckIssue,
  type CheckKind,
  type CheckReport,
  type CheckSample,
  type ColorSchemeOverride,
  type ElementInfo,
  type ColorCount,
  type ColorSample,
  type ElementRect,
  type ImageSample,
  type Interaction,
  type MediaReport,
  type PageStats,
  type ScrollAnchor,
  type TypeSample,
} from './protocol';

const MAX_SAMPLES = 8;
const MAX_SCAN = 4000;
const MIN_TEXT_PX = 12;
const MIN_TARGET_PX = 24;
/** WCAG 2.2 AA (1.4.3): 4.5:1 for text, 3:1 for large text. */
const MIN_CONTRAST = 4.5;
const MIN_CONTRAST_LARGE = 3;
/** Text elements whose contrast is checked per pass, and text nodes looked at for clipped text. */
const MAX_CONTRAST_CHECKS = 1500;
const MAX_CLIP_TEXT_NODES = 3000;
/** Core Web Vitals: a cumulative layout shift above 0.1 needs improvement. */
const MAX_LAYOUT_SHIFT = 0.1;
/** Layout shifts this soon after the workspace changed the page (a resize, live CSS…) aren't the page's. */
const QUIET_MS = 600;
/** Grid and flex containers labelled at once. */
const MAX_LAYOUT_CONTAINERS = 60;
/** Kinds of elements in the type scale, in display order. */
const TYPE_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'a', 'button', 'label', 'input', 'small'];
const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };
/** Checks run at most this often on pages that keep changing. */
const CHECK_INTERVAL_MS = 2000;
const CHECK_DELAY_MS = 500;
/** Wheel distance (pixels) per zoom step, as in the workspace. */
const WHEEL_STEP = 60;
/** Most-used media query widths reported (sites often ship CSS from several libraries). */
const MAX_BREAKPOINTS = 12;
/** Where the reader's eye is, as a fraction of the window height (used to sync scrolling by content). */
const READING_LINE = 0.3;
/** Images shown this much larger than their real size are reported (and at least this many pixels wider). */
const UPSCALE_RATIO = 1.15;
const UPSCALE_MIN_PX = 24;
/** Fixed and stuck elements covering more of a phone or tablet screen than this are reported. */
const MAX_FIXED_COVER = 0.35;
/** Text nodes changed at most by the pseudo-translation, per pass. */
const MAX_TEXT_NODES = 20_000;
/** Images reported at most to the responsive images helper (the largest ones). */
const MAX_IMAGES = 40;
/** Colours of each kind reported at most (the most used). */
const MAX_COLORS = 24;
/** Addresses of links reported at most (Check pages keeps fewer). */
const MAX_LINKS = 300;
const OVERLAY_ATTRIBUTE = 'data-breakpointer-overlay';

type AgentWindow = Window & { __breakpointerAgent?: boolean };

(function startAgent() {
  const runtime = typeof chrome === 'undefined' ? undefined : chrome.runtime;
  if (!runtime?.id) return;
  // Only a preview frame directly inside a Breakpointer workspace.
  if (window.top === window || window.parent !== window.top) return;
  if (location.ancestorOrigins?.[0] !== `chrome-extension://${runtime.id}`) return;
  const agentWindow = window as AgentWindow;
  if (agentWindow.__breakpointerAgent) return;
  agentWindow.__breakpointerAgent = true;

  // Read now, before the page's own scripts run (the agent starts at
  // document_start): some pages overwrite window.name, which names the preview.
  const frameName = window.name;
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => run(runtime, frameName), { once: true });
  else run(runtime, frameName);
})();

/** Everything the agent does once the page's DOM is ready. */
function run(runtime: typeof chrome.runtime, frameName: string) {
  const send = (event: AgentEvent) => {
    try {
      void runtime.sendMessage({ source: AGENT_SOURCE, name: frameName, ...event }).catch(() => {});
    } catch {
      // The extension was reloaded; this agent is orphaned.
    }
  };

  /* ---------- Address ---------- */

  /** The HTTP status this page was served with: an error page (e.g. a refused preview) can be pointed out. */
  const navigationStatus = () => {
    const entry = performance.getEntriesByType('navigation')[0] as
      (PerformanceNavigationTiming & { responseStatus?: number }) | undefined;
    return entry?.responseStatus ?? 0;
  };
  const hello = () => send({ type: 'hello', href: location.href, title: document.title, status: navigationStatus() });

  let lastHref = location.href;
  hello();
  // Single-page apps change the address without loading a new document; the
  // agent runs in an isolated world and can't hook their history calls, so poll.
  window.setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    send({ type: 'location', href: location.href, title: document.title });
  }, 500);
  // Lets the workspace know this page is going away (it may not run an agent next).
  window.addEventListener('pagehide', () => send({ type: 'bye' }));

  // Clicks and key presses tell the workspace that a navigation that follows is
  // the user's doing (synced navigation ignores redirects the page makes itself).
  let lastInput = -Infinity;
  const onInput = (event: Event) => {
    if (inspecting || !event.isTrusted || performance.now() - lastInput < 1000) return;
    lastInput = performance.now();
    send({ type: 'input' });
  };
  window.addEventListener('pointerdown', onInput, { capture: true, passive: true });
  window.addEventListener('keydown', onInput, { capture: true, passive: true });

  // Ctrl + wheel over a preview would zoom the whole workspace tab; zoom the
  // previews instead, unless the page uses that gesture itself (maps, editors).
  let wheelTotal = 0;
  let wheelReset = 0;
  window.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey || event.defaultPrevented) return;
      event.preventDefault();
      wheelTotal += event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 33 : 1);
      window.clearTimeout(wheelReset);
      wheelReset = window.setTimeout(() => (wheelTotal = 0), 250);
      if (Math.abs(wheelTotal) < WHEEL_STEP) return;
      send({ type: 'zoom', direction: wheelTotal < 0 ? 1 : -1 });
      wheelTotal = 0;
    },
    { passive: false },
  );

  /* ---------- Scroll sync ---------- */

  let ignoreScrollUntil = 0;
  let scrollQueued = false;
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const scrollRatio = () => {
    const max = maxScroll();
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };

  const fixedOrSticky = (element: Element) => {
    for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
      const position = getComputedStyle(node).position;
      if (position === 'fixed' || position === 'sticky') return true;
    }
    return false;
  };

  /**
   * The content at the reading line, so other previews (whose layouts differ)
   * can show the same content instead of the same percentage of the page.
   */
  const scrollAnchor = (): ScrollAnchor | undefined => {
    const max = maxScroll();
    // At the very top or bottom the ratio says it all.
    if (window.scrollY < 4 || max - window.scrollY < 4) return undefined;
    const line = Math.round(window.innerHeight * READING_LINE);
    for (const element of document.elementsFromPoint(window.innerWidth / 2, line)) {
      if (element === document.documentElement || element === document.body) break;
      if (element.hasAttribute(OVERLAY_ATTRIBUTE) || fixedOrSticky(element)) continue;
      const chain: Element[] = [];
      for (
        let node: Element | null = element;
        node && node !== document.body && chain.length < 3;
        node = node.parentElement
      )
        chain.push(node);
      return {
        selectors: chain.map(cssPath),
        offsets: chain.map((node) => {
          const rect = node.getBoundingClientRect();
          return rect.height > 0 ? Math.round(((line - rect.top) / rect.height) * 1000) / 1000 : 0;
        }),
        line: READING_LINE,
      };
    }
    return undefined;
  };

  const scrollToAnchor = (anchor: ScrollAnchor): boolean => {
    for (const [index, selector] of anchor.selectors.entries()) {
      let element: Element | null;
      try {
        element = document.querySelector(selector);
      } catch {
        continue;
      }
      const rect = element?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const offset = anchor.offsets[index] ?? 0;
      const top = window.scrollY + rect.top + offset * rect.height - anchor.line * window.innerHeight;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      return true;
    }
    return false;
  };

  // Scrolls the workspace caused (synced scrolling, highlights) are reported
  // only when asked to: a design overlay over this preview follows them.
  let trackScroll = false;
  const reportScroll = (synced: boolean) =>
    send({
      type: 'scroll',
      ratio: scrollRatio(),
      anchor: synced ? undefined : scrollAnchor(),
      y: Math.round(window.scrollY),
      synced,
    });

  // Where the page was before it reloaded: scrolled back to as soon as the page is
  // tall enough (it may still be loading), unless the user scrolls first. Any
  // other scroll asked of this page meanwhile wins (stopRestoring).
  let lastWheel = -Infinity;
  window.addEventListener('wheel', () => (lastWheel = performance.now()), { capture: true, passive: true });
  window.addEventListener('touchmove', () => (lastWheel = performance.now()), { capture: true, passive: true });
  let restoring = 0;
  const restoreScroll = (y: number) => {
    window.clearTimeout(restoring);
    const started = performance.now();
    const attempt = () => {
      if (lastWheel > started || lastInput > started) return;
      ignoreScrollUntil = performance.now() + 150;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      if (Math.abs(window.scrollY - y) <= 2 || performance.now() - started > 4000) return;
      restoring = window.setTimeout(attempt, 200);
    };
    attempt();
  };
  const stopRestoring = () => window.clearTimeout(restoring);

  // Where a scroll the workspace caused ended, said once it settles: the workspace
  // keeps every preview's position (to bring it back after a reload).
  let settling = 0;
  const reportSettled = () => {
    window.clearTimeout(settling);
    settling = window.setTimeout(() => reportScroll(true), 300);
  };

  window.addEventListener(
    'scroll',
    () => {
      drawOverlay();
      if (performance.now() < ignoreScrollUntil && !trackScroll) {
        reportSettled();
        return;
      }
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        const synced = performance.now() < ignoreScrollUntil;
        if (!synced || trackScroll) reportScroll(synced);
        else reportSettled();
      });
    },
    { passive: true },
  );

  /* ---------- Changes the workspace makes ---------- */

  // Layout shifts right after the workspace resized the preview or changed the
  // page (live CSS, a stress test…) aren't the page's own, so they don't count.
  const quietWindows: [number, number][] = [];
  const quiet = () => {
    const now = performance.now();
    quietWindows.push([now - 100, now + QUIET_MS]);
    if (quietWindows.length > 40) quietWindows.shift();
  };
  const isQuiet = (time: number) => quietWindows.some(([from, to]) => time >= from && time <= to);
  // Only a real change of size (the workspace resizing the preview) counts: a preview frame first
  // gets its size late (it starts at 0 × 0), and Chrome also fires resize events that change nothing.
  let size = { width: window.innerWidth, height: window.innerHeight };
  window.addEventListener('resize', () => {
    const next = { width: window.innerWidth, height: window.innerHeight };
    if (size.width > 0 && size.height > 0 && (next.width !== size.width || next.height !== size.height)) quiet();
    size = next;
  });

  /* ---------- Styles injected on request ---------- */

  const setStyle = (id: string, css: string) => {
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!css) {
      if (style) quiet();
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      (document.head ?? document.documentElement).append(style);
    }
    // Rewriting the same text would look like a page change and trigger new checks.
    if (style.textContent !== css) {
      quiet();
      style.textContent = css;
    }
  };

  /* ---------- Highlighting ---------- */

  const MARK = 'data-bp-issue';
  let flagged = new Map<string, Element[]>();
  let highlighted: string | null = null;

  /** Scrolls this page only (scrollIntoView could also scroll the workspace); other previews don't follow. */
  const reveal = (element: Element) => {
    stopRestoring();
    const rect = element.getBoundingClientRect();
    ignoreScrollUntil = performance.now() + 300;
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - Math.max(0, (window.innerHeight - rect.height) / 2)),
      behavior: 'instant',
    });
  };

  const applyHighlight = (kind: string | null, scroll: boolean) => {
    highlighted = kind;
    document.querySelectorAll(`[${MARK}]`).forEach((element) => {
      if (!kind || element.getAttribute(MARK) !== kind || !flagged.get(kind)?.includes(element))
        element.removeAttribute(MARK);
    });
    if (!kind) {
      setStyle('bp-highlight', '');
      return;
    }
    const elements = flagged.get(kind) ?? [];
    elements.forEach((element) => element.setAttribute(MARK, kind));
    // The tint is an inset shadow, not a background: the contrast check reads
    // backgrounds, and a highlighted element must keep its own.
    setStyle(
      'bp-highlight',
      `[${MARK}]{outline:2px dashed #e11d48 !important;outline-offset:-2px !important;box-shadow:inset 0 0 0 100vmax rgba(225,29,72,.08) !important}`,
    );
    if (scroll && elements[0]) reveal(elements[0]);
  };

  /* ---------- Responsive checks ---------- */

  /** Rendered and not visually hidden (skip links and screen-reader text are often 1×1 px). */
  const visible = (rect: DOMRect, style: CSSStyleDeclaration) =>
    rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none';

  /** True when an ancestor (below body) clips horizontal overflow, so the element can't widen the page. */
  const clipped = (element: Element) => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== 'visible') return true;
    }
    return false;
  };

  const clipsX = (element: Element | null) => {
    const value = element ? getComputedStyle(element).overflowX : 'visible';
    return value === 'hidden' || value === 'clip';
  };

  const hides = (overflow: string) => overflow === 'hidden' || overflow === 'clip';

  const pageElements = () =>
    Array.from(document.body?.querySelectorAll(`*:not([${OVERLAY_ATTRIBUTE}])`) ?? []).slice(0, MAX_SCAN);

  /** The element's first own line of text (not a child element's), if it has one. */
  const ownText = (element: Element): Text | null => {
    for (const child of element.childNodes)
      if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 1) return child as Text;
    return null;
  };

  // Checks the user switched off (Settings → Responsive checks).
  let skipChecks = new Set<CheckKind>();

  /* Layout shifts (cumulative layout shift, as in Core Web Vitals). */
  type Shift = ShiftEntry & { moves: { element: Element; distance: number }[] };
  type LayoutShiftEntry = PerformanceEntry & {
    value: number;
    hadRecentInput: boolean;
    sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
  };
  const shifts: Shift[] = [];
  /**
   * Shifts after the page first painted content. Before that nothing was on
   * screen to be seen moving — and in a frame Chrome reports the page settling
   * into its size and styles then (scores up to 1 that a tab never shows).
   */
  const visibleShifts = () => {
    const painted = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    return painted === undefined ? [] : shifts.filter((shift) => shift.startTime >= painted);
  };

  /** The colour of the page's canvas where nothing else is painted: white, or dark for dark pages. */
  const canvasColor = (): Rgb => {
    const probe = document.createElement('div');
    // Not an HTML page (an SVG or XML file shown on its own): no CSS box to ask.
    if (!(probe instanceof HTMLElement)) return WHITE;
    probe.setAttribute(OVERLAY_ATTRIBUTE, '');
    probe.style.cssText = 'position:absolute;width:0;height:0;background-color:Canvas';
    document.documentElement.append(probe);
    const color = parseCssColor(getComputedStyle(probe).backgroundColor);
    probe.remove();
    return color && color.a > 0 ? { ...color, a: 1 } : WHITE;
  };

  /**
   * Runs the checks. `scan`: for the width scanner, which resizes the preview
   * again and again (the layout shifts that causes aren't the page's).
   */
  const runChecks = (scan = false): CheckReport => {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const issues: CheckIssue[] = [];
    const nextFlagged = new Map<string, Element[]>();
    const elements = pageElements();
    const wants = (kind: CheckKind) => !skipChecks.has(kind);

    // 1. Content wider than the viewport (the page scrolls sideways). Pages
    //    that hide horizontal overflow on html/body can't scroll sideways.
    const overflow = document.documentElement.scrollWidth - width;
    if (wants('overflow') && overflow > 1 && !clipsX(document.documentElement) && !clipsX(document.body)) {
      const culprits: Element[] = [];
      const samples: CheckSample[] = [];
      const right = (element: Element) => element.getBoundingClientRect().right + window.scrollX;
      for (const element of elements) {
        if (right(element) <= width + 1) continue;
        const style = getComputedStyle(element);
        if (!visible(element.getBoundingClientRect(), style) || style.position === 'fixed') continue;
        // Report the outermost element that sticks out, not all its children.
        const parent = element.parentElement;
        if (parent && parent !== document.body && right(parent) > width + 1) continue;
        if (clipped(element)) continue;
        culprits.push(element);
        if (samples.length < MAX_SAMPLES)
          samples.push({ selector: describeElement(element), detail: `+${Math.round(right(element) - width)}px` });
      }
      nextFlagged.set('overflow', culprits);
      issues.push({
        kind: 'overflow',
        count: Math.max(1, culprits.length),
        detail: `${Math.round(overflow)}px`,
        samples,
      });
    }

    // 2. A mobile page needs <meta name="viewport" content="width=device-width">
    //    (only meaningful on phone and tablet sizes).
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport" i]');
    if (wants('viewport-meta') && width <= 1024 && (!meta || !/width\s*=\s*device-width/i.test(meta.content))) {
      issues.push({ kind: 'viewport-meta', count: 1, detail: meta?.content ?? '', samples: [] });
    }

    // 3. Text smaller than 12px, on phone and tablet sizes (like Lighthouse's
    //    legible-text audit). 0px text is a hiding technique, not small text.
    const smallText: Element[] = [];
    const textSamples: CheckSample[] = [];
    for (const element of wants('small-text') && width <= 1024 ? elements : []) {
      if (!ownText(element)) continue;
      const style = getComputedStyle(element);
      const size = Number.parseFloat(style.fontSize);
      if (!(size < MIN_TEXT_PX) || size < 1) continue;
      if (!visible(element.getBoundingClientRect(), style)) continue;
      smallText.push(element);
      if (textSamples.length < MAX_SAMPLES)
        textSamples.push({ selector: describeElement(element), detail: `${Math.round(size * 10) / 10}px` });
    }
    if (smallText.length) {
      nextFlagged.set('small-text', smallText);
      issues.push({ kind: 'small-text', count: smallText.length, samples: textSamples });
    }

    // 4. Touch targets smaller than 24×24px (WCAG 2.2, 2.5.8), on touch-sized
    //    viewports. As in WCAG, links in running text are exempt, and so is an
    //    undersized target with enough space around it: a 24px circle centred on
    //    it touches no other target (nor another undersized target's circle).
    if (wants('tap-targets') && width <= 1024) {
      const small: Element[] = [];
      const targetSamples: CheckSample[] = [];
      const targets: { element: Element; rect: DOMRect; small: boolean }[] = [];
      const nodes = document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="tab"]',
      );
      for (const element of Array.from(nodes).slice(0, MAX_SCAN)) {
        const style = getComputedStyle(element);
        if (element.tagName === 'A' && style.display === 'inline') continue;
        const rect = element.getBoundingClientRect();
        if (!visible(rect, style)) continue;
        targets.push({ element, rect, small: rect.width < MIN_TARGET_PX || rect.height < MIN_TARGET_PX });
      }
      const radius = MIN_TARGET_PX / 2;
      const centre = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      const crowded = (target: (typeof targets)[number]) => {
        const c = centre(target.rect);
        return targets.some((other) => {
          if (other === target || other.element.contains(target.element) || target.element.contains(other.element))
            return false;
          if (other.small) {
            const o = centre(other.rect);
            return Math.hypot(o.x - c.x, o.y - c.y) < MIN_TARGET_PX;
          }
          const dx = Math.max(other.rect.left - c.x, 0, c.x - other.rect.right);
          const dy = Math.max(other.rect.top - c.y, 0, c.y - other.rect.bottom);
          return Math.hypot(dx, dy) < radius;
        });
      };
      for (const target of targets) {
        if (!target.small || !crowded(target)) continue;
        small.push(target.element);
        if (targetSamples.length < MAX_SAMPLES)
          targetSamples.push({
            selector: describeElement(target.element),
            detail: `${Math.round(target.rect.width)}×${Math.round(target.rect.height)}`,
          });
      }
      if (small.length) {
        nextFlagged.set('tap-targets', small);
        issues.push({ kind: 'tap-targets', count: small.length, samples: targetSamples });
      }
    }

    // 5. Text cut off by its own box: a line of text partly outside an element
    //    that hides its overflow. Cut on purpose, and so skipped: an ellipsis, a
    //    line clamp, a fading mask, lines fully outside (the other slides of a
    //    carousel), text that is moving (a transform: reveal animations, carousel
    //    tracks), code, and text that isn't shown or is hidden from assistive tech.
    if (wants('clipped-text')) {
      const cut: Element[] = [];
      const cutSamples: CheckSample[] = [];
      const styles = new Map<Element, CSSStyleDeclaration>();
      const styleOf = (element: Element) => {
        let style = styles.get(element);
        if (!style) styles.set(element, (style = getComputedStyle(element)));
        return style;
      };
      const moving = (style: CSSStyleDeclaration) =>
        style.transform !== 'none' ||
        (Boolean(style.translate) && style.translate !== 'none') ||
        (Boolean(style.scale) && style.scale !== 'none') ||
        (Boolean(style.rotate) && style.rotate !== 'none');
      const SKIPPED_TEXT = 'pre, code, kbd, samp, [aria-hidden="true"]';
      // A box's own text, as a walker visits it: elements under it are passed
      // through, except those whose text isn't the box's — moving, code, not
      // shown, or a box of their own (it hides or scrolls overflow) — which are
      // left out with everything inside them. Blank text isn't visited.
      const boxText: NodeFilter = (node) => {
        if (node instanceof Text)
          return node.data.trim().length < 2 ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
        const element = node as Element;
        const style = styleOf(element);
        return moving(style) ||
          element.matches(SKIPPED_TEXT) ||
          style.visibility !== 'visible' ||
          Number(style.opacity) === 0 ||
          style.overflowX !== 'visible' ||
          style.overflowY !== 'visible'
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      };
      const masked = (style: CSSStyleDeclaration) =>
        [style.getPropertyValue('mask-image'), style.getPropertyValue('-webkit-mask-image')].some(
          (value) => Boolean(value) && value !== 'none',
        );
      // Boxes that hide their overflow and have some, smallest first: a page-wide
      // wrapper mustn't use up the budget before the buttons and badges where text
      // is usually cut. Reported in page order.
      const boxes: {
        element: Element;
        index: number;
        rect: DOMRect;
        style: CSSStyleDeclaration;
        cutsX: boolean;
        cutsY: boolean;
      }[] = [];
      elements.forEach((element, index) => {
        const style = styleOf(element);
        const cutsX = hides(style.overflowX);
        const cutsY = hides(style.overflowY);
        if (!cutsX && !cutsY) return;
        const clamp = style.getPropertyValue('-webkit-line-clamp');
        if (style.textOverflow === 'ellipsis' || (clamp && clamp !== 'none') || masked(style)) return;
        if (element.matches(SKIPPED_TEXT) || element.closest('[aria-hidden="true"]')) return;
        // Most boxes that hide their overflow have nothing to hide.
        if (element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1) return;
        const rect = element.getBoundingClientRect();
        if (visible(rect, style)) boxes.push({ element, index, rect, style, cutsX, cutsY });
      });
      boxes.sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height);
      const found: { index: number; element: Element; sample: CheckSample }[] = [];
      const range = document.createRange();
      let budget = MAX_CLIP_TEXT_NODES;
      for (const { element, index, rect, style, cutsX, cutsY } of boxes) {
        if (budget <= 0) break;
        const box = {
          left: rect.left + Number.parseFloat(style.borderLeftWidth),
          top: rect.top + Number.parseFloat(style.borderTopWidth),
          right: rect.right - Number.parseFloat(style.borderRightWidth),
          bottom: rect.bottom - Number.parseFloat(style.borderBottomWidth),
        };
        let worst = { x: 0, y: 0 };
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, boxText);
        for (let node = walker.nextNode(); node && budget > 0; node = walker.nextNode()) {
          budget--;
          range.selectNodeContents(node);
          for (const line of range.getClientRects()) {
            const hidden = cutOff(line, box);
            if (!hidden) continue;
            // Sideways, any cut letter shows; vertically, a tight line height trims a
            // few pixels of most fonts, so only more than a quarter of the line counts.
            const x = cutsX && hidden.x > 1 ? hidden.x : 0;
            const y = cutsY && hidden.y > line.height * 0.25 ? hidden.y : 0;
            if (x > worst.x || y > worst.y) worst = { x: Math.max(worst.x, x), y: Math.max(worst.y, y) };
          }
        }
        if (!worst.x && !worst.y) continue;
        found.push({
          index,
          element,
          sample: {
            selector: describeElement(element),
            detail: worst.x >= worst.y ? `↔ ${Math.round(worst.x)}px` : `↕ ${Math.round(worst.y)}px`,
          },
        });
      }
      range.detach();
      found.sort((a, b) => a.index - b.index);
      for (const { element, sample } of found) {
        cut.push(element);
        if (cutSamples.length < MAX_SAMPLES) cutSamples.push(sample);
      }
      if (cut.length) {
        nextFlagged.set('clipped-text', cut);
        issues.push({ kind: 'clipped-text', count: cut.length, samples: cutSamples });
      }
    }

    // 6. Low-contrast text (WCAG 2.2, 1.4.3), where the colour behind the text is
    //    known: solid backgrounds of the element and its ancestors. Text over
    //    something else — an image, a gradient, a decoration, content laid over
    //    it — and translucent or blended elements are skipped rather than guessed.
    if (wants('low-contrast')) {
      const low: Element[] = [];
      const lowSamples: CheckSample[] = [];
      let lowest = Infinity;
      const canvas = canvasColor();
      const styles = new Map<Element, CSSStyleDeclaration>();
      const styleOf = (element: Element) => {
        let style = styles.get(element);
        if (!style) styles.set(element, (style = getComputedStyle(element)));
        return style;
      };
      /** A background colour that draws something — or that can't be read, which makes it unknown. */
      const paints = (background: string) => {
        const color = parseCssColor(background);
        return color === null || color.a > 0;
      };
      /** A background drawn by ::before or ::after (a pill, an underlay) that the text may sit on. */
      const decorated = (element: Element) =>
        (['::before', '::after'] as const).some((pseudo) => {
          const style = getComputedStyle(element, pseudo);
          if (style.content === 'none' || style.content === 'normal') return false;
          return style.backgroundImage !== 'none' || paints(style.backgroundColor);
        });
      /** Its own painting makes the colours behind the text unknown. */
      const unclear = new Map<Element, boolean>();
      const isUnclear = (element: Element) => {
        let known = unclear.get(element);
        if (known === undefined) {
          const style = styleOf(element);
          const backdropFilter = style.getPropertyValue('backdrop-filter');
          known =
            style.backgroundImage !== 'none' ||
            style.filter !== 'none' ||
            style.mixBlendMode !== 'normal' ||
            (Boolean(backdropFilter) && backdropFilter !== 'none') ||
            Number(style.opacity) < 0.99 ||
            decorated(element);
          unclear.set(element, known);
        }
        return known;
      };
      /** Children that draw something (media, a background) or float over the others (positioned). */
      const painters = new Map<Element, { element: Element; rect: DOMRect }[]>();
      const paintersIn = (parent: Element) => {
        let list = painters.get(parent);
        if (list) return list;
        list = [];
        for (const child of Array.from(parent.children)) {
          if (child.hasAttribute(OVERLAY_ATTRIBUTE)) continue;
          const style = styleOf(child);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const draws =
            /^(img|video|picture|canvas|svg|iframe|object|embed)$/.test(child.localName) ||
            style.backgroundImage !== 'none' ||
            paints(style.backgroundColor) ||
            style.position === 'absolute' ||
            style.position === 'fixed' ||
            Boolean(child.querySelector('img, video, picture, canvas, svg, iframe'));
          if (!draws) continue;
          const rect = child.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) list.push({ element: child, rect });
        }
        painters.set(parent, list);
        return list;
      };
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      /**
       * A shadow root (open or closed) shows this element's children through its
       * slots, inside boxes of its own that this walk up the page doesn't see.
       */
      const hosts = new Map<Element, boolean>();
      const isShadowHost = (element: Element) => {
        let host = hosts.get(element);
        if (host === undefined) {
          let root = element.shadowRoot;
          try {
            root ??= element instanceof HTMLElement ? chrome.dom.openOrClosedShadowRoot(element) : null;
          } catch {
            // Not available: open shadow roots are still seen.
          }
          hosts.set(element, (host = root !== null));
        }
        return host;
      };
      /** The solid colour behind a line of the element's text, or null when it can't be known. */
      const backgroundBehind = (element: Element, line: DOMRect): Rgb | null => {
        const layers: Rgb[] = [];
        let base: Rgb | null = null;
        for (let node: Element | null = element; node; node = node.parentElement) {
          if (isUnclear(node) || isShadowHost(node)) return null;
          const style = styleOf(node);
          const color = parseCssColor(style.backgroundColor);
          // A colour this check can't read: what is behind the text is unknown.
          if (!color) return null;
          if (color.a >= 1) {
            base = color;
            break;
          }
          if (color.a > 0) layers.push(color);
          // Taken out of the flow without a background of its own: it may sit over anything.
          if (style.position === 'absolute' || style.position === 'fixed') return null;
          // Something else in the same box drawn where the text is (a hero image, a grid overlap).
          const parent = node.parentElement;
          if (parent && paintersIn(parent).some((item) => item.element !== node && overlaps(item.rect, line)))
            return null;
        }
        return layers.reduceRight((below, layer) => blend(layer, below), base ?? canvas);
      };
      /** On screen, the browser says what is drawn under the text: only the element and its ancestors. */
      const hitsOnlyAncestors = (element: Element, line: DOMRect) => {
        if (line.bottom < 0 || line.top > window.innerHeight || line.right < 0 || line.left > width) return true;
        const x = Math.min(Math.max(line.left + Math.min(8, line.width / 2), 0), width - 1);
        const y = Math.min(Math.max(line.top + line.height / 2, 0), window.innerHeight - 1);
        const stack = document.elementsFromPoint(x, y);
        const at = stack.findIndex((item) => item === element || element.contains(item));
        // Covered by something else (a dialog, a banner), or not hit at all (pointer-events: none).
        if (at !== 0) return false;
        return stack.slice(1).every((item) => item.contains(element));
      };
      const range = document.createRange();
      let checked = 0;
      for (const element of elements) {
        if (checked >= MAX_CONTRAST_CHECKS) break;
        const text = ownText(element);
        if (!text || element instanceof SVGElement) continue;
        const style = styleOf(element);
        const rect = element.getBoundingClientRect();
        if (!visible(rect, style)) continue;
        checked++;
        // Inactive controls are exempt in WCAG; a shadow usually helps text over images.
        if (element.closest(':disabled, [aria-disabled="true"]') || style.textShadow !== 'none') continue;
        const fill = parseCssColor(style.getPropertyValue('-webkit-text-fill-color'));
        const color = fill && fill.a > 0 ? fill : parseCssColor(style.color);
        if (!color || color.a < 0.05) continue;
        range.selectNodeContents(text);
        const line = range.getClientRects()[0];
        if (!line || line.width < 1 || line.height < 1) continue;
        const background = backgroundBehind(element, line);
        if (!background || !hitsOnlyAncestors(element, line)) continue;
        const ratio = contrastRatio(color, background);
        const large = isLargeText(Number.parseFloat(style.fontSize), Number.parseInt(style.fontWeight, 10) || 400);
        if (Number(formatRatio(ratio)) >= (large ? MIN_CONTRAST_LARGE : MIN_CONTRAST)) continue;
        low.push(element);
        lowest = Math.min(lowest, ratio);
        if (lowSamples.length < MAX_SAMPLES)
          lowSamples.push({
            selector: describeElement(element),
            detail: `${formatRatio(ratio)}:1 · ${toHex(color.a < 1 ? blend(color, background) : color)} / ${toHex(background)}`,
          });
      }
      range.detach();
      if (low.length) {
        nextFlagged.set('low-contrast', low);
        issues.push({ kind: 'low-contrast', count: low.length, detail: formatRatio(lowest), samples: lowSamples });
      }
    }

    // 7. Images shown larger than their real size look blurry (at every width).
    //    `naturalWidth` already accounts for the density of the srcset candidate.
    const upscaled: Element[] = [];
    const imageSamples: CheckSample[] = [];
    for (const image of wants('upscaled-images') ? Array.from(document.images).slice(0, MAX_SCAN) : []) {
      // A file of a pixel or two is a placeholder (lazy loading) or a spacer, not a blurry picture.
      if (!image.complete || image.naturalWidth <= 2 || image.naturalHeight <= 2) continue;
      if (isVectorImage(image.currentSrc)) continue;
      const style = getComputedStyle(image);
      const rect = image.getBoundingClientRect();
      if (!visible(rect, style) || style.objectFit === 'none') continue;
      // The size the picture itself is drawn at inside its box.
      const contain = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const cover = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const scale =
        style.objectFit === 'contain'
          ? contain
          : style.objectFit === 'scale-down'
            ? Math.min(1, contain)
            : style.objectFit === 'cover'
              ? cover
              : rect.width / image.naturalWidth;
      const shown = image.naturalWidth * scale;
      if (scale < UPSCALE_RATIO || shown - image.naturalWidth < UPSCALE_MIN_PX) continue;
      upscaled.push(image);
      if (imageSamples.length < MAX_SAMPLES)
        imageSamples.push({
          selector: describeElement(image),
          detail: `${image.naturalWidth}px → ${Math.round(shown)}px`,
        });
    }
    if (upscaled.length) {
      nextFlagged.set('upscaled-images', upscaled);
      issues.push({ kind: 'upscaled-images', count: upscaled.length, samples: imageSamples });
    }

    // 8. Fixed (or stuck) elements covering much of a phone or tablet screen, such
    //    as cookie walls or tall headers: sampled on a grid of points.
    if (wants('fixed-cover') && width <= 1024) {
      const height = window.innerHeight;
      const coverOwner = (element: Element): Element | null => {
        let owner: Element | null = null;
        for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
          if (node === document.documentElement || node.hasAttribute(OVERLAY_ATTRIBUTE)) break;
          const position = getComputedStyle(node).position;
          if (position === 'fixed') owner = node;
          else if (position === 'sticky') {
            const rect = node.getBoundingClientRect();
            if (rect.top <= 1 || rect.bottom >= height - 1) owner = node;
          }
        }
        return owner;
      };
      const columns = 6;
      const rows = 10;
      const owners = new Set<Element>();
      let covered = 0;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const element = document.elementFromPoint(((column + 0.5) * width) / columns, ((row + 0.5) * height) / rows);
          const owner = element && coverOwner(element);
          if (!owner) continue;
          covered++;
          owners.add(owner);
        }
      }
      const share = covered / (columns * rows);
      if (share > MAX_FIXED_COVER) {
        const list = [...owners];
        nextFlagged.set('fixed-cover', list);
        issues.push({
          kind: 'fixed-cover',
          count: list.length,
          detail: `${Math.round(share * 100)}%`,
          samples: list.slice(0, MAX_SAMPLES).map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              selector: describeElement(element),
              detail: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
            };
          }),
        });
      }
    }

    // 9. The layout moved while the page loaded or was used (CLS above 0.1), with
    //    the elements that moved in the worst burst of shifts.
    if (wants('layout-shift') && !scan) {
      const seen = visibleShifts();
      const worst = cumulativeLayoutShift(seen);
      if (worst.value > MAX_LAYOUT_SHIFT) {
        const moved = new Map<Element, number>();
        for (const index of worst.window)
          for (const move of seen[index]?.moves ?? [])
            if (move.element.isConnected)
              moved.set(move.element, Math.max(moved.get(move.element) ?? 0, move.distance));
        const list = [...moved.keys()];
        nextFlagged.set('layout-shift', list);
        issues.push({
          kind: 'layout-shift',
          count: Math.max(1, list.length),
          detail: formatShift(worst.value),
          samples: list.slice(0, MAX_SAMPLES).map((element) => ({
            selector: describeElement(element),
            detail: `${Math.round(moved.get(element) ?? 0)}px`,
          })),
        });
      }
    }

    // 10. Images without a text alternative (WCAG 1.1.1): no alt attribute (an
    //     empty one marks a decorative image), or role="img" without a name.
    //     Tracking pixels and images hidden from assistive technology are skipped.
    if (wants('missing-alt')) {
      const missing: Element[] = [];
      const altSamples: CheckSample[] = [];
      for (const image of Array.from(document.querySelectorAll('img, [role="img"]')).slice(0, MAX_SCAN)) {
        const rect = image.getBoundingClientRect();
        if (!visible(rect, getComputedStyle(image)) || rect.width < 4 || rect.height < 4) continue;
        if (!lacksTextAlternative(image)) continue;
        missing.push(image);
        if (altSamples.length < MAX_SAMPLES)
          altSamples.push({
            selector: describeElement(image),
            detail: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
          });
      }
      if (missing.length) {
        nextFlagged.set('missing-alt', missing);
        issues.push({ kind: 'missing-alt', count: missing.length, samples: altSamples });
      }
    }

    // 11. Buttons and links without a name (WCAG 4.1.2, 2.4.4): often icon-only
    //     buttons, such as the menu button that only shows on small screens.
    if (wants('unnamed-control')) {
      const unnamed: Element[] = [];
      const controlSamples: CheckSample[] = [];
      for (const control of Array.from(document.querySelectorAll(CONTROL_SELECTOR)).slice(0, MAX_SCAN)) {
        if (control.hasAttribute(OVERLAY_ATTRIBUTE) || hiddenFromAssistiveTech(control)) continue;
        const rect = control.getBoundingClientRect();
        if (!visible(rect, getComputedStyle(control)) || accessibleName(control)) continue;
        unnamed.push(control);
        if (controlSamples.length < MAX_SAMPLES)
          controlSamples.push({
            selector: describeElement(control),
            detail: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
          });
      }
      if (unnamed.length) {
        nextFlagged.set('unnamed-control', unnamed);
        issues.push({ kind: 'unnamed-control', count: unnamed.length, samples: controlSamples });
      }
    }

    // 12. Form fields without a label (WCAG 1.3.1, 4.1.2). A placeholder counts
    //     as a name here (it is one, if a weak one).
    if (wants('unlabeled-field')) {
      const unlabeled: Element[] = [];
      const fieldSamples: CheckSample[] = [];
      for (const field of Array.from(document.querySelectorAll(FIELD_SELECTOR)).slice(0, MAX_SCAN)) {
        if (hiddenFromAssistiveTech(field)) continue;
        const rect = field.getBoundingClientRect();
        if (!visible(rect, getComputedStyle(field)) || accessibleName(field)) continue;
        unlabeled.push(field);
        if (fieldSamples.length < MAX_SAMPLES)
          fieldSamples.push({
            selector: describeElement(field),
            detail: field instanceof HTMLInputElement ? field.type : field.localName,
          });
      }
      if (unlabeled.length) {
        nextFlagged.set('unlabeled-field', unlabeled);
        issues.push({ kind: 'unlabeled-field', count: unlabeled.length, samples: fieldSamples });
      }
    }

    // 13. Focus that lands on something the user can't see (WCAG 2.4.7, 4.1.2):
    //     elements in the tab order inside aria-hidden, or entirely off the page
    //     (an off-canvas menu that is closed but still focusable), or inside a
    //     transparent box. Links to the same page (skip links appear when focused)
    //     and visually hidden 1px elements aren't reported as off screen.
    if (wants('hidden-focus')) {
      const hiddenFocus: Element[] = [];
      const focusSamples: CheckSample[] = [];
      const pageWidth = document.documentElement.scrollWidth;
      const noSideways = clipsX(document.documentElement) || clipsX(document.body);
      // Each box's answer is kept for this pass: focusable elements share their ancestors.
      const clear = new Map<Element, boolean>();
      const transparent = (element: Element): boolean => {
        if (element === document.body || element === document.documentElement) return false;
        let known = clear.get(element);
        if (known === undefined) {
          known =
            Number(getComputedStyle(element).opacity) === 0 ||
            (element.parentElement ? transparent(element.parentElement) : false);
          clear.set(element, known);
        }
        return known;
      };
      for (const element of Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).slice(0, MAX_SCAN)) {
        if (element.hasAttribute(OVERLAY_ATTRIBUTE) || !inTabOrder(element)) continue;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (!visible(rect, style)) continue;
        let detail = '';
        if (hiddenFromAssistiveTech(element)) detail = 'aria-hidden';
        else if (!element.matches('a[href^="#"]')) {
          if (rect.right <= 0) detail = `← ${Math.round(-rect.left)}px`;
          else if (rect.bottom + window.scrollY <= 0) detail = `↑ ${Math.round(-(rect.top + window.scrollY))}px`;
          else if (rect.left + window.scrollX >= pageWidth || (noSideways && rect.left >= width))
            detail = `→ ${Math.round(rect.left - width)}px`;
          else if (transparent(element)) detail = 'opacity: 0';
        }
        if (!detail) continue;
        hiddenFocus.push(element);
        if (focusSamples.length < MAX_SAMPLES) focusSamples.push({ selector: describeElement(element), detail });
      }
      if (hiddenFocus.length) {
        nextFlagged.set('hidden-focus', hiddenFocus);
        issues.push({ kind: 'hidden-focus', count: hiddenFocus.length, samples: focusSamples });
      }
    }

    // 14. The page's language isn't set (WCAG 3.1.1): screen readers then read it in the wrong voice.
    if (
      wants('missing-lang') &&
      document.documentElement instanceof HTMLElement &&
      !document.documentElement.lang.trim()
    )
      issues.push({ kind: 'missing-lang', count: 1, samples: [] });

    // A scan doesn't change what Highlight marks in the page.
    if (!scan) flagged = nextFlagged;
    return { width, issues };
  };

  let checksEnabled = false;
  let checkTimer = 0;
  let lastCheck = -Infinity;
  /** Throttled: a page that changes all the time still gets checked every couple of seconds. */
  const scheduleChecks = () => {
    if (!checksEnabled || checkTimer) return;
    const wait = Math.max(CHECK_DELAY_MS, CHECK_INTERVAL_MS - (performance.now() - lastCheck));
    checkTimer = window.setTimeout(() => {
      checkTimer = 0;
      if (!checksEnabled) return;
      lastCheck = performance.now();
      send({ type: 'checks', report: runChecks() });
      if (highlighted) applyHighlight(highlighted, false);
    }, wait);
  };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput || isQuiet(entry.startTime)) continue;
        const moves: Shift['moves'] = [];
        for (const source of entry.sources ?? []) {
          const node = source.node;
          const element = node instanceof Element ? node : node?.parentElement;
          if (!element || element.closest(`[${OVERLAY_ATTRIBUTE}]`)) continue;
          const distance = Math.max(
            Math.abs(source.currentRect.y - source.previousRect.y),
            Math.abs(source.currentRect.x - source.previousRect.x),
          );
          moves.push({ element, distance });
        }
        shifts.push({ startTime: entry.startTime, value: entry.value, moves });
        // A page that keeps shifting: its worst burst is what counts, and that is
        // all but certain to be in its last few hundred shifts.
        if (shifts.length > 500) shifts.shift();
      }
      scheduleChecks();
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Layout Instability isn't available.
  }

  /* ---------- Stylesheets: breakpoints and color scheme ---------- */

  type Visit = (list: MediaList) => void;

  /** Calls `visit` for every media list in the page's readable stylesheets; returns how many couldn't be read. */
  const forEachMediaList = (visit: Visit): number => {
    let unreadable = 0;
    const walk = (rules: CSSRuleList, depth: number) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) visit(rule.media);
        if (rule instanceof CSSImportRule) {
          visit(rule.media);
          try {
            if (rule.styleSheet) walk(rule.styleSheet.cssRules, depth + 1);
          } catch {
            unreadable++;
          }
        }
        const nested = (rule as Partial<CSSGroupingRule>).cssRules;
        if (nested && depth < 8) walk(nested, depth + 1);
      }
    };
    const sheets = [...Array.from(document.styleSheets), ...(document.adoptedStyleSheets ?? [])];
    for (const sheet of sheets) {
      // Breakpointer's own styles (live CSS, outlines…) aren't the page's.
      if (sheet.ownerNode instanceof Element && sheet.ownerNode.id.startsWith('bp-')) continue;
      visit(sheet.media);
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        unreadable++;
        continue;
      }
      walk(rules, 0);
    }
    return unreadable;
  };

  let colorScheme: ColorSchemeOverride = null;
  let reduceMotion = false;
  let moreContrast = false;
  let printing = false;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const systemContrast = window.matchMedia('(prefers-contrast: more)');
  const originalMedia = new WeakMap<object, string>();
  const overridden = (text: string) =>
    mentionsColorScheme(text) ||
    mentionsReducedMotion(text) ||
    mentionsPrefersContrast(text) ||
    mentionsMediaType(text);
  const overriding = () => colorScheme !== null || reduceMotion || moreContrast || printing;

  const mediaReport = (): MediaReport => {
    const counts = new Map<number, number>();
    let schemeStyles = false;
    const unreadable = forEachMediaList((list) => {
      const text = originalMedia.get(list) ?? list.mediaText;
      if (!text) return;
      if (mentionsColorScheme(text)) schemeStyles = true;
      for (const edge of mediaQueryEdges(text)) counts.set(edge, (counts.get(edge) ?? 0) + 1);
    });
    const breakpoints = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, MAX_BREAKPOINTS)
      .map(([width]) => width)
      .sort((a, b) => a - b);
    return { breakpoints, unreadable, colorScheme: schemeStyles };
  };

  /**
   * Shows the page's light or dark styles (and its reduced-motion styles)
   * whatever the browser prefers: when the wanted value differs from the
   * browser's, `prefers-color-scheme: dark` and `light` (or the reduced-motion
   * values) are swapped in the page's media queries, and restored afterwards.
   * Only styles chosen by CSS follow; a page that decides in script doesn't.
   */
  const applyMediaOverrides = () => {
    const swapScheme = colorScheme !== null && (colorScheme === 'dark') !== systemDark.matches;
    const swapMotion = reduceMotion && !systemReduce.matches;
    const swapContrast = moreContrast && !systemContrast.matches;
    const rewrite = (original: string) => {
      let text = original;
      if (swapScheme) text = swapColorScheme(text);
      if (swapMotion) text = swapReducedMotion(text);
      if (swapContrast) text = swapPrefersContrast(text);
      if (printing) text = printMedia(text);
      return text;
    };
    const update = (original: string, current: string, write: (text: string) => void) => {
      const next = rewrite(original);
      if (current !== next) write(next);
    };
    forEachMediaList((list) => {
      const original = originalMedia.get(list) ?? list.mediaText;
      if (!overridden(original)) return;
      originalMedia.set(list, original);
      update(original, list.mediaText, (text) => (list.mediaText = text));
    });
    // Images with a dark variant (<picture><source media="(prefers-color-scheme: dark)">).
    document.querySelectorAll('source[media]').forEach((source) => {
      const original = originalMedia.get(source) ?? source.getAttribute('media') ?? '';
      if (!overridden(original)) return;
      originalMedia.set(source, original);
      update(original, source.getAttribute('media') ?? '', (text) => source.setAttribute('media', text));
    });
    // Built-in colours (form controls, scrollbars, `light-dark()`) follow too when the page supports
    // both schemes — as the page itself declares them, so Breakpointer's own override is left out.
    const own = (document.getElementById('bp-color-scheme') as HTMLStyleElement | null)?.sheet;
    if (own) own.disabled = true;
    const declared = `${getComputedStyle(document.documentElement).colorScheme} ${
      document.querySelector<HTMLMetaElement>('meta[name="color-scheme" i]')?.content ?? ''
    }`;
    if (own) own.disabled = false;
    const both = /\blight\b/.test(declared) && /\bdark\b/.test(declared);
    setStyle('bp-color-scheme', swapScheme && both ? `:root{color-scheme:${colorScheme} !important}` : '');
  };
  systemDark.addEventListener('change', applyMediaOverrides);
  systemReduce.addEventListener('change', applyMediaOverrides);
  systemContrast.addEventListener('change', applyMediaOverrides);

  let lastMedia = '';
  /** Re-reads the stylesheets soon (they load and change after the first paint). */
  const mediaScan = scheduler(() => {
    if (overriding()) applyMediaOverrides();
    const report = mediaReport();
    const json = JSON.stringify(report);
    if (json === lastMedia) return;
    lastMedia = json;
    send({ type: 'media', report });
  });
  const scheduleMedia = (delay = 400) => mediaScan(delay);
  // A stylesheet finished loading (load events don't bubble, so listen while capturing).
  document.addEventListener(
    'load',
    (event) => {
      if (event.target instanceof HTMLLinkElement) scheduleMedia();
    },
    true,
  );

  /* ---------- Stress tests ---------- */

  // Pseudo-translated text: each changed text node remembers the page's text
  // and what is shown, so the page's own later changes are noticed (and
  // translated too) and everything can be put back.
  let pseudo = false;
  const pseudoText = new Map<Text, { original: string; shown: string }>();
  const pseudoPlaceholders = new Map<Element, { original: string; shown: string }>();
  const SKIP_TEXT = 'script, style, noscript, textarea, template, code, pre, kbd, samp, var, [contenteditable]';

  const translateText = (node: Text) => {
    const known = pseudoText.get(node);
    if (known && node.data === known.shown) return;
    const parent = node.parentElement;
    if (!parent || parent.closest(`${SKIP_TEXT}, [${OVERLAY_ATTRIBUTE}]`)) return;
    if (node.data.trim().length < 2) return;
    const shown = pseudoLocalize(node.data);
    if (shown === node.data) return;
    pseudoText.set(node, { original: node.data, shown });
    node.data = shown;
  };

  const translatePlaceholder = (element: Element) => {
    const value = element.getAttribute('placeholder') ?? '';
    const known = pseudoPlaceholders.get(element);
    if ((known && value === known.shown) || value.trim().length < 2) return;
    const shown = pseudoLocalize(value);
    pseudoPlaceholders.set(element, { original: value, shown });
    element.setAttribute('placeholder', shown);
  };

  const translateTree = (root: Node) => {
    if (root instanceof Text) {
      translateText(root);
      return;
    }
    if (!(root instanceof Element) || root.hasAttribute(OVERLAY_ATTRIBUTE)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    for (let node = walker.nextNode(); node && count < MAX_TEXT_NODES; node = walker.nextNode(), count++)
      translateText(node as Text);
    if (root.hasAttribute('placeholder')) translatePlaceholder(root);
    root.querySelectorAll('[placeholder]').forEach(translatePlaceholder);
  };

  const untranslate = () => {
    for (const [node, entry] of pseudoText) if (node.data === entry.shown) node.data = entry.original;
    for (const [element, entry] of pseudoPlaceholders)
      if (element.getAttribute('placeholder') === entry.shown) element.setAttribute('placeholder', entry.original);
    pseudoText.clear();
    pseudoPlaceholders.clear();
  };

  // Right to left: the `dir` attributes the page had are put back afterwards.
  let originalDir: { html: string | null; body: string | null } | null = null;
  const setRtl = (on: boolean) => {
    const { documentElement: html, body } = document;
    if (on) {
      originalDir ??= { html: html.getAttribute('dir'), body: body?.getAttribute('dir') ?? null };
      html.setAttribute('dir', 'rtl');
      // A page that sets dir on <body> would otherwise keep its direction.
      if (originalDir.body !== null) body?.setAttribute('dir', 'rtl');
      return;
    }
    if (!originalDir) return;
    const restore = (element: Element | null, value: string | null) => {
      if (!element) return;
      if (value === null) element.removeAttribute('dir');
      else element.setAttribute('dir', value);
    };
    restore(html, originalDir.html);
    restore(body, originalDir.body);
    originalDir = null;
  };

  // Text at 200% (WCAG 1.4.4, like a browser's text-only zoom): every element
  // gets twice the font size it had, as an inline !important style, measured
  // before any is changed (so inherited sizes don't double twice). What the
  // page had inline is kept and put back. New content is zoomed too, a moment
  // after it appears (everything is measured afresh then).
  const TEXT_ZOOM = 2;
  let textZoom = false;
  const zoomedText = new Map<HTMLElement, { value: string; priority: string }>();
  const unzoomText = () => {
    for (const [element, { value, priority }] of zoomedText) {
      if (value) element.style.setProperty('font-size', value, priority);
      else element.style.removeProperty('font-size');
    }
    zoomedText.clear();
  };
  const zoomText = () => {
    unzoomText();
    const all = [document.documentElement, ...Array.from(document.body?.querySelectorAll('*') ?? [])];
    const elements = all
      .slice(0, MAX_TEXT_NODES)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          !element.closest(`[${OVERLAY_ATTRIBUTE}], script, style, noscript, template`),
      );
    const sizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => {
      const size = sizes[index];
      if (!size) return;
      zoomedText.set(element, {
        value: element.style.getPropertyValue('font-size'),
        priority: element.style.getPropertyPriority('font-size'),
      });
      element.style.setProperty('font-size', `${Math.round(size * TEXT_ZOOM * 100) / 100}px`, 'important');
    });
  };
  const textZoomUpdate = scheduler(() => {
    if (textZoom) zoomText();
  });
  const setTextZoom = (on: boolean) => {
    if (on === textZoom) return;
    textZoom = on;
    quiet();
    if (on) zoomText();
    else unzoomText();
    // Inline styles aren't watched as page changes: check the new layout.
    scheduleChecks();
  };

  /* ---------- Annotations: image sizes and tab order ---------- */

  let annotateImages = false;
  let annotateTabs = false;
  let annotateLayout = false;
  const annotating = () => annotateImages || annotateTabs || annotateLayout;
  let annotations: { host: HTMLElement; layer: HTMLElement } | null = null;
  const MAX_ANNOTATIONS = 400;
  const FOCUSABLE =
    'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [contenteditable=""], [contenteditable="true"], [tabindex]';
  // Grid containers in violet (columns as bands, rows as lines), flex containers in pink, as in DevTools.
  const ANNOTATION_CSS = `
:host{all:initial}
.label{position:fixed;left:0;top:0;padding:1px 5px;border-radius:4px;font:600 11px/15px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;pointer-events:none;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.ok{background:#047857;color:#fff}.low{background:#dc2626;color:#fff}.high{background:#b45309;color:#fff}
.tab{min-width:20px;text-align:center;border-radius:999px;background:#4f46e5;color:#fff}.tab.positive{background:#b45309}
.ring{position:fixed;left:0;top:0;box-sizing:border-box;border:1.5px solid rgba(79,70,229,.85);border-radius:3px;pointer-events:none}
.area{position:fixed;left:0;top:0;box-sizing:border-box;pointer-events:none}
.grid{border:1.5px dashed rgba(124,58,237,.9)}.flex{border:1.5px dashed rgba(219,39,119,.85)}
.column{background:rgba(124,58,237,.1);border-left:1px solid rgba(124,58,237,.55);border-right:1px solid rgba(124,58,237,.55)}
.row{border-top:1px dashed rgba(124,58,237,.6)}
.gridl{background:#6d28d9;color:#fff}.flexl{background:#be185d;color:#fff}`;

  const ensureAnnotations = () => {
    if (annotations?.host.isConnected) return annotations;
    const host = document.createElement('div');
    host.setAttribute(OVERLAY_ATTRIBUTE, '');
    for (const [property, value] of [
      ['position', 'fixed'],
      ['inset', '0'],
      ['pointer-events', 'none'],
      ['z-index', '2147483646'],
      ['display', 'block'],
      ['margin', '0'],
      ['padding', '0'],
      ['border', '0'],
      ['background', 'transparent'],
    ] as [string, string][])
      host.style.setProperty(property, value, 'important');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ANNOTATION_CSS;
    const layer = document.createElement('div');
    root.append(style, layer);
    document.documentElement.append(host);
    annotations = { host, layer };
    return annotations;
  };

  let annotationsQueued = false;
  /** Redraws the labels of what is in view (after scrolling, resizing or page changes). */
  function drawAnnotations() {
    if (annotationsQueued) return;
    if (!annotating()) {
      annotations?.host.remove();
      annotations = null;
      return;
    }
    annotationsQueued = true;
    requestAnimationFrame(() => {
      annotationsQueued = false;
      if (!annotating()) return;
      const { layer } = ensureAnnotations();
      const parts: HTMLElement[] = [];
      const inView = (rect: DOMRect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;
      const place = (element: HTMLElement, rect: DOMRect) => {
        element.style.transform = `translate(${Math.max(0, Math.min(rect.left, window.innerWidth - 24))}px, ${Math.max(0, rect.top)}px)`;
      };
      if (annotateImages) {
        for (const image of Array.from(document.images)) {
          if (parts.length >= MAX_ANNOTATIONS) break;
          const rect = image.getBoundingClientRect();
          if (!image.naturalWidth || !inView(rect)) continue;
          const shown = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
          const label = document.createElement('div');
          // A vector image is sharp at any size: no density to judge.
          if (isVectorImage(image.currentSrc)) {
            label.className = 'label ok';
            label.textContent = `${shown} · SVG`;
          } else {
            const { density, tone } = imageDensity(image.naturalWidth, rect.width);
            label.className = `label ${tone}`;
            label.textContent = `${shown} · ${image.naturalWidth}×${image.naturalHeight} · ${density.toFixed(1)}x`;
          }
          place(label, rect);
          parts.push(label);
        }
      }
      if (annotateTabs) {
        const focusable = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE))
          .slice(0, MAX_SCAN)
          .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]'));
        tabOrder(focusable).forEach((element, index) => {
          if (parts.length >= MAX_ANNOTATIONS * 2) return;
          const rect = element.getBoundingClientRect();
          if (!inView(rect) || getComputedStyle(element).visibility === 'hidden') return;
          const ring = document.createElement('div');
          ring.className = 'ring';
          ring.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
          ring.style.width = `${rect.width}px`;
          ring.style.height = `${rect.height}px`;
          const label = document.createElement('div');
          label.className = `label tab${element.tabIndex > 0 ? ' positive' : ''}`;
          label.textContent = String(index + 1);
          place(label, rect);
          parts.push(ring, label);
        });
      }
      if (annotateLayout) drawLayout(parts, inView, place);
      layer.replaceChildren(...parts);
      // How many labels are drawn (the layer itself is closed to the page; tests read this).
      annotations!.host.dataset.labels = String(parts.filter((part) => part.classList.contains('label')).length);
    });
  }
  // Grid and flex containers, found again after the page changes (not on every scroll).
  let layoutContainers: Element[] | null = null;
  const forgetLayout = () => {
    layoutContainers = null;
  };

  /** Outlines grid and flex containers in view, with a grid's columns and rows and a flex container's direction. */
  function drawLayout(
    parts: HTMLElement[],
    inView: (rect: DOMRect) => boolean,
    place: (element: HTMLElement, rect: DOMRect) => void,
  ) {
    layoutContainers ??= pageElements().filter((element) => {
      const display = getComputedStyle(element).display;
      return display === 'grid' || display === 'inline-grid' || display === 'flex' || display === 'inline-flex';
    });
    const box = (className: string, left: number, top: number, width: number, height: number) => {
      const element = document.createElement('div');
      element.className = `area ${className}`;
      element.style.transform = `translate(${left}px, ${top}px)`;
      element.style.width = `${Math.max(0, width)}px`;
      element.style.height = `${Math.max(0, height)}px`;
      parts.push(element);
    };
    const px = (value: string) => Number.parseFloat(value) || 0;
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    let shown = 0;
    for (const element of layoutContainers) {
      if (shown >= MAX_LAYOUT_CONTAINERS || parts.length >= MAX_ANNOTATIONS * 3) break;
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      if (!inView(rect)) continue;
      const style = getComputedStyle(element);
      const grid = style.display.includes('grid');
      if (!grid && !style.display.includes('flex')) continue;
      shown++;
      box(grid ? 'grid' : 'flex', rect.left, rect.top, rect.width, rect.height);
      const label = document.createElement('div');
      label.className = `label ${grid ? 'gridl' : 'flexl'}`;
      const rtl = style.direction === 'rtl';
      if (grid) {
        const columns = gridTracks(style.gridTemplateColumns);
        const rows = gridTracks(style.gridTemplateRows);
        label.textContent = `grid ${columns?.length ?? 1}×${rows?.length ?? 1}`;
        const content = {
          left: rect.left + px(style.borderLeftWidth) + px(style.paddingLeft),
          top: rect.top + px(style.borderTopWidth) + px(style.paddingTop),
          right: rect.right - px(style.borderRightWidth) - px(style.paddingRight),
          bottom: rect.bottom - px(style.borderBottomWidth) - px(style.paddingBottom),
        };
        if (columns) {
          const gap = px(style.columnGap);
          const free = content.right - content.left - sum(columns) - gap * (columns.length - 1);
          const [start, extra] = distributeTracks(style.justifyContent, free, columns.length, rtl);
          let offset = start;
          for (const size of columns.slice(0, 48)) {
            const left = rtl ? content.right - offset - size : content.left + offset;
            box('column', left, content.top, size, content.bottom - content.top);
            offset += size + gap + extra;
          }
        }
        if (rows && rows.length > 1) {
          const gap = px(style.rowGap);
          const free = content.bottom - content.top - sum(rows) - gap * (rows.length - 1);
          const [start, extra] = distributeTracks(style.alignContent, free, rows.length);
          let offset = start;
          rows.slice(0, 48).forEach((size, index) => {
            // A line in the middle of each gap between two rows.
            if (index > 0)
              box('row', content.left, content.top + offset - (gap + extra) / 2, content.right - content.left, 0);
            offset += size + gap + extra;
          });
        }
      } else {
        const direction = style.flexDirection;
        const forward = rtl ? '←' : '→';
        const backward = rtl ? '→' : '←';
        const arrow =
          direction === 'row' ? forward : direction === 'row-reverse' ? backward : direction === 'column' ? '↓' : '↑';
        label.textContent = `flex ${arrow}${style.flexWrap === 'nowrap' ? '' : ' ⤶'}`;
      }
      place(label, rect);
      parts.push(label);
    }
  }

  const annotationUpdate = scheduler(drawAnnotations);
  window.addEventListener('scroll', () => drawAnnotations(), { passive: true });
  window.addEventListener('resize', () => {
    forgetLayout();
    drawAnnotations();
  });
  // Images that finish loading get their real size.
  document.addEventListener(
    'load',
    (event) => {
      if (annotateImages && event.target instanceof HTMLImageElement) annotationUpdate(100);
    },
    true,
  );

  /* ---------- Full-page screenshots ---------- */

  // Fixed and stuck elements (headers, cookie bars) would repeat on every screen: hidden after the first.
  const FIXED_MARK = 'data-bp-fixed';
  const setFixedHidden = (hidden: boolean) => {
    document.querySelectorAll(`[${FIXED_MARK}]`).forEach((element) => element.removeAttribute(FIXED_MARK));
    setStyle('bp-fixed', hidden ? `[${FIXED_MARK}]{visibility:hidden !important}` : '');
    if (!hidden) return;
    for (const element of pageElements()) {
      const position = getComputedStyle(element).position;
      if (position === 'fixed' || position === 'sticky') element.setAttribute(FIXED_MARK, '');
    }
  };

  /* ---------- Page stats and type scale (the audit panel) ---------- */

  // Observed from the start: the browser keeps the entries of the page's load (`buffered`).
  let largestPaint: number | null = null;
  const resources = new Map<string, PerformanceResourceTiming>();
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) largestPaint = Math.round(last.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Not available.
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[])
        if (resources.size < 5000) resources.set(`${entry.name}#${entry.startTime}`, entry);
    }).observe({ type: 'resource', buffered: true });
  } catch {
    // Not available.
  }

  /** Numbers about how the page loaded and what it shows at this size — never its content. */
  const pageStats = (): PageStats => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    let transferred = navigation?.transferSize ?? 0;
    let unknownSize = 0;
    for (const entry of resources.values()) {
      if (entry.transferSize > 0) transferred += entry.transferSize;
      else unknownSize++;
    }
    let images = 0;
    let imagePixels = 0;
    let shownPixels = 0;
    for (const image of Array.from(document.images).slice(0, MAX_SCAN)) {
      if (!image.complete || !image.naturalWidth || !image.naturalHeight || isVectorImage(image.currentSrc)) continue;
      const rect = image.getBoundingClientRect();
      if (!visible(rect, getComputedStyle(image))) continue;
      images++;
      imagePixels += image.naturalWidth * image.naturalHeight;
      shownPixels += rect.width * rect.height;
    }
    let fonts = 0;
    document.fonts?.forEach((face) => {
      if (face.status === 'loaded') fonts++;
    });
    return {
      requests: resources.size,
      transferred,
      unknownSize,
      images,
      imagePixels: Math.round(imagePixels),
      shownPixels: Math.round(shownPixels),
      dpr: window.devicePixelRatio || 1,
      elements: document.getElementsByTagName('*').length,
      height: document.documentElement.scrollHeight,
      lcp: largestPaint,
      cls: Math.round(cumulativeLayoutShift(visibleShifts()).value * 1000) / 1000,
      fonts,
    };
  };

  const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

  /** The font size, line height and weight of the first shown element of each kind. */
  const typeScale = (): TypeSample[] => {
    const samples: TypeSample[] = [];
    for (const tag of TYPE_TAGS) {
      let first: Element | null = null;
      let count = 0;
      for (const element of Array.from(document.getElementsByTagName(tag)).slice(0, 400)) {
        if (element.closest(`[${OVERLAY_ATTRIBUTE}]`)) continue;
        if (element instanceof HTMLInputElement && !TEXT_INPUTS.has(element.type)) continue;
        if (!visible(element.getBoundingClientRect(), getComputedStyle(element))) continue;
        count++;
        first ??= element;
      }
      if (!first) continue;
      const style = getComputedStyle(first);
      const lineHeight = Number.parseFloat(style.lineHeight);
      samples.push({
        tag,
        count,
        fontSize: Math.round(Number.parseFloat(style.fontSize) * 100) / 100,
        lineHeight: Number.isFinite(lineHeight) ? Math.round(lineHeight * 100) / 100 : null,
        fontWeight: style.fontWeight,
        fontFamily: firstFontFamily(style.fontFamily),
      });
    }
    return samples;
  };

  /** Images shown at this size, the largest first (at most MAX_IMAGES), for the responsive images helper. */
  const imageSamples = (): ImageSample[] => {
    const found: (ImageSample & { area: number; index: number })[] = [];
    Array.from(document.images)
      .slice(0, MAX_SCAN)
      .forEach((image, index) => {
        if (!image.complete || !image.naturalWidth || !image.naturalHeight || isVectorImage(image.currentSrc)) return;
        if (image.closest(`[${OVERLAY_ATTRIBUTE}]`)) return;
        const rect = image.getBoundingClientRect();
        if (!visible(rect, getComputedStyle(image)) || rect.width < 24 || rect.height < 24) return;
        let file: string;
        try {
          // A file's name only: an inline image (data:, blob:) has none.
          const address = new URL(image.currentSrc);
          file = /^https?:$/.test(address.protocol) ? decodeURIComponent(address.pathname.split('/').pop() ?? '') : '';
        } catch {
          file = '';
        }
        found.push({
          selector: cssPath(image),
          label: describeElement(image),
          file: file.slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          dpr: window.devicePixelRatio || 1,
          responsive: image.hasAttribute('srcset') || image.parentElement?.localName === 'picture',
          area: rect.width * rect.height,
          index,
        });
      });
    return found
      .sort((a, b) => b.area - a.area)
      .slice(0, MAX_IMAGES)
      .sort((a, b) => a.index - b.index)
      .map(({ area: _area, index: _index, ...sample }) => sample);
  };

  /** The colours of text, backgrounds and borders of the elements shown, and how many use each. */
  const colorSample = (): ColorSample => {
    const text = new Map<string, number>();
    const background = new Map<string, number>();
    const border = new Map<string, number>();
    const canvas = canvasColor();
    const add = (map: Map<string, number>, value: string) => {
      const color = parseCssColor(value);
      if (!color || color.a < 0.05) return;
      const hex = toHex(color.a < 1 ? blend(color, canvas) : color);
      map.set(hex, (map.get(hex) ?? 0) + 1);
    };
    for (const element of pageElements()) {
      const style = getComputedStyle(element);
      if (!visible(element.getBoundingClientRect(), style)) continue;
      if (ownText(element)) add(text, style.color);
      add(background, style.backgroundColor);
      if (Number.parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none')
        add(border, style.borderTopColor);
    }
    const top = (map: Map<string, number>): ColorCount[] =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_COLORS)
        .map(([hex, count]) => ({ hex, count }));
    return { text: top(text), background: top(background), border: top(border) };
  };

  /* ---------- Inspector ---------- */

  let inspecting = false;
  let hovered: Element | null = null;
  let selectedSelector: string | null = null;
  let selected: Element | null = null;
  let overlay: {
    host: HTMLElement;
    hover: HTMLElement;
    hoverLabel: HTMLElement;
    select: HTMLElement;
    margin: HTMLElement;
    padding: HTMLElement;
  } | null = null;

  // The hovered element's margin (orange) and padding (green), drawn as borders as in DevTools.
  const OVERLAY_CSS = `
:host{all:initial}
.box{position:fixed;left:0;top:0;box-sizing:border-box;pointer-events:none;display:none;border-radius:2px}
.hover{border:1.5px solid #6366f1;background:rgba(99,102,241,.14)}
.select{border:2px solid #f59e0b;background:rgba(245,158,11,.12);box-shadow:0 0 0 1px rgba(255,255,255,.6)}
.space{position:fixed;left:0;top:0;box-sizing:border-box;pointer-events:none;display:none;border-style:solid;border-width:0}
.margin{border-color:rgba(246,178,107,.5)}
.padding{border-color:rgba(147,196,125,.55)}
.label{position:absolute;left:-1.5px;top:-24px;padding:2px 6px;border-radius:4px;background:#312e81;color:#fff;font:600 11px/16px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;max-width:min(360px,90vw);overflow:hidden;text-overflow:ellipsis}
.label.below{top:auto;bottom:-24px}`;

  const ensureOverlay = () => {
    if (overlay?.host.isConnected) return overlay;
    const host = document.createElement('div');
    host.setAttribute(OVERLAY_ATTRIBUTE, '');
    for (const [property, value] of [
      ['position', 'fixed'],
      ['inset', '0'],
      ['pointer-events', 'none'],
      ['z-index', '2147483647'],
      ['display', 'block'],
      ['margin', '0'],
      ['padding', '0'],
      ['border', '0'],
      ['background', 'transparent'],
    ] as [string, string][])
      host.style.setProperty(property, value, 'important');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    const hover = document.createElement('div');
    hover.className = 'box hover';
    const hoverLabel = document.createElement('div');
    hoverLabel.className = 'label';
    hover.append(hoverLabel);
    const select = document.createElement('div');
    select.className = 'box select';
    const margin = document.createElement('div');
    margin.className = 'space margin';
    const padding = document.createElement('div');
    padding.className = 'space padding';
    root.append(style, select, margin, padding, hover);
    document.documentElement.append(host);
    overlay = { host, hover, hoverLabel, select, margin, padding };
    return overlay;
  };

  /** Draws the hovered element's margin and padding areas (hidden when there is no hovered element). */
  const placeSpacing = (element: Element | null, rect: DOMRect | null) => {
    if (!overlay) return;
    const { margin, padding } = overlay;
    if (!element || !rect) {
      margin.style.display = 'none';
      padding.style.display = 'none';
      return;
    }
    const style = getComputedStyle(element);
    type Sides = { top: number; right: number; bottom: number; left: number };
    const sides = (name: (side: keyof Sides) => string): Sides => {
      const px = (side: keyof Sides) => Math.max(0, Number.parseFloat(style.getPropertyValue(name(side))) || 0);
      return { top: px('top'), right: px('right'), bottom: px('bottom'), left: px('left') };
    };
    const m = sides((side) => `margin-${side}`);
    const b = sides((side) => `border-${side}-width`);
    const p = sides((side) => `padding-${side}`);
    const draw = (box: HTMLElement, left: number, top: number, width: number, height: number, widths: Sides) => {
      const { top: t, right: r, bottom: bottom, left: l } = widths;
      if ((t === 0 && r === 0 && bottom === 0 && l === 0) || width <= 0 || height <= 0) {
        box.style.display = 'none';
        return;
      }
      box.style.display = 'block';
      box.style.transform = `translate(${left}px, ${top}px)`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      box.style.borderWidth = `${t}px ${r}px ${bottom}px ${l}px`;
    };
    draw(
      margin,
      rect.left - m.left,
      rect.top - m.top,
      rect.width + m.left + m.right,
      rect.height + m.top + m.bottom,
      m,
    );
    draw(
      padding,
      rect.left + b.left,
      rect.top + b.top,
      rect.width - b.left - b.right,
      rect.height - b.top - b.bottom,
      p,
    );
  };

  const place = (box: HTMLElement, element: Element | null) => {
    const rect = element?.isConnected ? element.getBoundingClientRect() : null;
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      box.style.display = 'none';
      return null;
    }
    box.style.display = 'block';
    box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    return rect;
  };

  let overlayQueued = false;
  function drawOverlay() {
    if (!overlay || overlayQueued) return;
    overlayQueued = true;
    requestAnimationFrame(() => {
      overlayQueued = false;
      if (!overlay) return;
      const rect = place(overlay.hover, inspecting ? hovered : null);
      if (rect && hovered) {
        overlay.hoverLabel.textContent = `${describeElement(hovered)}  ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
        overlay.hoverLabel.classList.toggle('below', rect.top < 26);
      }
      placeSpacing(inspecting ? hovered : null, rect);
      place(overlay.select, selected);
    });
  }

  const removeOverlayIfIdle = () => {
    if (inspecting || selected || !overlay) return;
    overlay.host.remove();
    overlay = null;
  };

  const elementInfo = (element: Element): ElementInfo => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const sides = (property: 'margin' | 'padding') =>
      compressBox(
        (['top', 'right', 'bottom', 'left'] as const).map((side) => style.getPropertyValue(`${property}-${side}`)) as [
          string,
          string,
          string,
          string,
        ],
      );
    const gap = [style.rowGap, style.columnGap].filter((value) => value && value !== 'normal');
    const display = style.display;
    let layout = '';
    if (display.includes('flex')) layout = `flex ${style.flexDirection}${style.flexWrap === 'wrap' ? ' wrap' : ''}`;
    else if (display.includes('grid')) {
      const tracks = style.gridTemplateColumns.split(/\s+/).filter((track) => track && !track.startsWith('['));
      layout = `grid ×${style.gridTemplateColumns === 'none' ? 1 : tracks.length}`;
    }
    if (layout && gap.length) layout += ` · gap ${gap[0] === gap[1] || gap.length === 1 ? gap[0] : gap.join(' ')}`;
    return {
      label: describeElement(element),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(rect.top + window.scrollY),
      left: Math.round(rect.left + window.scrollX),
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && display !== 'none',
      display,
      position: style.position,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      margin: sides('margin'),
      padding: sides('padding'),
      layout,
    };
  };

  const findSelected = () => {
    if (!selectedSelector) return null;
    try {
      return document.querySelector(selectedSelector);
    } catch {
      return null;
    }
  };

  let lastElement = '';
  /** Sends the selected element's details, unless they are what was sent last. */
  const reportElement = () => {
    if (!selectedSelector) return;
    const element = selected ? elementInfo(selected) : null;
    const json = JSON.stringify([selectedSelector, element]);
    if (json === lastElement) return;
    lastElement = json;
    send({ type: 'element', selector: selectedSelector, element });
  };
  const elementUpdate = scheduler(() => {
    if (!selectedSelector) return;
    selected = findSelected();
    drawOverlay();
    reportElement();
  });
  /** Reports the selected element again after the layout changed (resize, new content). */
  const scheduleElementReport = () => {
    if (selectedSelector) elementUpdate(350);
  };

  // At the window, an event from inside a shadow tree is retargeted to its outermost host: an element
  // a selector can find again in the other previews.
  const pickTarget = (event: Event): Element | null => {
    const target = event.target;
    if (!(target instanceof Element) || target.hasAttribute(OVERLAY_ATTRIBUTE)) return null;
    return target === document.documentElement ? document.body : target;
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (!inspecting) return;
      const target = pickTarget(event);
      if (target && target !== hovered) {
        hovered = target;
        drawOverlay();
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener('pointerout', (event) => {
    if (inspecting && !event.relatedTarget) {
      hovered = null;
      drawOverlay();
    }
  });
  // While inspecting, a click picks an element instead of activating it.
  const swallow = (event: Event) => {
    if (!inspecting || !event.isTrusted) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'auxclick', 'contextmenu'])
    window.addEventListener(type, swallow, { capture: true });
  window.addEventListener(
    'click',
    (event) => {
      if (!inspecting || !event.isTrusted) return;
      swallow(event);
      const target = pickTarget(event);
      if (!target) return;
      send({ type: 'pick', selector: cssPath(target), element: elementInfo(target) });
    },
    { capture: true },
  );
  window.addEventListener(
    'keydown',
    (event) => {
      if (inspecting && event.key === 'Escape') {
        event.preventDefault();
        send({ type: 'key', key: 'Escape' });
      }
    },
    { capture: true },
  );

  /* ---------- Synced interactions ---------- */

  // The user's clicks and field values, for the other previews (only while the
  // workspace asks, and only what the user did: replayed events aren't trusted,
  // so they are never sent back).
  let mirroring = false;
  const sendInteraction = (interaction: Interaction) => send({ type: 'interaction', interaction });
  window.addEventListener(
    'click',
    (event) => {
      if (!mirroring || inspecting || !event.isTrusted) return;
      const target = pickTarget(event);
      if (!target) return;
      const element = clickTarget(target);
      if (mirrorsClick(element)) sendInteraction({ kind: 'click', selector: cssPath(element) });
    },
    { capture: true },
  );
  const valueTimers = new Map<Element, number>();
  const fieldOf = (event: Event) => {
    const target = event.composedPath()[0] ?? event.target;
    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
      ? target
      : null;
  };
  window.addEventListener(
    'input',
    (event) => {
      if (!mirroring || !event.isTrusted) return;
      const field = fieldOf(event);
      if (!field || isSensitiveField(field)) return;
      if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) return;
      // Typing sends the value once the user pauses.
      window.clearTimeout(valueTimers.get(field));
      valueTimers.set(
        field,
        window.setTimeout(() => {
          valueTimers.delete(field);
          sendInteraction({ kind: 'value', selector: cssPath(field), value: field.value });
        }, 150),
      );
    },
    { capture: true },
  );
  window.addEventListener(
    'change',
    (event) => {
      if (!mirroring || !event.isTrusted) return;
      const field = fieldOf(event);
      if (!(field instanceof HTMLInputElement) || (field.type !== 'checkbox' && field.type !== 'radio')) return;
      sendInteraction({ kind: 'checked', selector: cssPath(field), checked: field.checked });
    },
    { capture: true },
  );

  /** Does what the user did in another preview, when the same element is shown here. */
  const replay = (interaction: Interaction) => {
    let element: Element | null;
    try {
      element = document.querySelector(interaction.selector);
    } catch {
      return;
    }
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!visible(rect, getComputedStyle(element))) return;
    switch (interaction.kind) {
      case 'click': {
        // The same element may be something else at this size (a link here): the same rules apply.
        if (!mirrorsClick(element)) return;
        const position = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
        const init = { bubbles: true, cancelable: true, composed: true, button: 0, ...position };
        element.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse', isPrimary: true }));
        element.dispatchEvent(new MouseEvent('mousedown', init));
        element.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse', isPrimary: true }));
        element.dispatchEvent(new MouseEvent('mouseup', init));
        if (element instanceof HTMLElement) element.click();
        else element.dispatchEvent(new MouseEvent('click', init));
        break;
      }
      case 'value': {
        if (isSensitiveField(element)) return;
        const field = element;
        if (!(
          field instanceof HTMLInputElement ||
          field instanceof HTMLTextAreaElement ||
          field instanceof HTMLSelectElement
        ))
          return;
        if (field.disabled || ('readOnly' in field && field.readOnly) || field.value === interaction.value) return;
        // The prototype's setter, so frameworks that track the value (React) see the change.
        const prototype = Object.getPrototypeOf(field) as object;
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, interaction.value);
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        if (field instanceof HTMLSelectElement) field.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'checked': {
        if (!(element instanceof HTMLInputElement) || element.disabled) return;
        // A click switches it the way the page expects (input and change events included).
        if (element.checked !== interaction.checked) element.click();
        break;
      }
    }
  };

  /* ---------- Changes to the page ---------- */

  window.addEventListener('resize', () => {
    scheduleChecks();
    scheduleElementReport();
    drawOverlay();
  });
  window.addEventListener('load', () => {
    scheduleChecks();
    scheduleMedia(100);
    // Styles added by scripts after load (CSS-in-JS, lazy routes).
    scheduleMedia(1500);
  });
  const isOverlay = (node: Node) => node instanceof Element && node.hasAttribute(OVERLAY_ATTRIBUTE);
  new MutationObserver((records) => {
    // Adding or removing the inspector's own overlay isn't a change to the page.
    if (
      records.every((record) => {
        const nodes = [...record.addedNodes, ...record.removedNodes];
        return nodes.length > 0 && nodes.every(isOverlay);
      })
    )
      return;
    if (textZoom && records.some((record) => [...record.addedNodes].some((node) => node instanceof HTMLElement)))
      textZoomUpdate(300);
    if (pseudo)
      for (const record of records) {
        if (record.type === 'characterData' && record.target instanceof Text) translateText(record.target);
        else record.addedNodes.forEach(translateTree);
      }
    scheduleChecks();
    scheduleElementReport();
    if (annotating()) {
      forgetLayout();
      annotationUpdate(300);
    }
    const styles = records.some((record) =>
      [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          (node instanceof HTMLStyleElement && !node.id.startsWith('bp-')) ||
          (node instanceof HTMLLinkElement && /stylesheet/i.test(node.rel)),
      ),
    );
    if (styles) scheduleMedia();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  scheduleMedia(150);

  /* ---------- Commands from the workspace ---------- */

  runtime.onMessage.addListener((command: AgentCommand) => {
    switch (command?.type) {
      case 'ping':
        hello();
        lastMedia = '';
        scheduleMedia(50);
        break;
      case 'scrollTo': {
        ignoreScrollUntil = performance.now() + 150;
        if (command.y !== undefined) {
          restoreScroll(command.y);
          break;
        }
        stopRestoring();
        if (command.anchor && scrollToAnchor(command.anchor)) break;
        window.scrollTo({ top: Math.max(0, command.ratio * maxScroll()), behavior: 'instant' });
        break;
      }
      case 'outlines':
        setStyle(
          'bp-outlines',
          command.on ? '*{outline:1px solid rgba(99,102,241,.55) !important;outline-offset:-1px !important}' : '',
        );
        break;
      case 'scrollbars':
        setStyle(
          'bp-scrollbars',
          command.hidden ? 'html{scrollbar-width:none !important}html::-webkit-scrollbar{display:none !important}' : '',
        );
        break;
      case 'css':
        setStyle('bp-live-css', command.css);
        break;
      case 'highlight':
        applyHighlight(command.kind, true);
        break;
      case 'checks':
        checksEnabled = command.enabled;
        skipChecks = new Set(command.skip ?? []);
        if (checksEnabled) {
          // Asked again (e.g. after a hello): report soon, even if nothing changed.
          lastCheck = -Infinity;
          scheduleChecks();
        } else {
          window.clearTimeout(checkTimer);
          checkTimer = 0;
          if (highlighted) applyHighlight(null, false);
        }
        break;
      case 'colorScheme':
        if (command.scheme === colorScheme) break;
        colorScheme = command.scheme;
        quiet();
        applyMediaOverrides();
        break;
      case 'preferences':
        if (
          command.reducedMotion === reduceMotion &&
          command.moreContrast === moreContrast &&
          command.print === printing
        )
          break;
        reduceMotion = command.reducedMotion;
        moreContrast = command.moreContrast;
        printing = command.print;
        quiet();
        applyMediaOverrides();
        break;
      case 'annotate':
        annotateImages = command.images;
        annotateTabs = command.tabOrder;
        annotateLayout = command.layout === true;
        forgetLayout();
        drawAnnotations();
        break;
      case 'animations':
        setStyle(
          'bp-animations',
          command.paused
            ? '*,*::before,*::after{animation-play-state:paused !important;transition:none !important;scroll-behavior:auto !important}'
            : '',
        );
        break;
      case 'stress':
        if (command.pseudo !== pseudo || command.rtl !== (originalDir !== null)) quiet();
        if (command.pseudo !== pseudo) {
          pseudo = command.pseudo;
          if (pseudo && document.body) translateTree(document.body);
          else untranslate();
        }
        setRtl(command.rtl);
        setStyle('bp-text-spacing', command.spacing ? TEXT_SPACING_CSS : '');
        setTextZoom(command.textZoom === true);
        break;
      case 'trackScroll':
        trackScroll = command.on;
        if (trackScroll) reportScroll(true);
        break;
      case 'pageMetrics':
        send({
          type: 'metrics',
          id: command.id,
          scrollHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          scrollY: Math.round(window.scrollY),
        });
        break;
      case 'captureScroll':
        stopRestoring();
        setFixedHidden(command.hideFixed);
        // Not a scroll other previews should follow.
        ignoreScrollUntil = performance.now() + 500;
        window.scrollTo({ top: command.y, behavior: 'instant' });
        requestAnimationFrame(() =>
          requestAnimationFrame(() => send({ type: 'scrolled', id: command.id, y: Math.round(window.scrollY) })),
        );
        break;
      case 'captureEnd':
        setFixedHidden(false);
        break;
      case 'inspect':
        inspecting = command.on;
        hovered = null;
        setStyle('bp-inspect', inspecting ? '*{cursor:crosshair !important}' : '');
        if (inspecting) ensureOverlay();
        drawOverlay();
        removeOverlayIfIdle();
        break;
      case 'select':
        selectedSelector = command.selector;
        selected = findSelected();
        if (selectedSelector) {
          ensureOverlay();
          // Scroll to it only if it is shown here and not already in view.
          const rect = selected?.getBoundingClientRect();
          if (
            selected &&
            rect &&
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.top < 0 || rect.bottom > window.innerHeight)
          )
            reveal(selected);
          lastElement = '';
          reportElement();
        }
        drawOverlay();
        removeOverlayIfIdle();
        break;
      case 'scanProbe': {
        // The workspace resizes the frame; answer once the window has that width
        // and the page's own resize handlers (and its layout) have run.
        const { width, id } = command;
        const started = performance.now();
        const ready = () => window.innerWidth === width || performance.now() - started > 2000;
        let answered = false;
        const answer = () => {
          if (answered) return;
          answered = true;
          send({
            type: 'scanned',
            id,
            width: window.innerWidth,
            report: runChecks(true),
            height: document.documentElement.scrollHeight,
          });
        };
        const wait = () => {
          if (answered) return;
          if (ready()) requestAnimationFrame(() => requestAnimationFrame(answer));
          else requestAnimationFrame(wait);
        };
        wait();
        // Chrome stops animation frames in a preview out of sight (the dialog
        // scrolled): answer anyway, a little later.
        const late = () => {
          if (answered) return;
          if (ready()) answer();
          else window.setTimeout(late, 200);
        };
        window.setTimeout(late, 1000);
        break;
      }
      case 'getStats':
        send({ type: 'stats', id: command.id, stats: pageStats() });
        break;
      case 'getTypeScale':
        send({ type: 'typeScale', id: command.id, samples: typeScale() });
        break;
      case 'getImages':
        send({ type: 'images', id: command.id, images: imageSamples() });
        break;
      case 'getColors':
        send({ type: 'colors', id: command.id, colors: colorSample() });
        break;
      case 'getLinks': {
        // Addresses only, never the links' text: pages of this site, without fragments.
        const hrefs = new Set<string>();
        for (const link of document.links) {
          if (hrefs.size >= MAX_LINKS) break;
          try {
            const url = new URL(link.href);
            if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) continue;
            url.hash = '';
            hrefs.add(url.href);
          } catch {
            // Not a valid address.
          }
        }
        send({ type: 'links', id: command.id, hrefs: [...hrefs] });
        break;
      }
      case 'cookieBanners':
        setStyle('bp-consent', command.hidden ? consentBannerCss() : '');
        break;
      case 'mirror':
        mirroring = command.on;
        break;
      case 'replay':
        replay(command.interaction);
        break;
      case 'getRects': {
        const rects = command.selectors.slice(0, 8).map((selector): ElementRect | null => {
          let element: Element | null;
          try {
            element = document.querySelector(selector);
          } catch {
            element = null;
          }
          const rect = element?.getBoundingClientRect();
          return rect && rect.width > 0 && rect.height > 0
            ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
            : null;
        });
        send({ type: 'rects', id: command.id, rects });
        break;
      }
      case 'getElementRect': {
        let element: Element | null;
        try {
          element = document.querySelector(command.selector);
        } catch {
          element = null;
        }
        if (element && command.reveal) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.top < 0 || rect.bottom > window.innerHeight)) reveal(element);
        }
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const rect = element?.isConnected ? element.getBoundingClientRect() : null;
            const shown: ElementRect | null =
              rect && rect.width > 0 && rect.height > 0
                ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                : null;
            send({ type: 'elementRect', id: command.id, rect: shown });
          }),
        );
        break;
      }
    }
  });
}
