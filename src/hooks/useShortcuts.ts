import { useEffect, useLayoutEffect, useRef } from 'react';

export type ShortcutHandlers = Partial<
  Record<
    | 'focusAddress'
    | 'reload'
    | 'add'
    | 'groups'
    | 'fit'
    | 'zoomIn'
    | 'zoomOut'
    | 'layout'
    | 'rulers'
    | 'capture'
    | 'theme'
    | 'help',
    () => void
  >
>;

const KEYMAP: Record<string, keyof ShortcutHandlers> = {
  '/': 'focusAddress',
  r: 'reload',
  a: 'add',
  g: 'groups',
  f: 'fit',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  _: 'zoomOut',
  l: 'layout',
  m: 'rulers',
  s: 'capture',
  t: 'theme',
  '?': 'help',
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Single-key workspace shortcuts. Ignored while typing, with modifiers, or when a dialog is open. */
export function useShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector('dialog[open], [popover]:popover-open')) return;
      const action = KEYMAP[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      const handler = action ? ref.current[action] : undefined;
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
