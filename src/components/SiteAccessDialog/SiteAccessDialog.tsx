import { useI18n } from '../../i18n/I18nProvider';
import { displayHost } from '../../utils/url';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import styles from './SiteAccessDialog.module.css';

type Props = {
  open: boolean;
  url: URL | null;
  siteAllowed: boolean | null;
  allSites: boolean;
  granted: string[];
  onAllowSite: () => void;
  onAllowAll: () => void;
  /** A permission prompt is open. */
  busy?: boolean;
  onRevoke: (patterns: string[]) => void;
  onClose: () => void;
};

function describePattern(pattern: string): string {
  if (pattern === '<all_urls>') return '*';
  return pattern
    .replace(/^\*:\/\//, '')
    .replace(/^\*\./, '')
    .replace(/\/\*$/, '');
}

export function SiteAccessDialog(props: Props) {
  const { open, url, siteAllowed, allSites, granted, onAllowSite, onAllowAll, onRevoke, onClose } = props;
  const { t } = useI18n();
  const host = url ? displayHost(url) : null;
  const sitePatterns = granted.filter((pattern) => pattern !== '<all_urls>');

  return (
    <Dialog open={open} title={t('access.title')} description={t('access.description')} onClose={onClose} width={560}>
      <p className={styles.privacy}>
        <Icon name="shieldCheck" size={16} />
        {t('access.privacy')}
      </p>

      <section className={styles.section} aria-labelledby="access-current">
        <h3 id="access-current" className={styles.heading}>
          {t('access.currentSite')}
        </h3>
        {host ? (
          <div className={styles.row}>
            <div className={styles.site}>
              <span className={styles.host}>{host}</span>
              <span className={siteAllowed ? styles.allowed : styles.notAllowed}>
                {allSites ? t('access.allowedAll') : siteAllowed ? t('access.allowed') : t('access.notAllowed')}
              </span>
            </div>
            {!siteAllowed && (
              <Button variant="primary" size="sm" onClick={onAllowSite} disabled={props.busy}>
                {t('access.allowSite', { host })}
              </Button>
            )}
          </div>
        ) : (
          <p className={styles.muted}>{t('access.noUrl')}</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="access-all">
        <h3 id="access-all" className={styles.heading}>
          {t('access.allSites')}
        </h3>
        <div className={styles.row}>
          <p className={styles.muted}>{t('access.allSitesHelp')}</p>
          {allSites ? (
            <Button variant="danger" size="sm" onClick={() => onRevoke(['<all_urls>'])}>
              {t('access.revokeAll')}
            </Button>
          ) : (
            <Button size="sm" onClick={onAllowAll} disabled={props.busy}>
              {t('access.allowAll')}
            </Button>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="access-list">
        <h3 id="access-list" className={styles.heading}>
          {t('access.list')}
        </h3>
        {sitePatterns.length === 0 ? (
          <p className={styles.muted}>{t('access.none')}</p>
        ) : (
          <ul className={styles.list}>
            {sitePatterns.map((pattern) => (
              <li key={pattern} className={styles.item}>
                <Icon name="globe" size={14} />
                <span className={styles.pattern} title={pattern}>
                  {describePattern(pattern)}
                </span>
                <IconButton
                  icon="close"
                  size="sm"
                  tone="danger"
                  label={t('access.revoke', { pattern: describePattern(pattern) })}
                  onClick={() => onRevoke([pattern])}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  );
}
