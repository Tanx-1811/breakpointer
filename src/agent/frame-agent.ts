/**
 * Breakpointer frame agent. Registered as a content script only while a
 * workspace tab is open, and only effective on sites the user allowed. It does
 * nothing unless it runs in a preview frame placed directly in a Breakpointer
 * workspace; on every other page it returns immediately.
 *
 * It never sends page content anywhere: it reports the page address and title,
 * scroll position and the results of layout checks to the workspace tab only.
 */
import {
  AGENT_SOURCE,
  type AgentCommand,
  type AgentEvent,
  type CheckIssue,
  type CheckReport,
  type CheckSample,
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
    if (!event.isTrusted || performance.now() - lastInput < 1000) return;
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
  const scrollRatio = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (performance.now() < ignoreScrollUntil || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        if (performance.now() >= ignoreScrollUntil) send({ type: 'scroll', ratio: scrollRatio() });
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

  const applyHighlight = (kind: string | null, reveal: boolean) => {
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
    if (reveal && elements[0]) {
      // Scroll this page only (scrollIntoView could also scroll the workspace),
      // and as a programmatic scroll it doesn't move the other previews.
      const rect = elements[0].getBoundingClientRect();
      ignoreScrollUntil = performance.now() + 300;
      window.scrollTo({
        top: Math.max(0, window.scrollY + rect.top - (window.innerHeight - rect.height) / 2),
        behavior: 'instant',
      });
    }
  };

  /* ---------- Responsive checks ---------- */

  const describe = (element: Element): string => {
    const parts: string[] = [];
    let node: Element | null = element;
    while (node && node !== document.body && node !== document.documentElement && parts.length < 3) {
      let part = node.tagName.toLowerCase();
      if (node.id) part += `#${node.id}`;
      else {
        const classes = [...node.classList].slice(0, 2);
        if (classes.length) part += `.${classes.join('.')}`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

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

  const runChecks = (): CheckReport => {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const issues: CheckIssue[] = [];
    const nextFlagged = new Map<string, Element[]>();
    const elements = Array.from(document.body?.querySelectorAll('*') ?? []).slice(0, MAX_SCAN);

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
          samples.push({ selector: describe(element), detail: `+${Math.round(right(element) - width)}px` });
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
        textSamples.push({ selector: describe(element), detail: `${Math.round(size * 10) / 10}px` });
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
            selector: describe(target.element),
            detail: `${Math.round(target.rect.width)}×${Math.round(target.rect.height)}`,
          });
      }
      if (small.length) {
        nextFlagged.set('tap-targets', small);
        issues.push({ kind: 'tap-targets', count: small.length, samples: targetSamples });
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
  window.addEventListener('resize', scheduleChecks);
  window.addEventListener('load', scheduleChecks);
  new MutationObserver(scheduleChecks).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  /* ---------- Commands from the workspace ---------- */

  runtime.onMessage.addListener((command: AgentCommand) => {
    switch (command?.type) {
      case 'ping':
        send({ type: 'hello', href: location.href, title: document.title });
        break;
      case 'scrollTo': {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        ignoreScrollUntil = performance.now() + 150;
        window.scrollTo({ top: Math.max(0, command.ratio * max), behavior: 'instant' });
        break;
      }
      case 'outlines':
        setStyle(
          'bp-outlines',
          command.on ? '*{outline:1px solid rgba(99,102,241,.55) !important;outline-offset:-1px !important}' : '',
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
    }
  });
}
