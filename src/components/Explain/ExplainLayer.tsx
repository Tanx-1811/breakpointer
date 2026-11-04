import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { explainTarget, topicFor, type ExplainTopic } from '../../state/explain';
import type { GuideId } from '../../state/guides';
import { placeTourCard, type TourPlacement } from '../../state/tour';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './ExplainLayer.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** “Show me how”: the guide of the control explained. */
  onGuide: (guide: GuideId) => void;
};

type Explained = {
  element: Element;
  name: string;
  shortcut?: string;
  topic: ExplainTopic | null;
  /** Clicked (or chosen with the keyboard): the card stays, with its buttons. */
  pinned: boolean;
};

/** Events that would use a control; in this mode they explain it instead. */
const BLOCKED = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'contextmenu', 'auxclick'] as const;

/**
 * “What's this?” mode (H, Help or the palette): pointing at a control — or
 * moving the keyboard focus to it — shows what it does and its shortcut;
 * clicking keeps the card open instead of using the control. Escape ends it.
 */
export function ExplainLayer({ open, onClose, onGuide }: Props) {
  if (!open) return null;
  return <Explainer onClose={onClose} onGuide={onGuide} />;
}

function Explainer({ onClose, onGuide }: Omit<Props, 'open'>) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<Explained | null>(null);
  const [place, setPlace] = useState<{
    top: number;
    left: number;
    placement: TourPlacement;
    ring: DOMRect;
  } | null>(null);
  const pinned = useRef(false);
  const currentRef = useRef(current);
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
    currentRef.current = current;
  });

  // The page shows it's in this mode (the cursor, no ordinary tooltips); focus returns afterwards.
  useEffect(() => {
    const root = document.documentElement;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.dataset.explaining = '';
    return () => {
      delete root.dataset.explaining;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const inLayer = (node: EventTarget | null) => node instanceof Node && Boolean(layerRef.current?.contains(node));
    const show = (node: EventTarget | null, pin: boolean) => {
      const target = explainTarget(node);
      pinned.current = pin && Boolean(target);
      setCurrent(target ? { ...target, topic: topicFor(target.element), pinned: pinned.current } : null);
    };
    const onPointerOver = (event: PointerEvent) => {
      if (pinned.current || inLayer(event.target) || event.pointerType === 'touch') return;
      show(event.target, false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!inLayer(event.target)) show(event.target, false);
    };
    const block = (event: Event) => {
      if (inLayer(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onClick = (event: MouseEvent) => {
      if (inLayer(event.target)) return;
      block(event);
      show(event.target, true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!pinned.current) return close.current();
      // Back to the control (its card shows again, unpinned, as it takes the focus).
      pinned.current = false;
      const item = currentRef.current;
      setCurrent(item && { ...item, pinned: false });
      if (item?.element instanceof HTMLElement && item.element.isConnected) item.element.focus();
    };
    const onScroll = () => {
      if (!pinned.current) setCurrent(null);
    };
    window.addEventListener('pointerover', onPointerOver, true);
    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    for (const type of BLOCKED) window.addEventListener(type, block, true);
    return () => {
      window.removeEventListener('pointerover', onPointerOver, true);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      for (const type of BLOCKED) window.removeEventListener(type, block, true);
    };
  }, []);

  // Next to the control, like the guides' card (again when the window changes size).
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!current || !card || !current.element.isConnected) {
      setPlace(null);
      return;
    }
    const measure = () => {
      const rect = current.element.getBoundingClientRect();
      const spot = placeTourCard(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        { width: card.offsetWidth, height: card.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPlace({ ...spot, ring: rect });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [current]);

  // A pinned card takes the focus, so its buttons can be reached and it is read out.
  useEffect(() => {
    if (current?.pinned && place) cardRef.current?.focus();
  }, [current, place]);

  const guide = current?.topic?.guide;

  return (
    <div ref={layerRef} className={styles.layer}>
      <dialog open className={styles.banner} aria-label={t('explain.title')} data-testid="explain-banner">
        <Icon name="explain" size={16} className={styles.bannerIcon} />
        <p className={styles.bannerText}>
          <strong>{t('explain.title')}</strong> {t('explain.hint')}
        </p>
        <Button size="sm" variant="primary" onClick={onClose} data-testid="explain-done">
          {t('explain.done')}
        </Button>
      </dialog>
      {current && place && (
        <div
          className={styles.ring}
          style={{
            top: place.ring.top - 3,
            left: place.ring.left - 3,
            width: place.ring.width + 6,
            height: place.ring.height + 6,
          }}
          aria-hidden="true"
        />
      )}
      {current && (
        <dialog
          open
          ref={cardRef}
          tabIndex={-1}
          className={styles.card}
          style={place ? { top: place.top, left: place.left } : { visibility: 'hidden' }}
          aria-labelledby={titleId}
          aria-describedby={current.topic ? bodyId : undefined}
          data-testid="explain-card"
          data-pinned={current.pinned || undefined}
          data-placement={place?.placement}
        >
          <div className={styles.head}>
            <h2 id={titleId} className={styles.name}>
              {current.name || t('explain.unnamed')}
            </h2>
            {current.shortcut && <kbd>{current.shortcut}</kbd>}
          </div>
          {current.topic ? (
            <p id={bodyId} className={styles.body}>
              {t(current.topic.body)}
            </p>
          ) : null}
          {current.pinned ? (
            <div className={styles.actions}>
              {guide && (
                <Button size="sm" icon="book" onClick={() => onGuide(guide)} data-testid="explain-guide">
                  {t('explain.showMe')}
                </Button>
              )}
              <span className={styles.spacer} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  pinned.current = false;
                  setCurrent(null);
                }}
              >
                {t('common.close')}
              </Button>
            </div>
          ) : (
            guide && <p className={styles.more}>{t('explain.clickForGuide')}</p>
          )}
        </dialog>
      )}
    </div>
  );
}
