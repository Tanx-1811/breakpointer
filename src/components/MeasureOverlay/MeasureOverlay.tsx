import { useRef, useState, type PointerEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { constrainToLine, rectBetween, toPagePoint, type Point } from '../../state/measure';
import styles from './MeasureOverlay.module.css';

type Props = {
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  zoom: number;
};

/** Pixels on screen a label needs above a rectangle before it moves below it instead. */
const LABEL_ROOM = 24;

/**
 * Lies over a preview while measuring: the pointer shows its position, and a
 * drag draws a rectangle with its size and distance from the edges — in CSS
 * pixels of the page, whatever the zoom. It sits over the frame, so it works
 * on every site.
 */
export function MeasureOverlay({ width, height, zoom }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<Point | null>(null);

  const pointOf = (event: PointerEvent<HTMLElement>): Point => {
    const box = ref.current!.getBoundingClientRect();
    return toPagePoint({ x: event.clientX - box.left, y: event.clientY - box.top }, zoom, { width, height });
  };

  const rect = start && end ? rectBetween(start, end) : null;
  const shown = rect && (rect.width > 0 || rect.height > 0) ? rect : null;
  const px = (value: number) => value * zoom;

  return (
    <div
      ref={ref}
      className={styles.overlay}
      style={{ width: px(width), height: px(height) }}
      data-testid="measure-overlay"
      data-dragging={dragging || undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = pointOf(event);
        setStart(point);
        setEnd(point);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const point = pointOf(event);
        setHover(point);
        if (dragging && start) setEnd(event.shiftKey ? constrainToLine(start, point) : point);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onPointerLeave={() => setHover(null)}
    >
      {hover && !dragging && (
        <>
          <span className={styles.crossX} style={{ top: px(hover.y) }} />
          <span className={styles.crossY} style={{ left: px(hover.x) }} />
          <span
            className={styles.cursor}
            style={{ left: px(hover.x), top: px(hover.y) }}
            data-flip-x={px(hover.x) > px(width) - 90 || undefined}
            data-flip-y={px(hover.y) > px(height) - 34 || undefined}
          >
            {hover.x}, {hover.y}
          </span>
        </>
      )}
      {shown && (
        <>
          {shown.x > 0 && (
            <span
              className={styles.gapX}
              style={{ top: px(shown.y + shown.height / 2), width: px(shown.x) }}
              aria-hidden="true"
            >
              <span className={styles.gapLabel}>{shown.x}</span>
            </span>
          )}
          {shown.y > 0 && (
            <span
              className={styles.gapY}
              style={{ left: px(shown.x + shown.width / 2), height: px(shown.y) }}
              aria-hidden="true"
            >
              <span className={styles.gapLabel}>{shown.y}</span>
            </span>
          )}
          <span
            className={styles.rect}
            style={{ left: px(shown.x), top: px(shown.y), width: px(shown.width), height: px(shown.height) }}
          >
            <span
              className={styles.size}
              data-below={px(shown.y) < LABEL_ROOM || undefined}
              data-end={px(shown.x) > px(width) - 110 || undefined}
              data-testid="measure-size"
            >
              {shown.width} × {shown.height}
            </span>
          </span>
        </>
      )}
      <span className="visually-hidden" aria-live="polite">
        {shown && !dragging ? t('measure.result', { ...shown }) : ''}
      </span>
    </div>
  );
}
