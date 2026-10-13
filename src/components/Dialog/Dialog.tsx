import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../Button/Button';
import styles from './Dialog.module.css';

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
};

/**
 * Modal built on the native <dialog> element, which provides focus trapping,
 * Escape to close and an inert background without extra code.
 *
 * Put `data-autofocus` on the element that should receive focus when the
 * dialog opens (React's autoFocus runs before showModal() and is lost).
 */
export function Dialog({ open, title, description, onClose, children, width = 560 }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
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
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <IconButton icon="close" label={t('common.close')} onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
