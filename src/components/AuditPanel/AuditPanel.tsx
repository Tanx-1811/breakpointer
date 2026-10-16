import { useId, useRef, type KeyboardEvent } from 'react';
import type { CheckKind, CheckReport, PageStats, TypeSample } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import {
  STAT_KEYS,
  STAT_METRICS,
  formatMegapixels,
  formatStat,
  groupIssues,
  imageDensityRatio,
  statValue,
  statWarning,
  typeRows,
  typeValue,
  type StatMetric,
} from '../../state/audit';
import { CHECK_HINT_KEYS, CHECK_KIND_KEYS, canHighlight, issueValue } from '../../state/checks';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import { Button, IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './AuditPanel.module.css';

export type AuditTab = 'issues' | 'performance' | 'type';

export const AUDIT_TABS: AuditTab[] = ['issues', 'performance', 'type'];

/** One preview in the audit. `undefined` values: not known yet. */
export type AuditRow = {
  id: string;
  name: string;
  width: number;
  height: number;
  /** null: not checked (no agent, or checks are off). */
  report: CheckReport | null;
  stats: PageStats | null | undefined;
  type: TypeSample[] | null | undefined;
};

type Props = {
  tab: AuditTab;
  onTab: (tab: AuditTab) => void;
  rows: AuditRow[];
  checksOn: boolean;
  /** Checks highlighted in each preview, by card. */
  highlights: Record<string, CheckKind | null>;
  /** Tools inside previews need the site's permission. */
  needsAccess: boolean;
  host: string | null;
  busy: boolean;
  /** Measuring the page stats or the type scale right now. */
  measuring: boolean;
  locale: string;
  onHighlight: (cardId: string, kind: CheckKind | null) => void;
  onReveal: (cardId: string) => void;
  onRefresh: () => void;
  onCopy: () => void;
  onTurnOnChecks: () => void;
  onAllowSite: () => void;
  onClose: () => void;
};

const TAB_KEYS = {
  issues: 'audit.tab.issues',
  performance: 'audit.tab.performance',
  type: 'audit.tab.type',
} as const;

const TAB_ICONS = { issues: 'alert', performance: 'clock', type: 'text' } as const;

/** Issues, page stats and the type scale of every preview, side by side. */
export function AuditPanel(props: Props) {
  const { t } = useI18n();
  const { tab } = props;
  const id = useId();
  const tabRefs = useRef<Partial<Record<AuditTab, HTMLButtonElement | null>>>({});

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const target =
      event.key === 'Home' ? 0 : event.key === 'End' ? AUDIT_TABS.length - 1 : delta ? index + delta : null;
    if (target === null) return;
    event.preventDefault();
    const next = AUDIT_TABS[(target + AUDIT_TABS.length) % AUDIT_TABS.length]!;
    props.onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside className={styles.panel} aria-labelledby={`${id}-title`} data-testid="audit">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon name="report" size={16} />
        </span>
        <h2 id={`${id}-title`} className={styles.title}>
          {t('audit.title')}
        </h2>
        {tab !== 'issues' && (
          <IconButton
            icon="reload"
            size="sm"
            label={t('audit.refresh')}
            onClick={props.onRefresh}
            disabled={props.measuring}
          />
        )}
        <IconButton icon="clipboard" size="sm" label={t('audit.copy')} onClick={props.onCopy} />
        <IconButton icon="close" size="sm" label={t('audit.close')} shortcut="E" onClick={props.onClose} />
      </header>

      <div className={styles.tabs} role="tablist" aria-label={t('audit.tabs')}>
        {AUDIT_TABS.map((item, index) => (
          <button
            key={item}
            ref={(element) => {
              tabRefs.current[item] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`${id}-panel`}
            tabIndex={tab === item ? 0 : -1}
            className={styles.tab}
            onClick={() => props.onTab(item)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            <Icon name={TAB_ICONS[item]} size={14} />
            {t(TAB_KEYS[item])}
          </button>
        ))}
      </div>

      <div
        className={styles.body}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
        tabIndex={0}
      >
        {props.needsAccess && props.host && (
          <div className={styles.access}>
            <Icon name="shield" size={15} />
            <span>{t('audit.accessNote')}</span>
            <Button size="sm" variant="primary" onClick={props.onAllowSite} disabled={props.busy}>
              {t('tools.allowSite', { host: props.host })}
            </Button>
          </div>
        )}
        {tab === 'issues' && <IssuesTab {...props} />}
        {tab === 'performance' && <PerformanceTab {...props} />}
        {tab === 'type' && <TypeTab {...props} />}
      </div>
    </aside>
  );
}

function ViewportName({ row }: { row: Pick<AuditRow, 'name' | 'width' | 'height'> }) {
  const sizeClass = sizeClassOf(row.width, row.height);
  return (
    <span className={styles.viewport} data-size-class={sizeClass}>
      <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={13} className={styles.viewportIcon} />
      <span className={styles.viewportName}>{row.name}</span>
      <span className={styles.viewportWidth}>{row.width}</span>
    </span>
  );
}

function IssuesTab(props: Props) {
  const { t } = useI18n();
  const { rows } = props;
  if (!props.checksOn)
    return (
      <div className={styles.empty}>
        <p>{t('audit.checksOff')}</p>
        <Button size="sm" variant="primary" icon="check" onClick={props.onTurnOnChecks}>
          {t('audit.turnOnChecks')}
        </Button>
      </div>
    );
  const checked = rows.filter((row) => row.report);
  const unchecked = rows.filter((row) => !row.report);
  const groups = groupIssues(checked.map((row) => ({ ...row, report: row.report })));
  if (checked.length === 0)
    return (
      <p className={styles.waiting} role="status">
        {t('audit.waiting')}
      </p>
    );
  return (
    <>
      <p className={styles.summary} data-testid="audit-summary" data-issues={groups.length}>
        <Icon name={groups.length ? 'alert' : 'check'} size={15} className={groups.length ? styles.warn : styles.ok} />
        {groups.length === 0
          ? checked.length === 1
            ? t('audit.summaryNoneOne')
            : t('audit.summaryNone', { count: checked.length })
          : groups.length === 1
            ? t('audit.summaryOneKind', { count: checked.length })
            : t('audit.summary', { kinds: groups.length, count: checked.length })}
      </p>
      {unchecked.length > 0 && (
        <p className={styles.muted}>{t('audit.notChecked', { names: unchecked.map((row) => row.name).join(', ') })}</p>
      )}
      <ul className={styles.groups}>
        {groups.map((group) => {
          const samples = group.hits.find((hit) => hit.issue.samples.length)?.issue.samples ?? [];
          return (
            <li key={group.kind} className={styles.group} data-testid="audit-group" data-kind={group.kind}>
              <div className={styles.groupHead}>
                <Icon name="alert" size={14} className={styles.warn} />
                <strong className={styles.groupTitle}>{t(CHECK_KIND_KEYS[group.kind])}</strong>
                <span className={styles.groupCount}>
                  {t('audit.inPreviews', { count: group.hits.length, total: checked.length })}
                </span>
              </div>
              <p className={styles.groupHint}>{t(CHECK_HINT_KEYS[group.kind])}</p>
              <ul className={styles.hits}>
                {group.hits.map(({ column, issue }) => {
                  const active = props.highlights[column.id] === group.kind;
                  return (
                    <li key={column.id} className={styles.hit}>
                      <button
                        type="button"
                        className={styles.hitName}
                        onClick={() => props.onReveal(column.id)}
                        data-tooltip={t('audit.show', { name: column.name })}
                      >
                        <ViewportName row={column} />
                      </button>
                      <span className={styles.hitDetail}>{issueValue(issue, t)}</span>
                      {canHighlight(group.kind) && (
                        <button
                          type="button"
                          className={styles.highlight}
                          aria-pressed={active}
                          aria-label={
                            active
                              ? t('audit.hideIn', { name: column.name })
                              : t('audit.highlightIn', { name: column.name })
                          }
                          onClick={() => props.onHighlight(column.id, active ? null : group.kind)}
                        >
                          {active ? t('checks.hideHighlight') : t('checks.highlight')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {samples.length > 0 && (
                <ul className={styles.samples}>
                  {samples.slice(0, 3).map((sample, index) => (
                    <li key={`${sample.selector}-${index}`}>
                      <code>{sample.selector}</code>
                      {sample.detail && <span>{sample.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>{t('checks.privacy')}</p>
    </>
  );
}

function PerformanceTab(props: Props) {
  const { t } = useI18n();
  const measured = props.rows.filter((row): row is AuditRow & { stats: PageStats } => Boolean(row.stats));
  if (measured.length === 0)
    return (
      <p className={styles.waiting} role="status">
        {props.measuring || props.rows.some((row) => row.stats === undefined) ? t('audit.measuring') : t('audit.waiting')}
      </p>
    );
  return (
    <>
      {STAT_METRICS.map((metric) => (
        <Metric key={metric} metric={metric} rows={measured} locale={props.locale} />
      ))}
      <p className={styles.note}>{t('audit.statsNote')}</p>
    </>
  );
}

function Metric({
  metric,
  rows,
  locale,
}: {
  metric: StatMetric;
  rows: (AuditRow & { stats: PageStats })[];
  locale: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const values = rows.map((row) => statValue(row.stats, metric));
  const max = Math.max(0, ...values.map((value) => value ?? 0));
  const keys = STAT_KEYS[metric];
  return (
    <section className={styles.metric} aria-labelledby={id} data-testid="audit-metric" data-metric={metric}>
      <h3 id={id} className={styles.metricTitle}>
        {t(keys.label)}
      </h3>
      <p className={styles.metricHint}>{t(keys.hint)}</p>
      <ul className={styles.bars}>
        {rows.map((row, index) => {
          const value = values[index] ?? null;
          const warning = statWarning(row.stats, metric);
          const share = value !== null && max > 0 ? value / max : 0;
          const density = metric === 'imagePixels' ? imageDensityRatio(row.stats) : null;
          return (
            <li key={row.id} className={styles.barRow}>
              <ViewportName row={row} />
              <span className={styles.track} aria-hidden="true">
                {share > 0 && <span className={styles.fill} style={{ width: `${Math.max(2, share * 100)}%` }} />}
              </span>
              <span className={styles.value} data-warning={warning || undefined}>
                {warning && <Icon name="alert" size={12} />}
                {formatStat(metric, row.stats, locale)}
                {warning && <span className="visually-hidden"> · {t('audit.needsImprovement')}</span>}
              </span>
              {metric === 'transferred' && row.stats.unknownSize > 0 && (
                <span className={styles.barNote}>{t('audit.unknownFiles', { count: row.stats.unknownSize })}</span>
              )}
              {density !== null && (
                <span className={styles.barNote}>
                  {t('audit.imageShown', {
                    shown: formatMegapixels(row.stats.shownPixels, locale),
                    ratio: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(density),
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TypeTab(props: Props) {
  const { t } = useI18n();
  const columns = props.rows.map((row) => ({ ...row, samples: row.type ?? null }));
  const list = typeRows(columns);
  if (list.length === 0)
    return (
      <p className={styles.waiting} role="status">
        {props.measuring || props.rows.some((row) => row.type === undefined) ? t('audit.measuring') : t('audit.typeEmpty')}
      </p>
    );
  return (
    <>
      <p className={styles.muted}>{t('audit.typeNote')}</p>
      <ul className={styles.groups}>
        {list.map((row) => (
          <li
            key={row.tag}
            className={styles.group}
            data-changed={row.changes || undefined}
            data-testid="audit-type"
            data-tag={row.tag}
          >
            <div className={styles.groupHead}>
              <code className={styles.tag}>{row.tag}</code>
              {row.changes && (
                <span className={styles.changes}>
                  <span className={styles.changesDot} aria-hidden="true" />
                  {t('audit.typeChanges')}
                </span>
              )}
            </div>
            <dl className={styles.typeList}>
              {columns.map((column, index) => {
                const sample = row.samples[index];
                return (
                  <div key={column.id} className={styles.typeItem}>
                    <dt>
                      <ViewportName row={column} />
                    </dt>
                    <dd>
                      {sample ? (
                        <>
                          <span className={styles.typeValue}>{typeValue(sample)}</span>
                          <span className={styles.typeMeta}>
                            {sample.fontFamily} · {t('audit.shownCount', { count: sample.count })}
                          </span>
                        </>
                      ) : (
                        <span className={styles.typeMeta}>—</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
