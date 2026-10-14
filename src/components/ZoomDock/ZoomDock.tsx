import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { WorkspaceLayout } from '../../types';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_OPTIONS } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import { Select } from '../Select/Select';
import { formatZoom } from '../../utils/format';
import styles from './ZoomDock.module.css';

type Props = {
  /** The zoom every visible viewport shares; null when they differ. */
  zoom: number | null;
  /** Nothing to zoom (no visible viewport). */
  disabled: boolean;
  onZoom: (zoom: number) => void;
  onStep: (direction: 1 | -1) => void;
  onFit: () => void;
  layout: WorkspaceLayout;
  onLayout: (layout: WorkspaceLayout) => void;
  /** In focus mode the dock zooms the focused viewport only. */
  focused: boolean;
  /** A mode that is on (focus, inspecting), shown at the start of the dock. */
  status?: ReactNode;
};

/** Floating controls at the bottom of the workspace: zoom, fit and layout. */
export function ZoomDock({ zoom, disabled, onZoom, onStep, onFit, layout, onLayout, focused, status }: Props) {
  const { t } = useI18n();
  const options =
    zoom === null || ZOOM_OPTIONS.includes(zoom) ? ZOOM_OPTIONS : [...ZOOM_OPTIONS, zoom].sort((a, b) => a - b);
  const mixed = !disabled && zoom === null;

  return (
    <div className={styles.dock} role="group" aria-label={t('dock.label')} data-testid="zoom-dock">
      {status && (
        <>
          {status}
          <span className={styles.divider} aria-hidden="true" />
        </>
      )}
      <IconButton
        icon="minus"
        size="sm"
        label={t('dock.zoomOut')}
        shortcut="−"
        onClick={() => onStep(-1)}
        disabled={disabled || (zoom !== null && zoom <= MIN_ZOOM)}
      />
      <Select
        size="sm"
        mono={!mixed}
        className={styles.zoom}
        aria-label={t('workspace.zoom')}
        data-tooltip={focused ? t('dock.zoomFocused') : t('dock.zoomHint')}
        value={disabled ? 'none' : (zoom ?? 'mixed')}
        onChange={(event) => onZoom(Number(event.target.value))}
        disabled={disabled}
      >
        {disabled && (
          <option value="none" disabled>
            —
          </option>
        )}
        {mixed && (
          <option value="mixed" disabled>
            {t('workspace.zoomMixed')}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option}>
            {formatZoom(option)}
          </option>
        ))}
      </Select>
      <IconButton
        icon="plus"
        size="sm"
        label={t('dock.zoomIn')}
        shortcut="+"
        onClick={() => onStep(1)}
        disabled={disabled || (zoom !== null && zoom >= MAX_ZOOM)}
      />
      <span className={styles.divider} aria-hidden="true" />
      <Button
        size="sm"
        variant="ghost"
        icon="fit"
        onClick={onFit}
        tooltip={t('workspace.fitHint')}
        shortcut="F"
        disabled={disabled}
      >
        {t('workspace.fit')}
      </Button>
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
        ]}
      />
    </div>
  );
}

/** What the workspace is doing (e.g. "Focused on Phone"), with a button to stop. Esc stops it too. */
export function DockStatus({
  icon,
  children,
  action,
  onAction,
  testId,
}: {
  icon: IconName;
  children: ReactNode;
  action: string;
  onAction: () => void;
  testId?: string;
}) {
  return (
    <span className={styles.status} role="status" data-testid={testId}>
      <Icon name={icon} size={15} className={styles.statusIcon} />
      <span className={styles.statusText}>{children}</span>
      <Button size="sm" variant="subtle" shortcut="Esc" tooltip={action} onClick={onAction}>
        {action}
      </Button>
    </span>
  );
}
