import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Menu.module.css';

export type MenuEntry =
  | {
      kind?: 'item';
      id: string;
      label: string;
      icon?: IconName;
      hint?: string;
      checked?: boolean;
      disabled?: boolean;
      tone?: 'danger';
      onSelect: () => void;
    }
  | { kind: 'heading'; id: string; label: string }
  | { kind: 'separator'; id: string }
  | { kind: 'note'; id: string; label: string };

export type MenuTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
};

type Props = {
  label: string;
  entries: MenuEntry[];
  align?: 'start' | 'end';
  minWidth?: number;
  trigger: (props: MenuTriggerProps) => ReactNode;
};

const GAP = 6;
const EDGE = 8;

/**
 * Accessible dropdown menu (WAI-ARIA menu button pattern). Rendered in the
 * top layer with the Popover API so it is never clipped by scrolling cards.
 */
export function Menu({ label, entries, align = 'start', minWidth = 200, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const items = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = triggerRef.current;
    if (!open || !panel || !button) return;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();

    const rect = button.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.min(Math.max(EDGE, left), window.innerWidth - width - EDGE);
    let top = rect.bottom + GAP;
    if (top + height > window.innerHeight - EDGE && rect.top - GAP - height > EDGE) top = rect.top - GAP - height;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    items()[0]?.focus();
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Light dismiss (outside click, Escape) closes the popover; mirror it in state.
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') setOpen(false);
    };
    // Clicking into a preview iframe doesn't reach this document; blur does.
    const onBlur = () => setOpen(false);
    const onResize = () => setOpen(false);
    panel?.addEventListener('toggle', onToggle);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    return () => {
      panel?.removeEventListener('toggle', onToggle);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    onClick: () => setOpen((value) => !value),
    onKeyDown: (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true);
      }
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  };

  return (
    <>
      {trigger(triggerProps)}
      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={label}
          popover="auto"
          className={styles.panel}
          style={{ minWidth }}
          onKeyDown={onPanelKeyDown}
        >
          {entries.map((entry) => {
            if (entry.kind === 'separator') return <div key={entry.id} role="separator" className={styles.separator} />;
            if (entry.kind === 'heading')
              return (
                <div key={entry.id} role="presentation" className={styles.heading}>
                  {entry.label}
                </div>
              );
            if (entry.kind === 'note')
              return (
                <div key={entry.id} role="presentation" className={styles.note}>
                  {entry.label}
                </div>
              );
            const checkable = entry.checked !== undefined;
            return (
              <button
                key={entry.id}
                type="button"
                role={checkable ? 'menuitemradio' : 'menuitem'}
                aria-checked={checkable ? entry.checked : undefined}
                tabIndex={-1}
                disabled={entry.disabled}
                className={[styles.item, entry.tone === 'danger' && styles.danger].filter(Boolean).join(' ')}
                onClick={() => {
                  close(true);
                  entry.onSelect();
                }}
              >
                <span className={styles.itemIcon}>
                  {checkable
                    ? entry.checked && <Icon name="check" size={15} />
                    : entry.icon && <Icon name={entry.icon} size={15} />}
                </span>
                <span className={styles.itemLabel}>{entry.label}</span>
                {entry.hint && <span className={styles.hint}>{entry.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
