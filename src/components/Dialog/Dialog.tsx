import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Dialog.module.css';

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** A small icon tile next to the title. */
  icon?: IconName;
  onClose: () => void;
  children: ReactNode;
  /** Actions pinned to the bottom of the dialog (stay visible while the body scrolls). */
  footer?: ReactNode;
  width?: number;
  /** The body has no padding (for layouts with their own, e.g. two panes). */
  flush?: boolean;
  /**
   * Stays open but out of sight, without dimming the page behind it (e.g.
   * while the eyedropper picks a colour from the previews under it).
   */
  concealed?: boolean;
};

/**
 * Modal built on the native <dialog> element, which provides focus trapping,
 * Escape to close and an inert background without extra code.
 *
 * Put `data-autofocus` on the element that should receive focus when the
 * dialog opens (React's autoFocus runs before showModal() and is lost).
 */
export function Dialog({
  open,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
  width = 560,
  flush,
  concealed,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Start on the marked field, else on the title — not on the Close button,
      // where Enter would close the dialog straight away.
      (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('h2'))?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A body that scrolls (long content, small screens) must be reachable with the
  // keyboard: it becomes focusable while its content overflows.
  useEffect(() => {
    const body = bodyRef.current;
    if (!open || !body || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setScrollable(body.scrollHeight > body.clientHeight + 1));
    observer.observe(body);
    for (const child of Array.from(body.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [open]);

  // Closing is driven by `open` only. Listening to the native "close" event
  // would also fire when another dialog replaces this one (e.g. Settings →
  // Site access) and close the new dialog right after it opened.
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-concealed={concealed || undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === ref.current;
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog element itself, outside the panel)
        // closes it — but not a text selection that started inside and ended outside.
        if (event.target === ref.current && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
    >
      {open && (
        <div className={styles.panel}>
          <header className={styles.header}>
            {icon && (
              <span className={styles.headerIcon} aria-hidden="true">
                <Icon name={icon} size={18} />
              </span>
            )}
            <div className={styles.heading}>
              <h2 id={titleId} className={styles.title} tabIndex={-1}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <IconButton icon="close" size="sm" label={t('common.close')} onClick={onClose} className={styles.close} />
          </header>
          <div
            ref={bodyRef}
            className={flush ? styles.bodyFlush : styles.body}
            tabIndex={scrollable ? 0 : undefined}
            role={scrollable ? 'region' : undefined}
            aria-labelledby={scrollable ? titleId : undefined}
          >
            {children}
          </div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
