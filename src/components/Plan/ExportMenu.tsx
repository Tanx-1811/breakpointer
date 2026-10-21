import { useI18n } from '../../i18n/I18nProvider';
import type { ExportFormat } from '../../state/export';
import { Icon } from '../Icon/Icon';
import { Menu } from '../Menu/Menu';
import { usePlan } from './PlanContext';
import styles from './ExportMenu.module.css';

type Props = {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  /** An icon button (in a panel header) instead of a labelled one. */
  compact?: boolean;
  testId?: string;
};

/** "Export ▾": CSV and JSON (Breakpointer Pro, marked on the free plan). */
export function ExportMenu({ onExport, disabled, compact, testId }: Props) {
  const { t } = useI18n();
  const { pro } = usePlan();
  const badge = pro ? undefined : t('pro.badge');
  return (
    <Menu
      label={t('export.menu')}
      align="end"
      minWidth={230}
      entries={[
        { id: 'export-csv', label: t('export.csv'), icon: 'download', badge, onSelect: () => onExport('csv') },
        { id: 'export-json', label: t('export.json'), icon: 'code', badge, onSelect: () => onExport('json') },
      ]}
      trigger={(triggerProps) => (
        <button
          type="button"
          {...triggerProps}
          className={compact ? styles.compact : styles.button}
          aria-label={compact ? t('export.menu') : undefined}
          data-tooltip={compact ? t('export.menu') : undefined}
          disabled={disabled}
          data-testid={testId}
        >
          <Icon name="download" size={compact ? 15 : 16} />
          {!compact && <span>{t('export.menu')}</span>}
          <Icon name="chevronDown" size={12} />
        </button>
      )}
    />
  );
}
