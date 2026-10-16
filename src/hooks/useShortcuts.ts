import { useEffect, useLayoutEffect, useRef } from 'react';

export type ShortcutAction =
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
  | 'help'
  | 'palette'
  | 'inspect'
  | 'audit'
  | 'scan'
  | 'visual'
  | 'measure'
  | 'contrast'
  | 'outlines'
  | 'prevViewport'
  | 'nextViewport'
  | 'actualSize'
  | 'floating'
  | 'escape';

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>> & {
  /** 1–8: the viewport at that position (0 for the first). */
  viewportAt?: (index: number) => void;
};

/** The viewport a digit key picks (1–8, on the main keys or the keypad), from 0; null for other keys. */
export function viewportIndexFor(event: KeyInfo): number | null {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  const match = /^(?:Digit|Numpad)([1-8])$/.exec(event.code);
  return match ? Number(match[1]) - 1 : null;
}

/**
 * Shortcuts are matched on the physical key (`event.code`), so they keep
 * working with a Vietnamese input method (Telex/VNI) switched on and with
 * non-US keyboard layouts. Letters ignore Shift so Caps Lock doesn't matter.
 */
const LETTER_KEYS: Record<string, ShortcutAction> = {
  KeyR: 'reload',
  KeyA: 'add',
  KeyG: 'groups',
  KeyF: 'fit',
  KeyL: 'layout',
  KeyM: 'rulers',
  KeyS: 'capture',
  KeyT: 'theme',
  KeyK: 'palette',
  KeyI: 'inspect',
  KeyE: 'audit',
  KeyW: 'scan',
  KeyV: 'visual',
  KeyX: 'measure',
  KeyC: 'contrast',
  KeyO: 'outlines',
  KeyP: 'floating',
  BracketLeft: 'prevViewport',
  BracketRight: 'nextViewport',
  Digit0: 'actualSize',
  Numpad0: 'actualSize',
};

type KeyInfo = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>;

/** Ctrl+K / ⌘K opens the command palette, also while typing in a field. */
export function isPaletteChord(event: KeyInfo): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    (event.code === 'KeyK' || event.key.toLowerCase() === 'k')
  );
}

/** The shortcut a key press triggers, or null. Exported for tests. */
export function shortcutFor(event: KeyInfo): ShortcutAction | null {
  if (event.isComposing) return null;
  if (isPaletteChord(event)) return 'palette';
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key === 'Escape') return 'escape';
  if (event.key === '?' || (event.code === 'Slash' && event.shiftKey)) return 'help';
  if (event.code === 'Slash' || event.key === '/') return 'focusAddress';
  if (event.code === 'Equal' || event.code === 'NumpadAdd' || event.key === '+') return 'zoomIn';
  if (event.code === 'Minus' || event.code === 'NumpadSubtract' || event.key === '-') return 'zoomOut';
  return LETTER_KEYS[event.code] ?? null;
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** A dialog, menu or popover is open (shortcuts and gestures pause). Tooltips don't count. */
export function overlayOpen(): boolean {
  return Boolean(document.querySelector('dialog[open], [popover]:popover-open:not([data-tooltip-layer])'));
}

/** Single-key workspace shortcuts. Ignored while typing, with modifiers, or when a dialog or menu is open. */
export function useShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // keyCode 229 = the key is being processed by an input method.
      if (event.defaultPrevented || event.repeat || event.keyCode === 229) return;
      const index = viewportIndexFor(event);
      if (index !== null && ref.current.viewportAt && !isTyping(event.target) && !overlayOpen()) {
        event.preventDefault();
        ref.current.viewportAt(index);
        return;
      }
      const action = shortcutFor(event);
      if (!action) return;
      // The palette chord works everywhere except over another dialog.
      if (action === 'palette' && isPaletteChord(event)) {
        if (document.querySelector('dialog[open]:not([data-testid="command-palette"])')) return;
      } else if (isTyping(event.target) || overlayOpen()) return;
      const handler = ref.current[action];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
