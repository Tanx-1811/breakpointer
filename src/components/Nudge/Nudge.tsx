import { useId } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './Nudge.module.css';

type Props = {
  /** The store's name, e.g. "Chrome Web Store". */
  store: string;
  onRate: () => void;
  onLater: () => void;
  onNever: () => void;
};

/**
 * The one-time question whether the user would rate Breakpointer: a small card
 * in a corner that never takes focus or covers the previews' controls.
 */
export function Nudge({ store, onRate, onLater, onNever }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <aside className={styles.nudge} aria-labelledby={titleId} data-testid="rate-nudge">
      <span className={styles.icon} aria-hidden="true">
        <Icon name="heart" size={16} />
      </span>
      <div className={styles.text}>
        <p id={titleId} className={styles.title}>
          {t('nudge.title')}
        </p>
        <p className={styles.body}>{t('nudge.body', { store })}</p>
        <div className={styles.actions}>
          <Button size="sm" variant="primary" icon="star" onClick={onRate}>
            {t('nudge.rate')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onLater}>
            {t('nudge.later')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onNever}>
            {t('nudge.never')}
          </Button>
        </div>
      </div>
      <IconButton icon="close" size="sm" label={t('nudge.later')} onClick={onLater} className={styles.close} />
    </aside>
  );
}
