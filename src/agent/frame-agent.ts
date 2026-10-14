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
 * page only inside the preview and are undone when switched off.
 */
import {
  compressBox,
  cssPath,
  describeElement,
  mediaQueryEdges,
  mentionsColorScheme,
  mentionsReducedMotion,
  pseudoLocalize,
  scheduler,
  swapColorScheme,
  swapReducedMotion,
} from './page-utils';
import {
  AGENT_SOURCE,
  type AgentCommand,
  type AgentEvent,
  type CheckIssue,
  type CheckReport,
  type CheckSample,
  type ColorSchemeOverride,
  type ElementInfo,
  type MediaReport,
  type ScrollAnchor,
} from './protocol';

const MAX_SAMPLES = 8;
const MAX_SCAN = 4000;
const MIN_TEXT_PX = 12;
const MIN_TARGET_PX = 24;
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

  let lastHref = location.href;
  send({ type: 'hello', href: location.href, title: document.title });
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

  window.addEventListener(
    'scroll',
    () => {
      drawOverlay();
      if ((performance.now() < ignoreScrollUntil && !trackScroll) || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        const synced = performance.now() < ignoreScrollUntil;
        if (!synced || trackScroll) reportScroll(synced);
      });
    },
    { passive: true },
  );

  /* ---------- Styles injected on request ---------- */

  const setStyle = (id: string, css: string) => {
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!css) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      (document.head ?? document.documentElement).append(style);
    }
    // Rewriting the same text would look like a page change and trigger new checks.
    if (style.textContent !== css) style.textContent = css;
  };

  /* ---------- Highlighting ---------- */

  const MARK = 'data-bp-issue';
  let flagged = new Map<string, Element[]>();
  let highlighted: string | null = null;

  /** Scrolls this page only (scrollIntoView could also scroll the workspace); other previews don't follow. */
  const reveal = (element: Element) => {
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
    setStyle(
      'bp-highlight',
      `[${MARK}]{outline:2px dashed #e11d48 !important;outline-offset:-2px !important;background-color:rgba(225,29,72,.08) !important}`,
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

  const pageElements = () =>
    Array.from(document.body?.querySelectorAll(`*:not([${OVERLAY_ATTRIBUTE}])`) ?? []).slice(0, MAX_SCAN);

  const runChecks = (): CheckReport => {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const issues: CheckIssue[] = [];
    const nextFlagged = new Map<string, Element[]>();
    const elements = pageElements();

    // 1. Content wider than the viewport (the page scrolls sideways). Pages
    //    that hide horizontal overflow on html/body can't scroll sideways.
    const overflow = document.documentElement.scrollWidth - width;
    if (overflow > 1 && !clipsX(document.documentElement) && !clipsX(document.body)) {
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
    if (width <= 1024 && (!meta || !/width\s*=\s*device-width/i.test(meta.content))) {
      issues.push({ kind: 'viewport-meta', count: 1, detail: meta?.content ?? '', samples: [] });
    }

    // 3. Text smaller than 12px, on phone and tablet sizes (like Lighthouse's
    //    legible-text audit). 0px text is a hiding technique, not small text.
    const smallText: Element[] = [];
    const textSamples: CheckSample[] = [];
    for (const element of width <= 1024 ? elements : []) {
      const hasText = [...element.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 1,
      );
      if (!hasText) continue;
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
    if (width <= 1024) {
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

    // 5. Images shown larger than their real size look blurry (at every width).
    //    `naturalWidth` already accounts for the density of the srcset candidate.
    const upscaled: Element[] = [];
    const imageSamples: CheckSample[] = [];
    for (const image of Array.from(document.images).slice(0, MAX_SCAN)) {
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) continue;
      if (/\.svg(?:[?#]|$)/i.test(image.currentSrc)) continue;
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

    // 6. Fixed (or stuck) elements covering much of a phone or tablet screen, such
    //    as cookie walls or tall headers: sampled on a grid of points.
    if (width <= 1024) {
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

    flagged = nextFlagged;
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
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const originalMedia = new WeakMap<object, string>();
  const overridden = (text: string) => mentionsColorScheme(text) || mentionsReducedMotion(text);

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
    const rewrite = (original: string) => {
      let text = original;
      if (swapScheme) text = swapColorScheme(text);
      if (swapMotion) text = swapReducedMotion(text);
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

  let lastMedia = '';
  /** Re-reads the stylesheets soon (they load and change after the first paint). */
  const mediaScan = scheduler(() => {
    if (colorScheme !== null || reduceMotion) applyMediaOverrides();
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

  /* ---------- Inspector ---------- */

  let inspecting = false;
  let hovered: Element | null = null;
  let selectedSelector: string | null = null;
  let selected: Element | null = null;
  let overlay: { host: HTMLElement; hover: HTMLElement; hoverLabel: HTMLElement; select: HTMLElement } | null = null;

  const OVERLAY_CSS = `
:host{all:initial}
.box{position:fixed;left:0;top:0;box-sizing:border-box;pointer-events:none;display:none;border-radius:2px}
.hover{border:1.5px solid #6366f1;background:rgba(99,102,241,.14)}
.select{border:2px solid #f59e0b;background:rgba(245,158,11,.12);box-shadow:0 0 0 1px rgba(255,255,255,.6)}
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
    root.append(style, select, hover);
    document.documentElement.append(host);
    overlay = { host, hover, hoverLabel, select };
    return overlay;
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
    if (pseudo)
      for (const record of records) {
        if (record.type === 'characterData' && record.target instanceof Text) translateText(record.target);
        else record.addedNodes.forEach(translateTree);
      }
    scheduleChecks();
    scheduleElementReport();
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
        send({ type: 'hello', href: location.href, title: document.title });
        lastMedia = '';
        scheduleMedia(50);
        break;
      case 'scrollTo': {
        ignoreScrollUntil = performance.now() + 150;
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
        applyMediaOverrides();
        break;
      case 'reducedMotion':
        if (command.on === reduceMotion) break;
        reduceMotion = command.on;
        applyMediaOverrides();
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
        if (command.pseudo !== pseudo) {
          pseudo = command.pseudo;
          if (pseudo && document.body) translateTree(document.body);
          else untranslate();
        }
        setRtl(command.rtl);
        break;
      case 'trackScroll':
        trackScroll = command.on;
        if (trackScroll) reportScroll(true);
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
    }
  });
}
