import { useId, useState } from 'react';
import type { MediaQueryReport } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import {
  PROBLEM_KEYS,
  mediaBreakpoints,
  mediaProblems,
  mergeMediaRows,
  problemWidths,
  unreadableSheets,
  type BreakpointProblem,
} from '../../state/media-queries';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import { ViewportName } from './ViewportName';
import styles from './MediaTab.module.css';

type Row = { id: string; name: string; width: number; height: number; media?: MediaQueryReport | null | undefined };

type Props = {
  rows: Row[];
  measuring: boolean;
  /** Adds a viewport of this width; the button shows when given. */
  onAddViewport?: (width: number) => void;
};

type Filter = 'widths' | 'all';

/**
 * The page's own media queries and the previews where each applies, with the
 * max-width and min-width pairs that leave a gap or overlap at a breakpoint.
 */
export function MediaTab({ rows, measuring, onAddViewport }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [filter, setFilter] = useState<Filter>('widths');
  const answered = rows.filter((row) => row.media);
  if (answered.length === 0)
    return (
      <p className={styles.waiting} role="status">
        {measuring || rows.some((row) => row.media === undefined) ? t('audit.measuring') : t('media.noAgent')}
      </p>
    );

  const queries = mergeMediaRows(rows.map((row) => ({ id: row.id, report: row.media })));
  const unreadable = unreadableSheets(rows.map((row) => row.media));
  const unreadableNote =
    unreadable === 0 ? null : (
      <p className={styles.note} data-testid="media-unreadable">
        {unreadable === 1 ? t('media.unreadableOne') : t('media.unreadable', { count: unreadable })}
      </p>
    );
  if (queries.length === 0)
    return (
      <>
        <p className={styles.waiting} role="status">
          {t('media.empty')}
        </p>
        {unreadableNote}
      </>
    );

  const breakpoints = mediaBreakpoints(queries).length;
  const problems = mediaProblems(queries);
  const shown = filter === 'widths' ? queries.filter((query) => query.ranges !== null) : queries;
  const containers = shown.some((query) => query.kind === 'container');

  return (
    <div className={styles.tab} data-testid="media-tab">
      <p className={styles.summary} data-testid="media-summary" data-problems={problems.length}>
        <Icon
          name={problems.length ? 'alert' : 'check'}
          size={15}
          className={problems.length ? styles.warn : styles.ok}
        />
        <span>
          {[
            queries.length === 1 ? t('media.summaryQueriesOne') : t('media.summaryQueries', { count: queries.length }),
            breakpoints === 1
              ? t('media.summaryBreakpointsOne')
              : t('media.summaryBreakpoints', { count: breakpoints }),
            problems.length === 0
              ? t('media.summaryNoProblems')
              : problems.length === 1
                ? t('media.summaryProblemsOne')
                : t('media.summaryProblems', { count: problems.length }),
          ].join(' · ')}
        </span>
      </p>

      {problems.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-problems`}>
          <h3 id={`${id}-problems`} className={styles.heading}>
            {t('media.problems')}
          </h3>
          <ul className={styles.problems}>
            {problems.map((problem) => (
              <Problem
                key={`${problem.type}-${problem.from}-${problem.to}`}
                problem={problem}
                // No button when a preview already shows one of those widths.
                onAddViewport={
                  rows.some((row) => row.width >= problem.from && row.width <= problem.to) ? undefined : onAddViewport
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section} aria-labelledby={`${id}-queries`}>
        <div className={styles.tableHead}>
          <h3 id={`${id}-queries`} className={styles.heading}>
            {t('audit.tab.media')}
          </h3>
          <Segmented
            size="sm"
            label={t('media.filter')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'widths', label: t('media.filterWidths') },
              { value: 'all', label: t('media.filterAll') },
            ]}
          />
        </div>
        {shown.length === 0 ? (
          <p className={styles.note}>{t('media.noWidths')}</p>
        ) : (
          <div className={styles.tableWrap} role="region" aria-labelledby={`${id}-caption`} tabIndex={0}>
            <table className={styles.table} data-testid="media-table">
              <caption id={`${id}-caption`} className="visually-hidden">
                {t('media.table')}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.queryHead}>
                    {t('media.colQuery')}
                  </th>
                  <th scope="col" className={styles.rulesHead}>
                    {t('media.colRules')}
                  </th>
                  {rows.map((row) => (
                    <th
                      key={row.id}
                      scope="col"
                      className={styles.previewHead}
                      data-tooltip={`${row.name} · ${row.width} × ${row.height}`}
                    >
                      <ViewportName row={row} compact />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((query) => (
                  <tr key={`${query.kind} ${query.text}`} data-testid="media-row" data-kind={query.kind}>
                    <th scope="row" className={styles.query}>
                      <code>
                        {query.kind === 'container' && <span className={styles.atRule}>@container </span>}
                        {query.text}
                      </code>
                    </th>
                    <td className={styles.rules}>{query.rules}</td>
                    {rows.map((row) => (
                      <Match key={row.id} name={row.name} value={query.matches[row.id]} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {unreadableNote}
      {containers && <p className={styles.note}>{t('media.containerNote')}</p>}
      <p className={styles.note}>{t('media.note')}</p>
    </div>
  );
}

/** A gap or an overlap: where, between which queries, and a viewport to see it. */
function Problem({ problem, onAddViewport }: { problem: BreakpointProblem; onAddViewport?: (width: number) => void }) {
  const { t } = useI18n();
  const keys = PROBLEM_KEYS[problem.type];
  return (
    <li className={styles.problem} data-testid="media-problem" data-type={problem.type}>
      <Icon name="alert" size={14} className={styles.warn} />
      <span className={styles.problemText}>
        <strong className={styles.problemTitle}>{t(keys.title, { widths: problemWidths(problem, t) })}</strong>
        <span className={styles.problemHint}>{t(keys.hint)}</span>
        <span className={styles.pair}>
          <code>{problem.below}</code>
          <code>{problem.above}</code>
        </span>
        {onAddViewport && (
          <span>
            <Button size="sm" variant="ghost" icon="plus" onClick={() => onAddViewport(problem.from)}>
              {t('media.addViewport', { width: problem.from })}
            </Button>
          </span>
        )}
      </span>
    </li>
  );
}

/** Whether a query applies in one preview: ✓, a muted dash, or — when it depends on a container (or wasn't measured). */
function Match({ name, value }: { name: string; value: boolean | null | undefined }) {
  const { t } = useI18n();
  if (value === true)
    return (
      <td className={styles.match} data-match="yes">
        <Icon name="check" size={14} />
        <span className="visually-hidden">{t('media.applies', { name })}</span>
      </td>
    );
  if (value === false)
    return (
      <td className={styles.match} data-match="no">
        <span aria-hidden="true">–</span>
        <span className="visually-hidden">{t('media.notApplies', { name })}</span>
      </td>
    );
  const label = value === null ? t('media.containerCell') : t('media.notMeasured');
  return (
    <td className={styles.match} data-match={value === null ? 'container' : 'unknown'} data-tooltip={label}>
      <span aria-hidden="true">—</span>
      <span className="visually-hidden">{label}</span>
    </td>
  );
}
