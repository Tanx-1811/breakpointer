import { useCallback, useId, useLayoutEffect, useRef, type PointerEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { toPagePoint, type Point } from '../../state/measure';
import { MAX_NOTE_TEXT, notePosition, type Note } from '../../state/notes';
import { Button } from '../Button/Button';
import styles from './NotesOverlay.module.css';

type Props = {
  /** This preview's notes on the page shown, with their numbers. */
  notes: { note: Note; number: number }[];
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  zoom: number;
  /** How far the page is scrolled (CSS pixels): anchored notes move with it. */
  scrollY: number;
  /** Adding notes: a click anywhere on the preview adds one there. */
  adding: boolean;
  /** The note whose text is being edited (on any preview), or null. */
  editing: string | null;
  onAdd: (point: Point) => void;
  onEdit: (id: string | null) => void;
  onChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
};

const GAP = 8;
const EDGE = 8;

/**
 * Numbered pins over a preview, for notes and bug reports. It lies over the
 * frame, so it works on every site; while adding, it takes the clicks.
 */
export function NotesOverlay(props: Props) {
  const { t } = useI18n();
  const { width, height, zoom } = props;
  const ref = useRef<HTMLDivElement>(null);
  const px = (value: number) => value * zoom;

  const add = (event: PointerEvent<HTMLDivElement>) => {
    if (!props.adding || event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    const box = ref.current!.getBoundingClientRect();
    props.onAdd(toPagePoint({ x: event.clientX - box.left, y: event.clientY - box.top }, zoom, { width, height }));
  };

  const editing = props.notes.find(({ note }) => note.id === props.editing);

  return (
    <div
      ref={ref}
      className={styles.overlay}
      style={{ width: px(width), height: px(height) }}
      data-adding={props.adding || undefined}
      data-testid="notes-overlay"
      onPointerDown={add}
    >
      {props.notes.map(({ note, number }) => {
        const position = notePosition(note, props.scrollY);
        if (position.y < 0 || position.y > height) return null;
        return (
          <button
            key={note.id}
            type="button"
            className={styles.pin}
            style={{ left: px(position.x), top: px(position.y) }}
            data-note-id={note.id}
            data-open={props.editing === note.id || undefined}
            aria-label={t('notes.pinLabel', { number, text: note.text.trim() || t('notes.empty') })}
            data-tooltip={note.text.trim() || t('notes.empty')}
            data-testid="note-pin"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => props.onEdit(props.editing === note.id ? null : note.id)}
          >
            {number}
          </button>
        );
      })}
      {editing && (
        <NoteEditor
          key={editing.note.id}
          note={editing.note}
          number={editing.number}
          anchor={() =>
            ref.current?.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(editing.note.id)}"]`) ?? null
          }
          onChange={(text) => props.onChange(editing.note.id, text)}
          onRemove={() => props.onRemove(editing.note.id)}
          onClose={() => props.onEdit(null)}
        />
      )}
    </div>
  );
}

/** The text of one note, in a panel next to its pin (in the top layer, so cards never clip it). */
function NoteEditor({
  note,
  number,
  anchor,
  onChange,
  onRemove,
  onClose,
}: {
  note: Note;
  number: number;
  anchor: () => HTMLElement | null;
  onChange: (text: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const anchorRef = useRef(anchor);
  useLayoutEffect(() => {
    anchorRef.current = anchor;
  });

  /** Next to the pin, inside the window. */
  const place = useCallback(() => {
    const panel = panelRef.current;
    const pin = anchorRef.current();
    if (!panel || !pin) return;
    const rect = pin.getBoundingClientRect();
    const left = Math.min(Math.max(EDGE, rect.right + GAP), window.innerWidth - panel.offsetWidth - EDGE);
    const top = Math.min(Math.max(EDGE, rect.top - 8), window.innerHeight - panel.offsetHeight - EDGE);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }, []);

  // Opens in the top layer with the text field focused; gives focus back to the pin when it closes.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel && typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    place();
    fieldRef.current?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (panel?.contains(document.activeElement)) anchorRef.current()?.focus();
    };
  }, [place]);

  // The pin moves with the page's scroll and the preview's zoom: so does the panel.
  useLayoutEffect(place);

  return (
    <div
      ref={panelRef}
      className={styles.editor}
      popover="manual"
      role="dialog"
      aria-labelledby={`${id}-title`}
      data-testid="note-editor"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <label id={`${id}-title`} className={styles.editorTitle} htmlFor={`${id}-text`}>
        {t('notes.editorTitle', { number })}
      </label>
      <textarea
        ref={fieldRef}
        id={`${id}-text`}
        className={`field ${styles.editorText}`}
        rows={3}
        maxLength={MAX_NOTE_TEXT}
        value={note.text}
        placeholder={t('notes.placeholder')}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className={styles.editorWhere}>
        {note.anchored
          ? t('notes.reportAtPage', { x: note.x, y: note.y })
          : t('notes.reportAtScreen', { x: note.x, y: note.y })}
      </p>
      <div className={styles.editorActions}>
        <Button size="sm" variant="ghost" icon="trash" onClick={onRemove}>
          {t('notes.delete')}
        </Button>
        <Button size="sm" variant="primary" onClick={onClose} shortcut="Esc">
          {t('notes.done')}
        </Button>
      </div>
    </div>
  );
}
