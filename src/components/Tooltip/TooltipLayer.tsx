import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './Tooltip.module.css';

type Tip = { text: string; shortcut?: string; rect: DOMRect };

const SHOW_DELAY_MS = 450;
/** Moving from one control to the next while a tooltip shows switches at once. */
const SWITCH_WINDOW_MS = 300;
const GAP = 8;
const EDGE = 8;

function tooltipTarget(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? (node.closest<HTMLElement>('[data-tooltip]') ?? null) : null;
}

/**
 * One tooltip for the whole page. Any element with `data-tooltip` (and
 * optionally `data-shortcut`) gets it on hover or keyboard focus. The text is
 * the element's accessible name already, so the tooltip is hidden from
 * assistive technology. It lives in the top layer, above cards and dialogs.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer = 0;
    let current: HTMLElement | null = null;
    let lastHiddenAt = -Infinity;
    let visible = false;

    const read = (element: HTMLElement): Tip | null => {
      const text = element.dataset.tooltip?.trim();
      if (!text || !element.isConnected) return null;
      return { text, shortcut: element.dataset.shortcut || undefined, rect: element.getBoundingClientRect() };
    };
    const hide = () => {
      window.clearTimeout(timer);
      if (visible) lastHiddenAt = performance.now();
      visible = false;
      current = null;
      setTip(null);
    };
    const showFor = (element: HTMLElement) => {
      window.clearTimeout(timer);
      current = element;
      const quick = visible || performance.now() - lastHiddenAt < SWITCH_WINDOW_MS;
      timer = window.setTimeout(
        () => {
          if (current !== element) return;
          const next = read(element);
          visible = Boolean(next);
          setTip(next);
        },
        quick ? 0 : SHOW_DELAY_MS,
      );
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const target = tooltipTarget(event.target);
      if (target === current) return;
      if (!target) {
        if (current) hide();
        return;
      }
      showFor(target);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = tooltipTarget(event.target);
      if (!target || !(event.target as Element).matches(':focus-visible')) return;
      showFor(target);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (tooltipTarget(event.target) === current) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && current) hide();
    };

    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !tip) return;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    const { rect } = tip;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    let top = rect.bottom + GAP;
    let placement = 'below';
    if (top + height > window.innerHeight - EDGE) {
      top = rect.top - GAP - height;
      placement = 'above';
    }
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - EDGE);
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(EDGE, top)}px`;
    panel.dataset.placement = placement;
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={panelRef} popover="manual" className={styles.tooltip} aria-hidden="true" data-tooltip-layer>
      <span>{tip.text}</span>
      {tip.shortcut && <kbd className={styles.kbd}>{tip.shortcut}</kbd>}
    </div>
  );
}
