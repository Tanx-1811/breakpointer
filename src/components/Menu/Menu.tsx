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
      /** A second, quieter line under the label. */
      description?: string;
      icon?: IconName;
      /** Text on the right, e.g. a count. */
      hint?: string;
      /** Keyboard shortcut shown on the right. */
      shortcut?: string;
      /** A checkbox item (stays open when toggled). */
      checked?: boolean;
      /** With `checked`: one of a set of options (menuitemradio). */
      radio?: boolean;
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
    let placement = 'below';
    if (top + height > window.innerHeight - EDGE && rect.top - GAP - height > EDGE) {
      top = rect.top - GAP - height;
      placement = 'above';
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.dataset.placement = placement;
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
    // The panel is positioned once; if the page or workspace scrolls, it would
    // drift away from its button, so close it (scrolling inside it is fine).
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !panel?.contains(event.target)) setOpen(false);
    };
    panel?.addEventListener('toggle', onToggle);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      panel?.removeEventListener('toggle', onToggle);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
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
      default:
        // Type-ahead: jump to the next item starting with the typed letter.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const key = event.key.toLocaleLowerCase();
          const order = [...list.slice(index + 1), ...list.slice(0, index + 1)];
          order.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(key))?.focus();
        }
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
            const role = checkable ? (entry.radio ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem';
            return (
              <button
                key={entry.id}
                type="button"
                role={role}
                aria-checked={checkable ? entry.checked : undefined}
                tabIndex={-1}
                disabled={entry.disabled}
                className={[styles.item, entry.tone === 'danger' && styles.danger].filter(Boolean).join(' ')}
                data-menu-item={entry.id}
                onClick={() => {
                  // Checkbox items keep the menu open so several can be switched in a row.
                  if (!checkable || entry.radio) close(true);
                  entry.onSelect();
                }}
              >
                <span className={styles.itemIcon} data-checkable={checkable || undefined}>
                  {checkable ? (
                    entry.radio ? (
                      <span className={styles.radio} data-on={entry.checked || undefined} />
                    ) : (
                      <span className={styles.checkbox} data-on={entry.checked || undefined}>
                        {entry.checked && <Icon name="check" size={12} strokeWidth={2.6} />}
                      </span>
                    )
                  ) : (
                    entry.icon && <Icon name={entry.icon} size={16} />
                  )}
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{entry.label}</span>
                  {entry.description && <span className={styles.itemDescription}>{entry.description}</span>}
                </span>
                {entry.hint && <span className={styles.hint}>{entry.hint}</span>}
                {entry.shortcut && <kbd className={styles.shortcut}>{entry.shortcut}</kbd>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
