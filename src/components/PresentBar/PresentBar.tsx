import { useI18n } from '../../i18n/I18nProvider';
import type { WorkspaceLayout } from '../../types';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import styles from './PresentBar.module.css';

type Props = {
  /** The page shown ("brightside.example"), if any. */
  host: string | null;
  layout: WorkspaceLayout;
  onLayout: (layout: WorkspaceLayout) => void;
  onFit: () => void;
  onExit: () => void;
  /** Every preview scrolling from top to bottom by itself (the button shows with its handler). */
  autoScrolling?: boolean;
  onAutoScroll?: () => void;
};

/**
 * The one control left in present mode: what is shown, the layout, Fit and
 * the way out. It fades while the pointer is elsewhere (see the CSS).
 */
export function PresentBar({ host, layout, onLayout, onFit, onExit, autoScrolling, onAutoScroll }: Props) {
  const { t } = useI18n();
  return (
    <div className={styles.bar} role="group" aria-label={t('present.label')} data-testid="present-bar">
      <span className={styles.status}>
        <Icon name="present" size={15} className={styles.icon} />
        <span className={styles.text}>{host ? t('present.showing', { host }) : t('present.label')}</span>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <Segmented
        label={t('workspace.layout')}
        size="sm"
        iconOnly
        value={layout}
        onChange={onLayout}
        options={[
          { value: 'wrap', label: t('layout.wrap'), icon: 'wrap' },
          { value: 'row', label: t('layout.row'), icon: 'row' },
          { value: 'stack', label: t('layout.stack'), icon: 'stack' },
        ]}
      />
      <Button size="sm" variant="ghost" icon="fit" onClick={onFit} shortcut="F">
        {t('workspace.fit')}
      </Button>
      {onAutoScroll && (
        <Button
          size="sm"
          variant="ghost"
          icon={autoScrolling ? 'pause' : 'chevronDown'}
          aria-pressed={Boolean(autoScrolling)}
          tooltip={t('autoScroll.hint')}
          onClick={onAutoScroll}
          data-testid="present-autoscroll"
        >
          {autoScrolling ? t('autoScroll.stop') : t('autoScroll.start')}
        </Button>
      )}
      <span className={styles.divider} aria-hidden="true" />
      <Button size="sm" variant="primary" icon="close" onClick={onExit} shortcut="Esc" data-testid="present-exit">
        {t('present.exit')}
      </Button>
    </div>
  );
}
