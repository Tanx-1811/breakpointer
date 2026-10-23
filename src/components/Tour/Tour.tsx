import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { placeTourCard, type Box, type Size } from '../../state/tour';
import { Button } from '../Button/Button';
import styles from './Tour.module.css';

type TourStep = { target: string; title: MessageKey; body: MessageKey };

/** The controls the tour points at, in order; a step whose control isn't shown is left out. */
export const TOUR_STEPS: readonly TourStep[] = [
  { target: '[data-testid="address-input"]', title: 'tour.addressTitle', body: 'tour.addressBody' },
  { target: '[data-tour="viewports"]', title: 'tour.viewportsTitle', body: 'tour.viewportsBody' },
  { target: '[data-tour="breakpoints"]', title: 'tour.breakpointsTitle', body: 'tour.breakpointsBody' },
  { target: '[data-testid="sync-toggle"]', title: 'tour.syncTitle', body: 'tour.syncBody' },
  { target: '[data-testid="inspect-toggle"]', title: 'tour.inspectTitle', body: 'tour.inspectBody' },
  { target: '[data-testid="audit-toggle"]', title: 'tour.auditTitle', body: 'tour.auditBody' },
  { target: '[data-testid="notes-toggle"]', title: 'tour.notesTitle', body: 'tour.notesBody' },
  { target: '[data-tools-trigger]', title: 'tour.toolsTitle', body: 'tour.toolsBody' },
  { target: '[data-testid="help-button"]', title: 'tour.helpTitle', body: 'tour.helpBody' },
];

const shown = (selector: string) => {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
};

/** A short walk through the workspace's main controls (started from the welcome screen, Help or the palette). */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <TourCard onClose={onClose} />;
}

function TourCard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const [steps] = useState(() => TOUR_STEPS.filter((step) => shown(step.target)));
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<{ box: Box; card: Size; window: Size } | null>(null);
  const cardRef = useRef<HTMLDialogElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Where the step's control is (again when the window changes size).
  useLayoutEffect(() => {
    if (!step) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = shown(step.target);
        const card = cardRef.current;
        if (!rect || !card) return;
        setLayout({
          box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          card: { width: card.offsetWidth, height: card.offsetHeight },
          window: { width: window.innerWidth, height: window.innerHeight },
        });
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [step]);

  // Each step starts on its main button; when the tour ends, focus goes back to what started it.
  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-tour-next]')?.focus();
  }, [index]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // Escape ends the tour wherever the focus is.
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

  const next = () => (last ? onClose() : setIndex(index + 1));
  const back = () => setIndex(Math.max(0, index - 1));
  const place = layout ? placeTourCard(layout.box, layout.card, layout.window) : null;

  return (
    <>
      {layout && (
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
        data-step={index + 1}
        data-placement={place?.placement}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') next();
          else if (event.key === 'ArrowLeft') back();
          else return;
          event.preventDefault();
        }}
      >
        <p className={styles.count}>{t('tour.count', { current: index + 1, total: steps.length })}</p>
        <h2 id={titleId} className={styles.title}>
          {t(step.title)}
        </h2>
        <p id={bodyId} className={styles.body}>
          {t(step.body)}
        </p>
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
            {last ? t('tour.done') : t('tour.next')}
          </Button>
        </div>
      </dialog>
    </>
  );
}
