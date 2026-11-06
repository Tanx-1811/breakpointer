import { useId } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import {
  CELL_MARKS,
  STATE_KEYS,
  answeredColumns,
  summaryText,
  visibilityRows,
  type CellState,
  type VisibilityReport,
} from '../../state/visibility';
import { IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { ViewportName } from './ViewportName';
import styles from './VisibilityTab.module.css';

type Row = {
  id: string;
  name: string;
  width: number;
  height: number;
  visibility?: VisibilityReport | null | undefined;
};

type Props = {
  rows: Row[];
  measuring: boolean;
  /** Compares the element at every size in the inspector; the button shows when given. */
  onInspect?: (selector: string) => void;
};

/**
 * What each size shows and hides: one row per element shown in some previews
 * and hidden in others, one column per preview (narrowest first).
 */
export function VisibilityTab({ rows, measuring, onInspect }: Props) {
  const { t } = useI18n();
  const id = useId();
  const columns = answeredColumns(rows);
  if (columns.length === 0)
    return (
      <p className={styles.waiting} role="status">
        {measuring || rows.some((row) => row.visibility === undefined) ? t('audit.measuring') : t('visibility.noAgent')}
      </p>
    );

  // Previews without an agent (no site access) or that didn't answer are left out.
  const notRead = rows.filter((row) => row.visibility === null || (row.visibility === undefined && !measuring));
  const notReadNote =
    notRead.length > 0 ? (
      <p className={styles.note} data-testid="visibility-not-read">
        {t('visibility.notRead', { names: notRead.map((row) => row.name).join(', ') })}
      </p>
    ) : null;
  if (columns.length === 1)
    return (
      <div className={styles.tab} data-testid="visibility-tab">
        <p className={styles.waiting} role="status">
          {t('visibility.needTwo')}
        </p>
        {notReadNote}
      </div>
    );

  const list = visibilityRows(columns);
  const unknown = list.some((row) => columns.some((column) => (row.states[column.id] ?? 'unknown') === 'unknown'));
  const missing = list.some((row) => columns.some((column) => row.states[column.id] === 'missing'));

  return (
    <div className={styles.tab} data-testid="visibility-tab">
      <p className={styles.summary} data-testid="visibility-summary" data-count={list.length}>
        <Icon name={list.length ? 'eye' : 'check'} size={15} className={list.length ? styles.lead : styles.ok} />
        <span>
          {list.length === 0
            ? t('visibility.empty')
            : list.length === 1
              ? t('visibility.summaryOne')
              : t('visibility.summary', { count: list.length })}
        </span>
      </p>
      {notReadNote}

      {list.length > 0 && (
        <>
          <ul className={styles.legend} aria-label={t('visibility.legend')}>
            <li>
              <Mark state="shown" />
              {t(STATE_KEYS.shown)}
            </li>
            <li>
              <Mark state="hidden" />
              {t(STATE_KEYS.hidden)}
            </li>
            {missing && (
              <li>
                <Mark state="missing" />
                {t(STATE_KEYS.missing)}
              </li>
            )}
            {unknown && (
              <li>
                <Mark state="unknown" />
                {t(STATE_KEYS.unknown)}
              </li>
            )}
          </ul>
          <div className={styles.tableWrap} role="region" aria-labelledby={`${id}-caption`} tabIndex={0}>
            <table className={styles.table} data-testid="visibility-table">
              <caption id={`${id}-caption`} className="visually-hidden">
                {t('visibility.table')}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.elementHead}>
                    {t('visibility.colElement')}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className={styles.previewHead}
                      data-tooltip={`${column.name} · ${column.width} × ${column.height}`}
                    >
                      <ViewportName row={column} compact />
                    </th>
                  ))}
                  {onInspect && (
                    <th scope="col" className={styles.actionHead}>
                      <span className="visually-hidden">{t('visibility.colActions')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.selector} data-testid="visibility-row" data-label={row.label}>
                    <th scope="row" className={styles.element}>
                      <code title={row.selector}>{row.label}</code>
                      <span className={styles.when} data-testid="visibility-when">
                        {summaryText(row.summary, t)}
                      </span>
                    </th>
                    {columns.map((column) => (
                      <Cell key={column.id} name={column.name} state={row.states[column.id] ?? 'unknown'} />
                    ))}
                    {onInspect && (
                      <td className={styles.action}>
                        <IconButton
                          icon="inspect"
                          size="xs"
                          label={t('visibility.inspect', { element: row.label })}
                          onClick={() => onInspect(row.selector)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className={styles.note}>{t('visibility.note')}</p>
    </div>
  );
}

/** A state drawn as a mark: a check where it's shown, a dash where it's hidden, ∅ or ? otherwise. */
function Mark({ state }: { state: CellState }) {
  if (state === 'shown') return <Icon name="check" size={14} className={styles.mark} data-state={state} />;
  if (state === 'hidden') return <Icon name="minus" size={14} className={styles.mark} data-state={state} />;
  return (
    <span className={styles.mark} data-state={state} aria-hidden="true">
      {CELL_MARKS[state]}
    </span>
  );
}

/** One preview's state of an element: a mark, and in words for assistive technology. */
function Cell({ name, state }: { name: string; state: CellState }) {
  const { t } = useI18n();
  const label = t('visibility.cell', { name, state: t(STATE_KEYS[state]) });
  return (
    <td
      className={styles.cell}
      data-state={state}
      data-testid="visibility-cell"
      data-tooltip={state === 'missing' || state === 'unknown' ? label : undefined}
    >
      <Mark state={state} />
      <span className="visually-hidden">{label}</span>
    </td>
  );
}
