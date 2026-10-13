import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';
import { overlayOpen } from '../hooks/useShortcuts';

/** Wheel distance (pixels) per zoom step; a mouse notch is about 100, a pinch sends many small events. */
const WHEEL_STEP = 60;

/** Ctrl/⌘ + wheel (or a trackpad pinch) over the workspace zooms all viewports one step at a time. */
export function useWheelZoom(ref: RefObject<HTMLElement | null>, onStep: (direction: 1 | -1) => void) {
  const handler = useRef(onStep);
  useLayoutEffect(() => {
    handler.current = onStep;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let total = 0;
    let reset = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // Otherwise Chrome would zoom the whole workspace page.
      event.preventDefault();
      total += event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 33 : 1);
      window.clearTimeout(reset);
      reset = window.setTimeout(() => (total = 0), 250);
      if (Math.abs(total) < WHEEL_STEP) return;
      handler.current(total < 0 ? 1 : -1);
      total = 0;
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
      window.clearTimeout(reset);
    };
  }, [ref]);
}

const INTERACTIVE =
  'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role^="menuitem"], [role="option"], [role="switch"], [role="radio"], [role="tab"], [role="slider"]';

export type PanLayer = {
  style: CSSProperties;
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
};

/**
 * Hold Space and drag to pan the workspace. While Space is held, a transparent
 * layer covers the workspace so the drag isn't swallowed by preview frames.
 * Returns the layer to render, or null.
 */
export function usePan(ref: RefObject<HTMLElement | null>): PanLayer | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const stop = () => {
      start.current = null;
      setDragging(false);
      setRect(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      // Space still presses buttons, ticks boxes and types spaces.
      if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
      if (overlayOpen()) return;
      event.preventDefault();
      if (event.repeat) return;
      const element = ref.current;
      if (element) setRect(element.getBoundingClientRect());
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') stop();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stop);
    };
  }, [ref]);

  if (!rect) return null;
  return {
    style: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    dragging,
    onPointerDown: (event) => {
      const element = ref.current;
      if (!element || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
      setDragging(true);
    },
    onPointerMove: (event) => {
      const element = ref.current;
      const origin = start.current;
      if (!element || !origin) return;
      element.scrollLeft = origin.left - (event.clientX - origin.x);
      element.scrollTop = origin.top - (event.clientY - origin.y);
    },
    onPointerUp: () => {
      start.current = null;
      setDragging(false);
    },
  };
}
