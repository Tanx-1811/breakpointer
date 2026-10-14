import type { CheckKind, CheckReport } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import { CHECK_KIND_KEYS, canHighlight, issueDetail } from '../../state/checks';
import { Icon } from '../Icon/Icon';
import { Popover } from '../Popover/Popover';
import styles from './ChecksBadge.module.css';

type Props = {
  report: CheckReport;
  highlighted: CheckKind | null;
  onHighlight: (kind: CheckKind | null) => void;
};

/** "✓" or "⚠ n" on a card, opening the list of responsive issues found in its preview. */
export function ChecksBadge({ report, highlighted, onHighlight }: Props) {
  const { t } = useI18n();
  const count = report.issues.length;
  const label =
    count === 0 ? t('checks.badgeOk') : count === 1 ? t('checks.badgeIssue') : t('checks.badgeIssues', { count });

  return (
    <Popover
      label={t('checks.title', { width: report.width })}
      width={360}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={`${styles.badge} ${count ? styles.warn : styles.ok}`}
          aria-label={label}
          data-tooltip={label}
          data-testid="checks-badge"
        >
          <Icon name={count ? 'alert' : 'check'} size={12} />
          {count > 0 && <span>{count}</span>}
        </button>
      )}
    >
      <div className={styles.panel}>
        <h3 className={styles.title}>
          <Icon name={count ? 'alert' : 'check'} size={15} className={count ? styles.titleWarn : styles.titleOk} />
          {t('checks.title', { width: report.width })}
        </h3>
        {count === 0 ? (
          <p className={styles.ok}>
            <Icon name="check" size={14} /> {t('checks.ok')}
          </p>
        ) : (
          <ul className={styles.list}>
            {report.issues.map((issue) => {
              const active = highlighted === issue.kind;
              return (
                <li key={issue.kind} className={styles.issue}>
                  <div className={styles.issueHead}>
                    <Icon name="alert" size={14} className={styles.issueIcon} />
                    <div className={styles.issueText}>
                      <strong>{t(CHECK_KIND_KEYS[issue.kind])}</strong>
                      <span className={styles.detail}>{issueDetail(issue, t)}</span>
                    </div>
                    {canHighlight(issue.kind) && (
                      <button
                        type="button"
                        className={styles.highlight}
                        aria-pressed={active}
                        onClick={() => onHighlight(active ? null : issue.kind)}
                      >
                        {active ? t('checks.hideHighlight') : t('checks.highlight')}
                      </button>
                    )}
                  </div>
                  {issue.samples.length > 0 && (
                    <ul className={styles.samples}>
                      {issue.samples.slice(0, 5).map((sample, index) => (
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
        )}
        <p className={styles.note}>{t('checks.privacy')}</p>
      </div>
    </Popover>
  );
}
