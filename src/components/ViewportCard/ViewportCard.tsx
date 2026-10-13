import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { breakpointFor } from '../../data/breakpoints';
import { useI18n } from '../../i18n/I18nProvider';
import { isValidDimension } from '../../state/viewports';
import type { BreakpointSetId, ViewportConfig } from '../../types';
import { MAX_DIMENSION, MAX_NAME_LENGTH, MIN_DIMENSION, ZOOM_OPTIONS } from '../../utils/constants';
import { IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Menu, type MenuEntry } from '../Menu/Menu';
import { PreviewFrame } from '../PreviewFrame/PreviewFrame';
import { RULER_SIZE, Ruler } from '../Ruler/Ruler';
import styles from './ViewportCard.module.css';

export const MIN_CARD_WIDTH = 312;
/** Card border width on both sides, used by the fit calculation. */
export const CARD_CHROME_WIDTH = 2;

export type ViewportCardActions = {
  onRename: (name: string) => void;
  onResize: (size: { width?: number; height?: number }) => void;
  onZoom: (zoom: number) => void;
  onRotate: () => void;
  onMove: (delta: -1 | 1) => void;
  onReload: () => void;
  onCapture: (stage: HTMLElement) => void;
  onOpenInTab: () => void;
  onOpenInWindow: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  onRemove: () => void;
};

type Props = ViewportCardActions & {
  viewport: ViewportConfig;
  /** Page to show; null shows an empty placeholder of the right size. */
  src: string | null;
  reloadKey: number;
  index: number;
  count: number;
  canDuplicate: boolean;
  breakpointSet: BreakpointSetId;
  showRulers: boolean;
};

export function formatZoom(zoom: number) {
  return `${Math.round(zoom * 100)}%`;
}

export function ViewportCard(props: Props) {
  const { viewport, src, reloadKey, index, count, canDuplicate, breakpointSet, showRulers } = props;
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const { name, width, height, zoom, orientation } = viewport;
  const zoomOptions = ZOOM_OPTIONS.includes(zoom) ? ZOOM_OPTIONS : [...ZOOM_OPTIONS, zoom].sort((a, b) => a - b);
  const breakpoint = breakpointFor(breakpointSet, width);
  const rulerSize = showRulers ? RULER_SIZE : 0;
  const contentWidth = Math.round(width * zoom) + rulerSize;

  const menuEntries: MenuEntry[] = [
    {
      id: 'duplicate',
      label: t('card.menuDuplicate'),
      icon: 'copy',
      disabled: !canDuplicate,
      onSelect: props.onDuplicate,
    },
    { id: 'tab', label: t('card.menuOpenTab'), icon: 'external', disabled: !src, onSelect: props.onOpenInTab },
    { id: 'window', label: t('card.menuOpenWindow'), icon: 'window', disabled: !src, onSelect: props.onOpenInWindow },
    { kind: 'separator', id: 'sep1' },
    {
      id: 'left',
      label: t('card.menuMoveLeft'),
      icon: 'chevronLeft',
      disabled: index === 0,
      onSelect: () => props.onMove(-1),
    },
    {
      id: 'right',
      label: t('card.menuMoveRight'),
      icon: 'chevronRight',
      disabled: index === count - 1,
      onSelect: () => props.onMove(1),
    },
    { id: 'hide', label: t('card.menuHide'), icon: 'eyeOff', onSelect: props.onHide },
  ];

  return (
    <section
      className={styles.card}
      style={{ width: Math.max(MIN_CARD_WIDTH, contentWidth + CARD_CHROME_WIDTH) }}
      aria-label={t('card.label', { name, width, height })}
      data-testid="viewport-card"
      data-viewport-id={viewport.id}
    >
      <header className={styles.header} data-card-header>
        <div className={styles.row}>
          <div className={styles.title}>
            <NameField name={name} onRename={props.onRename} />
          </div>
          <div className={styles.actions}>
            <IconButton
              icon="rotate"
              size="sm"
              label={orientation === 'portrait' ? t('card.rotateLandscape') : t('card.rotatePortrait')}
              onClick={props.onRotate}
              disabled={width === height}
            />
            <IconButton
              icon="reload"
              size="sm"
              label={t('card.reload', { name })}
              onClick={props.onReload}
              disabled={!src}
            />
            <IconButton
              icon="camera"
              size="sm"
              label={t('card.capture', { name })}
              onClick={() => stageRef.current && props.onCapture(stageRef.current)}
              disabled={!src}
            />
            <Menu
              label={t('card.more', { name })}
              entries={menuEntries}
              align="end"
              trigger={(triggerProps) => (
                <button
                  type="button"
                  {...triggerProps}
                  className={styles.moreButton}
                  aria-label={t('card.more', { name })}
                  title={t('card.more', { name })}
                >
                  <Icon name="more" size={15} />
                </button>
              )}
            />
            <IconButton
              icon="close"
              size="sm"
              tone="danger"
              label={t('card.remove', { name })}
              onClick={props.onRemove}
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.title}>
            <SizeFields width={width} height={height} onResize={props.onResize} />
            {breakpoint && (
              <span
                className={styles.badge}
                title={t('card.breakpointHint', { set: t(`breakpoints.${breakpointSet}` as const) })}
                data-testid="breakpoint-badge"
              >
                {breakpoint}
              </span>
            )}
          </div>
          <label className="visually-hidden" htmlFor={`zoom-${viewport.id}`}>
            {t('card.zoomLabel', { name })}
          </label>
          <select
            id={`zoom-${viewport.id}`}
            className={`field ${styles.zoom}`}
            value={zoom}
            onChange={(event) => props.onZoom(Number(event.target.value))}
            title={t('card.zoomHint')}
          >
            {zoomOptions.map((option) => (
              <option key={option} value={option}>
                {formatZoom(option)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className={styles.stage}>
        <div
          className={styles.canvas}
          style={{
            gridTemplateColumns: showRulers ? `${RULER_SIZE}px auto` : 'auto',
            gridTemplateRows: showRulers ? `${RULER_SIZE}px auto` : 'auto',
          }}
        >
          {showRulers && (
            <>
              <span className={styles.corner} aria-hidden="true" />
              <Ruler orientation="horizontal" length={width} zoom={zoom} />
              <Ruler orientation="vertical" length={height} zoom={zoom} />
            </>
          )}
          <div ref={stageRef} className={styles.frameSlot}>
            {src ? (
              <PreviewFrame
                key={`${src}#${reloadKey}`}
                src={src}
                width={width}
                height={height}
                zoom={zoom}
                title={t('frame.title', { name, width, height })}
              />
            ) : (
              <div className={styles.placeholder} style={{ width: width * zoom, height: height * zoom }}>
                <Icon name="globe" size={20} />
                <span className={styles.placeholderSize}>
                  {width} × {height}
                </span>
                <span className={styles.placeholderHint}>{t('card.placeholder')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function NameField({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        className={styles.name}
        onClick={() => setDraft(name)}
        title={t('card.rename', { name })}
        aria-label={t('card.rename', { name })}
      >
        <span className={styles.nameText}>{name}</span>
        <Icon name="pencil" size={12} className={styles.nameIcon} />
      </button>
    );
  }

  const commit = () => {
    if (draft.trim() && draft.trim() !== name) onRename(draft);
    setDraft(null);
  };

  return (
    <input
      className={`field ${styles.nameInput}`}
      aria-label={t('card.nameLabel')}
      value={draft}
      maxLength={MAX_NAME_LENGTH}
      autoFocus
      onFocus={(event) => event.target.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(null);
      }}
    />
  );
}

type Field = 'width' | 'height';

function SizeFields({
  width,
  height,
  onResize,
}: {
  width: number;
  height: number;
  onResize: (size: { width?: number; height?: number }) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Record<Field, string> | null>(null);
  const [error, setError] = useState<Field | null>(null);
  const errorId = useId();
  const values = draft ?? { width: String(width), height: String(height) };

  const commit = (field: Field) => {
    if (!draft) return;
    const raw = draft[field].trim();
    const value = Number(raw);
    setDraft(null);
    if (raw === '' || !isValidDimension(value)) {
      setError(field);
      return;
    }
    setError(null);
    if (value !== (field === 'width' ? width : height)) onResize({ [field]: value });
  };

  const onKeyDown = (field: Field) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit(field);
    if (event.key === 'Escape') {
      setDraft(null);
      setError(null);
    }
  };

  const input = (field: Field) => (
    <input
      className={`field ${styles.dimension}`}
      type="number"
      inputMode="numeric"
      min={MIN_DIMENSION}
      max={MAX_DIMENSION}
      step={1}
      aria-label={field === 'width' ? t('card.widthLabel') : t('card.heightLabel')}
      aria-invalid={error === field ? true : undefined}
      aria-describedby={error === field ? errorId : undefined}
      value={values[field]}
      onChange={(event) => setDraft({ ...values, [field]: event.target.value })}
      onBlur={() => commit(field)}
      onKeyDown={onKeyDown(field)}
    />
  );

  return (
    <div className={styles.sizeGroup}>
      <div className={styles.size}>
        {input('width')}
        <span aria-hidden="true" className={styles.times}>
          ×
        </span>
        {input('height')}
      </div>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {t(error === 'width' ? 'card.widthError' : 'card.heightError', { min: MIN_DIMENSION, max: MAX_DIMENSION })}
        </p>
      )}
    </div>
  );
}
