import { useI18n } from '../../i18n/I18nProvider';
import { Button, IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './EmbedNotice.module.css';

type Props = {
  host: string;
  onAllow: () => void;
  /** Allows the site until Chrome closes (the button shows when given). */
  onAllowSession?: () => void;
  onOpenInTab: () => void;
  /** Opens every viewport as a real window (works for any site). */
  onOpenWindows?: () => void;
  onDismiss: () => void;
  onNeverShow: () => void;
  /** A permission prompt is open. */
  busy?: boolean;
};

/**
 * Shown while the current site hasn't been allowed. Chrome doesn't tell the
 * embedding page when a frame was blocked, so this explains the likely cause
 * and offers both fixes up front.
 */
export function EmbedNotice({
  host,
  onAllow,
  onAllowSession,
  onOpenInTab,
  onOpenWindows,
  onDismiss,
  onNeverShow,
  busy,
}: Props) {
  const { t } = useI18n();
  return (
    <div className={styles.notice} role="note" data-testid="embed-notice">
      <Icon name="shield" size={16} className={styles.icon} />
      <p className={styles.text}>{t('access.notice', { host })}</p>
      <div className={styles.actions}>
        <Button size="sm" variant="primary" onClick={onAllow} disabled={busy}>
          {t('access.noticeAllow', { host })}
        </Button>
        {onAllowSession && (
          <Button
            size="sm"
            icon="clock"
            onClick={onAllowSession}
            disabled={busy}
            tooltip={t('access.allowSessionHint')}
            data-testid="allow-session"
          >
            {t('access.allowSession')}
          </Button>
        )}
        <Button size="sm" icon="external" onClick={onOpenInTab}>
          {t('access.noticeOpen')}
        </Button>
        {onOpenWindows && (
          <Button size="sm" icon="window" onClick={onOpenWindows}>
            {t('windows.open')}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onNeverShow}>
          {t('access.noticeNever')}
        </Button>
        <IconButton icon="close" size="sm" label={t('common.dismiss')} onClick={onDismiss} />
      </div>
    </div>
  );
}
