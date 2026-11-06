import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { guideById, visibleSteps, type Guide, type GuideAction, type GuideId } from '../../state/guides';
import { placeTourCard, type Box, type Size } from '../../state/tour';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './Tour.module.css';

/** The controls the workspace tour points at, in order; a step whose control isn't shown is left out. */
export const TOUR_STEPS = guideById('basics').steps;

/** How long a step waits for its control to appear after opening something (a panel sliding in). */
const LOCATE_TRIES = 20;
const LOCATE_EVERY_MS = 100;

const shown = (selector: string) => {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The guide to walk through (default: the workspace tour). */
  guide?: GuideId;
  /** Opens what a step talks about (the audit, the inspector…), or what the last step offers to start. */
  onAction?: (action: GuideAction) => void;
};

/**
 * A guide: a card next to each control it talks about, one step at a time
 * (started from the welcome screen, Help, the palette or “What's this?”).
 */
export function Tour({ open, onClose, guide = 'basics', onAction }: Props) {
  if (!open) return null;
  return <TourCard key={guide} guide={guideById(guide)} onClose={onClose} onAction={onAction} />;
}

type Layout = { box: Box | null; card: Size; window: Size };

function TourCard({
  guide,
  onClose,
  onAction,
}: {
  guide: Guide;
  onClose: () => void;
  onAction?: (action: GuideAction) => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const [steps] = useState(() => visibleSteps(guide, (selector) => Boolean(shown(selector))));
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<Layout | null>(null);
  const cardRef = useRef<HTMLDialogElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const action = useRef(onAction);
  useLayoutEffect(() => {
    action.current = onAction;
  });

  // Open what the step talks about, then find its control (again when the window changes size). A
  // control that doesn't show up leaves the card in the middle of the window.
  useLayoutEffect(() => {
    if (!step) return;
    if (step.action) action.current?.(step.action);
    let timer = 0;
    let tries = 0;
    let previous = '';
    const place = (rect: DOMRect | null) => {
      const card = cardRef.current;
      if (!card) return;
      setLayout({
        box: rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        window: { width: window.innerWidth, height: window.innerHeight },
      });
    };
    const locate = () => {
      window.clearTimeout(timer);
      const rect = step.target ? shown(step.target) : null;
      const key = rect ? `${rect.left},${rect.top},${rect.width},${rect.height}` : '';
      if (key !== previous || tries === 0) place(rect);
      // Keep looking while the control is missing or still moving (a panel sliding in).
      if (step.target && tries < LOCATE_TRIES && (!rect || key !== previous)) {
        tries++;
        previous = key;
        timer = window.setTimeout(locate, LOCATE_EVERY_MS);
      }
    };
    locate();
    const onResize = () => place(step.target ? shown(step.target) : null);
    window.addEventListener('resize', onResize);
    // The card can grow after it was measured (its text wraps differently once placed): place it
    // again, or its bottom ends up below the window.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    if (cardRef.current) observer?.observe(cardRef.current);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [step]);

  // Each step starts on its main button (once the card is placed and shown); when the guide ends,
  // focus goes back to what started it.
  const placed = layout !== null;
  useEffect(() => {
    if (placed) cardRef.current?.querySelector<HTMLElement>('[data-tour-next]')?.focus();
  }, [index, placed]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // Escape ends the guide wherever the focus is.
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Nothing to point at (no workspace controls shown): there's no tour.
  useEffect(() => {
    if (!step) close.current();
  }, [step]);
  if (!step) return null;

  const finish = last ? guide.finish : undefined;
  const next = () => {
    if (!last) return setIndex(index + 1);
    onClose();
    if (finish) onAction?.(finish.action);
  };
  const back = () => setIndex(Math.max(0, index - 1));
  const place = layout
    ? layout.box
      ? placeTourCard(layout.box, layout.card, layout.window)
      : {
          top: Math.max(12, Math.round((layout.window.height - layout.card.height) / 2)),
          left: Math.max(12, Math.round((layout.window.width - layout.card.width) / 2)),
          placement: 'center' as const,
        }
    : null;

  return (
    <>
      {layout?.box && (
        <div
          className={styles.spotlight}
          style={{
            top: layout.box.y - 4,
            left: layout.box.x - 4,
            width: layout.box.width + 8,
            height: layout.box.height + 8,
          }}
          aria-hidden="true"
        />
      )}
      <dialog
        open
        ref={cardRef}
        className={styles.card}
        style={place ? { top: place.top, left: place.left } : { visibility: 'hidden' }}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="tour"
        data-guide={guide.id}
        data-step={index + 1}
        data-placement={place?.placement}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') next();
          else if (event.key === 'ArrowLeft') back();
          else return;
          event.preventDefault();
        }}
      >
        <p className={styles.count}>
          <Icon name={guide.icon} size={13} className={styles.guideIcon} />
          <span className={styles.guideName}>{t(guide.title)}</span>
          <span aria-hidden="true">·</span>
          <span>{t('tour.count', { current: index + 1, total: steps.length })}</span>
        </p>
        <h2 id={titleId} className={styles.title}>
          {t(step.title)}
        </h2>
        <p id={bodyId} className={styles.body}>
          {t(step.body)}
        </p>
        <div className={styles.progress} aria-hidden="true">
          {steps.map((_, position) => (
            <span key={position} className={styles.dot} data-done={position <= index || undefined} />
          ))}
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('tour.skip')}
          </Button>
          <span className={styles.spacer} />
          {index > 0 && (
            <Button size="sm" onClick={back}>
              {t('tour.back')}
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={next} data-tour-next>
            {finish ? t(finish.label) : last ? t('tour.done') : t('tour.next')}
          </Button>
        </div>
      </dialog>
    </>
  );
}
