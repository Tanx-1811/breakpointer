import { useState, type DragEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { BreakpointSetId, ViewportConfig, WorkspaceLayout } from '../../types';
import { MAX_VIEWPORTS, ZOOM_OPTIONS } from '../../utils/constants';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import { formatZoom } from '../ViewportCard/ViewportCard';
import styles from './WorkspaceBar.module.css';

type Props = {
  viewports: ViewportConfig[];
  layout: WorkspaceLayout;
  breakpoints: BreakpointSetId;
  showRulers: boolean;
  onToggleVisible: (id: string) => void;
  onMoveTo: (id: string, index: number) => void;
  onZoomAll: (zoom: number) => void;
  onFit: () => void;
  onLayout: (layout: WorkspaceLayout) => void;
  onBreakpoints: (set: BreakpointSetId) => void;
  onRulers: (show: boolean) => void;
};

export function WorkspaceBar(props: Props) {
  const { viewports, layout, breakpoints, showRulers } = props;
  const { t } = useI18n();
  const [dragId, setDragId] = useState<string | null>(null);
  /** Insertion slot while dragging: 0 = before the first chip, n = after the last. */
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  const visible = viewports.filter((vp) => !vp.hidden);
  const zooms = [...new Set(visible.map((vp) => vp.zoom))];
  const commonZoom = zooms.length === 1 ? zooms[0]! : null;
  const zoomOptions =
    commonZoom === null || ZOOM_OPTIONS.includes(commonZoom)
      ? ZOOM_OPTIONS
      : [...ZOOM_OPTIONS, commonZoom].sort((a, b) => a - b);

  const onDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    // Drop before or after this chip depending on which half the pointer is over.
    const rect = event.currentTarget.getBoundingClientRect();
    setDropSlot(index + (event.clientX > rect.left + rect.width / 2 ? 1 : 0));
  };

  const endDrag = () => {
    setDragId(null);
    setDropSlot(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const from = viewports.findIndex((vp) => vp.id === dragId);
    if (dragId && from >= 0 && dropSlot !== null) {
      // The slot counts the dragged chip itself; removing it first shifts later slots.
      const to = from < dropSlot ? dropSlot - 1 : dropSlot;
      if (to !== from) props.onMoveTo(dragId, to);
    }
    endDrag();
  };

  const dropMarker = (index: number): 'before' | 'after' | undefined => {
    if (dropSlot === null || !dragId) return undefined;
    if (dropSlot === index) return 'before';
    if (dropSlot === viewports.length && index === viewports.length - 1) return 'after';
    return undefined;
  };

  const onChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, vp: ViewportConfig, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
    if (target < 0 || target >= viewports.length) return;
    props.onMoveTo(vp.id, target);
    // Keep focus on the moved chip after re-render.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-chip-id="${vp.id}"]`)?.focus());
  };

  return (
    <div className={styles.bar}>
      <div className={styles.chipsArea}>
        <span className={styles.label}>
          {t('workspace.viewports')}
          <span className={styles.count}>{t('workspace.count', { count: viewports.length, max: MAX_VIEWPORTS })}</span>
        </span>
        <ul className={styles.chips} aria-label={t('workspace.viewports')}>
          {viewports.map((vp, index) => (
            <li
              key={vp.id}
              className={styles.chipItem}
              data-drop={dropMarker(index)}
              onDragOver={(event) => onDragOver(event, index)}
              onDrop={onDrop}
            >
              <button
                type="button"
                className={styles.chip}
                aria-pressed={!vp.hidden}
                aria-label={t('workspace.chipLabel', { name: vp.name, size: `${vp.width} × ${vp.height}` })}
                title={t('workspace.chipHint')}
                data-chip-id={vp.id}
                data-testid="viewport-chip"
                draggable
                onDragStart={(event) => {
                  setDragId(vp.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', vp.id);
                }}
                onDragEnd={endDrag}
                onClick={() => props.onToggleVisible(vp.id)}
                onKeyDown={(event) => onChipKeyDown(event, vp, index)}
              >
                <Icon name={vp.hidden ? 'eyeOff' : 'eye'} size={13} className={styles.chipIcon} />
                <span className={styles.chipName}>{vp.name}</span>
                <span className={styles.chipSize}>
                  {vp.width}×{vp.height}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.controls}>
        <label className={styles.control}>
          <span className={styles.controlLabel}>{t('workspace.breakpoints')}</span>
          <select
            className="field"
            value={breakpoints}
            onChange={(event) => props.onBreakpoints(event.target.value as BreakpointSetId)}
          >
            <option value="none">{t('breakpoints.none')}</option>
            <option value="tailwind">{t('breakpoints.tailwind')}</option>
            <option value="bootstrap">{t('breakpoints.bootstrap')}</option>
          </select>
        </label>

        <button
          type="button"
          className={styles.toggle}
          aria-pressed={showRulers}
          onClick={() => props.onRulers(!showRulers)}
          title={`${t('workspace.rulers')} (M)`}
        >
          <Icon name="ruler" size={15} />
          <span>{t('workspace.rulers')}</span>
        </button>

        <span className={styles.divider} aria-hidden="true" />

        <label className={styles.control}>
          <span className={styles.controlLabel}>{t('workspace.zoom')}</span>
          <select
            className={`field ${styles.zoomSelect}`}
            value={commonZoom ?? 'mixed'}
            onChange={(event) => props.onZoomAll(Number(event.target.value))}
            disabled={visible.length === 0}
          >
            {commonZoom === null && (
              <option value="mixed" disabled>
                {t('workspace.zoomMixed')}
              </option>
            )}
            {zoomOptions.map((option) => (
              <option key={option} value={option}>
                {formatZoom(option)}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          icon="fit"
          onClick={props.onFit}
          title={`${t('workspace.fitHint')} (F)`}
          disabled={visible.length === 0}
        >
          {t('workspace.fit')}
        </Button>

        <span className={styles.divider} aria-hidden="true" />

        <Segmented
          label={t('workspace.layout')}
          size="sm"
          iconOnly
          value={layout}
          onChange={props.onLayout}
          options={[
            { value: 'wrap', label: t('layout.wrap'), icon: 'wrap' },
            { value: 'row', label: t('layout.row'), icon: 'row' },
          ]}
        />
      </div>
    </div>
  );
}
