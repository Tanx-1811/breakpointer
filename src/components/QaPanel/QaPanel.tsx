import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import {
  MAX_QA_ITEMS,
  MAX_QA_TEXT,
  QA_RESULT_KEYS,
  addQaItem,
  editQaItem,
  nextQaResult,
  normalizeQaText,
  qaSummary,
  removeQaItem,
  type QaResult,
  type QaResults,
  type QaViewport,
} from '../../state/qa';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import type { QaItem } from '../../types';
import { Button, IconButton } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import { Menu } from '../Menu/Menu';
import styles from './QaPanel.module.css';

type Props = {
  /** The checks, already resolved (built-in ones translated). */
  items: QaItem[];
  /** The visible viewports, in order. */
  viewports: QaViewport[];
  results: QaResults;
  onResult: (itemId: string, viewportId: string, result: QaResult | undefined) => void;
  /** The whole new list after an add, edit or delete (saved by the workspace). */
  onItems: (items: QaItem[]) => void;
  onResetResults: () => void;
  onRestoreDefaults: () => void;
  onCopy: () => void;
  /** Scrolls to a viewport's preview (its column header becomes a button). */
  onReveal?: (viewportId: string) => void;
  onClose: () => void;
};

const RESULT_ICONS: Record<QaResult, IconName> = { pass: 'check', fail: 'close', skip: 'minus' };

const RESULTS: readonly QaResult[] = ['pass', 'fail', 'skip'];

/** Where focus goes once the list has changed: a check's edit button, or the "Add a check" field. */
type PendingFocus = { waitFor?: string; target: string | null };

/**
 * The QA checklist: manual checks (rows) at every visible viewport (columns).
 * Each cell cycles Passed → Failed → Skipped → not checked; arrow keys move
 * between cells, and only one of them is in the tab order.
 */
export function QaPanel(props: Props) {
  const { t } = useI18n();
  const id = useId();
  const { items, viewports, results } = props;
  const [active, setActive] = useState<{ item: string; viewport: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newText, setNewText] = useState('');
  const tableRef = useRef<HTMLTableElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  // The check being edited, also outside React's state: Enter and the blur that follows save once.
  const editingRef = useRef<string | null>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);

  const summary = qaSummary(
    items,
    viewports.map((viewport) => viewport.id),
    results,
  );
  const full = items.length >= MAX_QA_ITEMS;
  const activeRow = Math.max(0, active ? items.findIndex((item) => item.id === active.item) : 0);
  const activeColumn = Math.max(0, active ? viewports.findIndex((viewport) => viewport.id === active.viewport) : 0);

  useEffect(() => {
    if (!editing) return;
    editRef.current?.focus();
    editRef.current?.select();
  }, [editing]);

  // Runs after every render: the list a change was waiting for may come back later from the workspace.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || (pending.waitFor && items.some((item) => item.id === pending.waitFor))) return;
    pendingFocus.current = null;
    const button = pending.target
      ? Array.from(tableRef.current?.querySelectorAll<HTMLButtonElement>('[data-qa-edit]') ?? []).find(
          (element) => element.dataset.qaEdit === pending.target,
        )
      : null;
    (button ?? addRef.current)?.focus();
  });

  const focusCell = (row: number, column: number) => {
    const item = items[row];
    const viewport = viewports[column];
    if (!item || !viewport) return;
    setActive({ item: item.id, viewport: viewport.id });
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-row="${row}"][data-column="${column}"]`)?.focus();
  };

  const onCellKey = (event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) => {
    const last = { row: items.length - 1, column: viewports.length - 1 };
    const target = (() => {
      switch (event.key) {
        case 'ArrowRight':
          return [row, Math.min(column + 1, last.column)];
        case 'ArrowLeft':
          return [row, Math.max(column - 1, 0)];
        case 'ArrowDown':
          return [Math.min(row + 1, last.row), column];
        case 'ArrowUp':
          return [Math.max(row - 1, 0), column];
        case 'Home':
          return [event.ctrlKey || event.metaKey ? 0 : row, 0];
        case 'End':
          return [event.ctrlKey || event.metaKey ? last.row : row, last.column];
        default:
          return null;
      }
    })();
    if (!target) return;
    event.preventDefault();
    focusCell(target[0]!, target[1]!);
  };

  const startEdit = (item: QaItem) => {
    editingRef.current = item.id;
    setDraft(item.text);
    setEditing(item.id);
  };

  /** Saves (or not) the check being edited; from the keyboard, focus goes back to its edit button. */
  const finishEdit = (save: boolean, refocus: boolean) => {
    const itemId = editingRef.current;
    if (!itemId) return;
    editingRef.current = null;
    setEditing(null);
    if (refocus) pendingFocus.current = { target: itemId };
    const item = items.find((entry) => entry.id === itemId);
    const text = normalizeQaText(draft);
    if (save && item && text && text !== item.text) props.onItems(editQaItem(items, itemId, text));
  };

  const onEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishEdit(true, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finishEdit(false, true);
    }
  };

  const remove = (index: number) => {
    const item = items[index];
    if (!item) return;
    const next = items[index + 1] ?? items[index - 1] ?? null;
    pendingFocus.current = { waitFor: item.id, target: next?.id ?? null };
    props.onItems(removeQaItem(items, item.id));
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!normalizeQaText(newText) || full) return;
    props.onItems(addQaItem(items, newText));
    setNewText('');
  };

  const progress = [
    t('qa.progress', { checked: summary.checked, total: summary.total }),
    ...(summary.failed ? [t('qa.progressFailed', { failed: summary.failed })] : []),
  ].join(' · ');

  return (
    <aside className={styles.panel} aria-labelledby={`${id}-title`} data-testid="qa-panel">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon name="checklist" size={16} />
        </span>
        <h2 id={`${id}-title`} className={styles.title}>
          {t('qa.title')}
        </h2>
        <IconButton
          icon="clipboard"
          size="sm"
          label={t('qa.copy')}
          onClick={props.onCopy}
          disabled={!items.length || !viewports.length}
        />
        <Menu
          label={t('qa.more')}
          align="end"
          minWidth={230}
          entries={[
            {
              id: 'qa-reset',
              label: t('qa.resetResults'),
              icon: 'reset',
              disabled: Object.keys(results).length === 0,
              onSelect: props.onResetResults,
            },
            { id: 'qa-restore', label: t('qa.restoreDefaults'), icon: 'reload', onSelect: props.onRestoreDefaults },
          ]}
          trigger={(triggerProps) => (
            <button
              type="button"
              {...triggerProps}
              className={styles.more}
              aria-label={t('qa.more')}
              data-tooltip={t('qa.more')}
            >
              <Icon name="more" size={15} />
            </button>
          )}
        />
        <IconButton icon="close" size="sm" label={t('qa.close')} shortcut="Q" onClick={props.onClose} />
      </header>

      <div className={styles.body}>
        {viewports.length === 0 ? (
          <div className={styles.empty} data-testid="qa-empty">
            <p>{t('qa.noViewports')}</p>
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <div className={styles.empty} data-testid="qa-empty">
                <p>{t('qa.noItems')}</p>
                <Button size="sm" variant="primary" icon="reload" onClick={props.onRestoreDefaults}>
                  {t('qa.restoreDefaults')}
                </Button>
              </div>
            ) : (
              <>
                <div className={styles.progress}>
                  <p className={styles.progressText} data-testid="qa-progress">
                    {t('qa.progress', { checked: summary.checked, total: summary.total })}
                    {summary.failed > 0 && (
                      <span className={styles.failed}>
                        {' · '}
                        {t('qa.progressFailed', { failed: summary.failed })}
                      </span>
                    )}
                  </p>
                  <div
                    className={styles.bar}
                    role="progressbar"
                    aria-label={t('qa.title')}
                    aria-valuemin={0}
                    aria-valuemax={summary.total}
                    aria-valuenow={summary.checked}
                    aria-valuetext={progress}
                  >
                    {RESULTS.map((result) => {
                      const count =
                        result === 'pass' ? summary.passed : result === 'fail' ? summary.failed : summary.skipped;
                      return count > 0 ? (
                        <span
                          key={result}
                          className={styles.segment}
                          data-result={result}
                          style={{ width: `${(count / summary.total) * 100}%` }}
                        />
                      ) : null;
                    })}
                  </div>
                </div>
                <p className={styles.hint}>{t('qa.hint')}</p>

                <div className={styles.tableWrap}>
                  <table ref={tableRef} className={styles.table}>
                    <caption className="visually-hidden">{t('qa.matrix')}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className={styles.corner}>
                          {t('qa.check')}
                        </th>
                        {viewports.map((viewport) => (
                          <th key={viewport.id} scope="col" className={styles.columnHead}>
                            {props.onReveal ? (
                              <button
                                type="button"
                                className={styles.reveal}
                                onClick={() => props.onReveal?.(viewport.id)}
                                data-tooltip={t('qa.show', { name: viewport.name })}
                              >
                                <ViewportName viewport={viewport} />
                              </button>
                            ) : (
                              <ViewportName viewport={viewport} />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, row) => {
                        const textId = `${id}-check-${row}`;
                        return (
                          <tr key={item.id} data-testid="qa-row">
                            <th scope="row" className={styles.rowHead}>
                              {editing === item.id ? (
                                <input
                                  ref={editRef}
                                  className={`field ${styles.editInput}`}
                                  value={draft}
                                  maxLength={MAX_QA_TEXT}
                                  aria-label={t('qa.editLabel')}
                                  onChange={(event) => setDraft(event.target.value)}
                                  onKeyDown={onEditKey}
                                  onBlur={() => finishEdit(true, false)}
                                />
                              ) : (
                                <>
                                  <span id={textId} className={styles.checkText}>
                                    {item.text}
                                  </span>
                                  <span className={styles.rowActions}>
                                    <IconButton
                                      icon="pencil"
                                      size="xs"
                                      label={t('qa.edit')}
                                      aria-describedby={textId}
                                      data-qa-edit={item.id}
                                      onClick={() => startEdit(item)}
                                    />
                                    <IconButton
                                      icon="trash"
                                      size="xs"
                                      tone="danger"
                                      label={t('qa.delete')}
                                      aria-describedby={textId}
                                      // An empty list means the built-in checks: the last one stays.
                                      disabled={items.length <= 1}
                                      onClick={() => remove(row)}
                                    />
                                  </span>
                                </>
                              )}
                            </th>
                            {viewports.map((viewport, column) => {
                              const result = results[item.id]?.[viewport.id];
                              return (
                                <td key={viewport.id} className={styles.cell}>
                                  <button
                                    type="button"
                                    className={styles.cellButton}
                                    data-result={result ?? 'none'}
                                    data-row={row}
                                    data-column={column}
                                    tabIndex={row === activeRow && column === activeColumn ? 0 : -1}
                                    aria-label={t('qa.cell', {
                                      viewport: viewport.name,
                                      check: item.text,
                                      state: t(result ? QA_RESULT_KEYS[result] : 'qa.state.none'),
                                    })}
                                    onFocus={() => {
                                      if (row !== activeRow || column !== activeColumn)
                                        setActive({ item: item.id, viewport: viewport.id });
                                    }}
                                    onClick={() => props.onResult(item.id, viewport.id, nextQaResult(result))}
                                    onKeyDown={(event) => onCellKey(event, row, column)}
                                  >
                                    {result && <Icon name={RESULT_ICONS[result]} size={16} strokeWidth={2.2} />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <form className={styles.add} onSubmit={add}>
              <input
                ref={addRef}
                className={`field ${styles.addInput}`}
                value={newText}
                maxLength={MAX_QA_TEXT}
                placeholder={t('qa.addPlaceholder')}
                aria-label={t('qa.addLabel')}
                disabled={full}
                onChange={(event) => setNewText(event.target.value)}
              />
              <Button type="submit" size="sm" icon="plus" disabled={full || !normalizeQaText(newText)}>
                {t('qa.add')}
              </Button>
            </form>
            {full && <p className={styles.note}>{t('qa.full', { max: MAX_QA_ITEMS })}</p>}
          </>
        )}
      </div>
    </aside>
  );
}

function ViewportName({ viewport }: { viewport: QaViewport }) {
  const sizeClass = sizeClassOf(viewport.width, viewport.height);
  return (
    <span className={styles.viewport} data-size-class={sizeClass}>
      <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={13} className={styles.viewportIcon} />
      <span className={styles.viewportName}>{viewport.name}</span>
      <span className={styles.viewportWidth}>{viewport.width}</span>
    </span>
  );
}
