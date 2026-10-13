import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import styles from './CaptureDialog.module.css';

type Props = {
  open: boolean;
  onAllow: () => void;
  /** A permission prompt is open. */
  busy?: boolean;
  onClose: () => void;
};

/** Explains why screenshots need "all sites" access before Chrome's own prompt appears. */
export function CaptureDialog({ open, onAllow, onClose, busy }: Props) {
  const { t } = useI18n();
  return (
    <Dialog open={open} title={t('capture.title')} onClose={onClose} width={480}>
      <p className={styles.body}>{t('capture.description')}</p>
      <p className={styles.privacy}>{t('access.privacy')}</p>
      <div className={styles.footer}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" icon="camera" onClick={onAllow} disabled={busy}>
          {t('capture.allow')}
        </Button>
      </div>
    </Dialog>
  );
}
