import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './Popover.module.css';

export type PopoverTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  'aria-haspopup': 'dialog';
};

type Props = {
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  width?: number;
};

const GAP = 6;
const EDGE = 8;

/** A non-modal panel anchored to a button, in the top layer (never clipped by cards). */
export function Popover({ label, trigger, children, align = 'start', width = 320 }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = triggerRef.current;
    if (!open || !panel || !button) return;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    const rect = button.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    let left = align === 'end' ? rect.right - panelWidth : rect.left;
    left = Math.min(Math.max(EDGE, left), window.innerWidth - panelWidth - EDGE);
    let top = rect.bottom + GAP;
    let placement = 'below';
    if (top + panelHeight > window.innerHeight - EDGE && rect.top - GAP - panelHeight > EDGE) {
      top = rect.top - GAP - panelHeight;
      placement = 'above';
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(EDGE, top)}px`;
    panel.dataset.placement = placement;
    panel.focus();
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') setOpen(false);
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !panel?.contains(event.target)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    panel?.addEventListener('toggle', onToggle);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      panel?.removeEventListener('toggle', onToggle);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-controls': open ? panelId : undefined,
        'aria-haspopup': 'dialog',
      })}
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          popover="auto"
          tabIndex={-1}
          className={styles.panel}
          style={{ width: `min(${width}px, calc(100vw - ${EDGE * 2}px))` }}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      )}
    </>
  );
}
