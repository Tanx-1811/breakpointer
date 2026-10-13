import { useEffect, useId, useRef, type ReactNode } from 'react';
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
 */
export function Dialog({ open, title, description, onClose, children, width = 560 }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
        if (event.target === ref.current) onClose();
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
            <IconButton icon="close" label="Close" onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </dialog>
  );
}
