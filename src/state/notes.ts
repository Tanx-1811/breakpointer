import type { Translate } from '../i18n/translate';
import { pageOf } from './follow';

/**
 * Notes pinned on previews, for bug reports: "the menu covers the logo here, at
 * 375px". They are kept for the session, per page, and copied as Markdown.
 */

export const MAX_NOTES = 50;
export const MAX_NOTE_TEXT = 1000;

export type Note = {
  id: string;
  /** The card (viewport, or its B side) the note is on. */
  cardId: string;
  /** The page it is about, without its fragment. */
  page: string;
  /** Where, in CSS pixels of the viewport. */
  x: number;
  /**
   * Where, in CSS pixels: from the top of the page when `anchored` (the page's
   * scroll position was known), else from the top of the viewport.
   */
  y: number;
  /** Follows the page when it scrolls (its agent reports the scroll position). */
  anchored: boolean;
  text: string;
};

export type NewNote = Omit<Note, 'id' | 'text' | 'page'> & { page: string };

/** The note's place in the viewport now, given how far the page is scrolled. */
export function notePosition(note: Pick<Note, 'x' | 'y' | 'anchored'>, scrollY: number): { x: number; y: number } {
  return { x: note.x, y: note.anchored ? note.y - scrollY : note.y };
}

/** A note at a point of a viewport, from the top of the page when the scroll position is known. */
export function newNote(
  id: string,
  cardId: string,
  page: string,
  point: { x: number; y: number },
  scrollY: number | null,
): Note {
  return {
    id,
    cardId,
    page: pageOf(page),
    x: Math.round(point.x),
    y: Math.round(scrollY === null ? point.y : point.y + scrollY),
    anchored: scrollY !== null,
    text: '',
  };
}

export const normalizeNoteText = (text: string) => text.slice(0, MAX_NOTE_TEXT);

/** The notes of a page, in the order they were added. */
export function notesOf(notes: readonly Note[], page: string | null): Note[] {
  if (!page) return [];
  const key = pageOf(page);
  return notes.filter((note) => note.page === key);
}

export type NoteCard = {
  id: string;
  /** e.g. "Phone" or "Phone · B". */
  name: string;
  width: number;
  height: number;
  /** e.g. "md", "Dark page colours" (already written out). */
  details: string[];
};

export type NoteReportMeta = {
  page: string;
  title: string;
  created: Date;
  language: string;
  /** e.g. "Chrome 141". */
  browser: string;
  version: string;
};

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * A bug report in Markdown: the page, then each viewport with its notes,
 * numbered as on the previews (in the order they were added). Viewports
 * without notes, and notes of previews that are gone, are left out.
 */
export function notesMarkdown(
  notes: readonly Note[],
  cards: readonly NoteCard[],
  meta: NoteReportMeta,
  t: Translate,
): string {
  const numbers = new Map(notes.map((note, index) => [note.id, index + 1]));
  const lines = [
    `${t('notes.reportTitle')} · ${meta.title.trim() || meta.page}`,
    '',
    `- ${t('report.page')}: ${meta.page}`,
    `- ${t('notes.reportEnvironment')}: ${meta.browser} · Breakpointer ${meta.version}`,
    `- ${t('report.created')}: ${meta.created.toLocaleString(meta.language)}`,
  ];
  for (const card of cards) {
    const own = notes.filter((note) => note.cardId === card.id);
    if (!own.length) continue;
    lines.push('', `### ${[`${card.name} (${card.width} × ${card.height})`, ...card.details].join(' · ')}`, '');
    for (const note of own) {
      const where = note.anchored
        ? t('notes.reportAtPage', { x: note.x, y: note.y })
        : t('notes.reportAtScreen', { x: note.x, y: note.y });
      lines.push(`${numbers.get(note.id)}. ${oneLine(note.text) || t('notes.empty')} _(${where})_`);
    }
  }
  return `${lines.join('\n')}\n`;
}
