import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { minimapScale, scrollForPoint, type MinimapBox } from '../../state/minimap';
import styles from './Minimap.module.css';

type Card = MinimapBox & { id: string; sizeClass: string };
type Layout = {
  content: { width: number; height: number };
  view: MinimapBox;
  cards: Card[];
};

type Props = {
  /** The scrolling workspace whose cards (`[data-card-id]`) are drawn. */
  workspaceRef: RefObject<HTMLElement | null>;
  /** Changes whenever the cards may have moved or changed size (ids, sizes, zoom, layout). */
  layoutKey: string;
};

const MAX_WIDTH = 184;
const MAX_HEIGHT = 120;
/** Pixels of the workspace out of sight before the minimap shows. */
const MIN_HIDDEN = 120;

/**
 * An overview of the workspace in a corner, shown only while a good part of it is out of sight: every
 * preview as a box in its size-class colour and the part on screen as a frame.
 * Press or drag on it to scroll there.
 */
export function Minimap({ workspaceRef, layoutKey }: Props) {
  const { t } = useI18n();
  const [layout, setLayout] = useState<Layout | null>(null);
  const frame = useRef(0);

  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const element = workspaceRef.current;
      if (!element) return setLayout(null);
      const { scrollWidth, scrollHeight, clientWidth, clientHeight, scrollLeft, scrollTop } = element;
      // Only when a good part of the workspace is out of sight (not the room kept for the zoom dock).
      if (scrollWidth - clientWidth < MIN_HIDDEN && scrollHeight - clientHeight < MIN_HIDDEN) return setLayout(null);
      const origin = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll<HTMLElement>('[data-card-id]')].flatMap((card) => {
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];
        return [
          {
            id: card.dataset.cardId ?? '',
            sizeClass: card.dataset.sizeClass ?? '',
            x: rect.left - origin.left + scrollLeft,
            y: rect.top - origin.top + scrollTop,
            width: rect.width,
            height: rect.height,
          },
        ];
      });
      setLayout({
        content: { width: scrollWidth, height: scrollHeight },
        view: { x: scrollLeft, y: scrollTop, width: clientWidth, height: clientHeight },
        cards,
      });
    });
  }, [workspaceRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure, layoutKey]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    element.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const cards = element.querySelector('[data-cards]');
    if (cards) observer.observe(cards);
    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [measure, workspaceRef, layoutKey]);

  if (!layout) return null;
  const scale = minimapScale(layout.content, { width: MAX_WIDTH, height: MAX_HEIGHT });
  const width = layout.content.width * scale;
  const height = layout.content.height * scale;

  const scrollTo = (event: PointerEvent<HTMLDivElement>) => {
    const element = workspaceRef.current;
    if (!element) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const { left, top } = scrollForPoint(
      { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale },
      layout.view,
      layout.content,
    );
    element.scrollTo({ left, top });
  };

  return (
    <div
      className={styles.minimap}
      style={{ width: width + 16, height: height + 16 }}
      aria-hidden="true"
      data-tooltip={t('minimap.hint')}
      data-testid="minimap"
    >
      <div
        className={styles.canvas}
        style={{ width, height }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          scrollTo(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollTo(event);
        }}
      >
        {layout.cards.map((card) => (
          <span
            key={card.id}
            className={styles.card}
            data-size-class={card.sizeClass}
            style={{
              left: card.x * scale,
              top: card.y * scale,
              width: card.width * scale,
              height: card.height * scale,
            }}
          />
        ))}
        <span
          className={styles.view}
          style={{
            left: layout.view.x * scale,
            top: layout.view.y * scale,
            width: Math.min(layout.view.width, layout.content.width) * scale,
            height: Math.min(layout.view.height, layout.content.height) * scale,
          }}
        />
      </div>
    </div>
  );
}
