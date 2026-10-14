import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { CheckKind, CheckReport } from '../../agent/protocol';
import { breakpointFor } from '../../data/breakpoints';
import { useI18n } from '../../i18n/I18nProvider';
import { keyboardResize, resolveDrag } from '../../state/resize';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import { isValidDimension } from '../../state/viewports';
import type { Breakpoint, BreakpointSetId, ColorScheme, GridSettings, ViewportConfig } from '../../types';
import { MAX_DIMENSION, MAX_NAME_LENGTH, MIN_DIMENSION, ZOOM_OPTIONS } from '../../utils/constants';
import { formatZoom } from '../../utils/format';
import { IconButton } from '../Button/Button';
import { ChecksBadge } from '../Checks/ChecksBadge';
import { DesignOverlay, type DesignOverlayState } from '../DesignOverlay/DesignOverlay';
import { GridOverlay } from '../GridOverlay/GridOverlay';
import { Icon } from '../Icon/Icon';
import { MeasureOverlay } from '../MeasureOverlay/MeasureOverlay';
import { Menu, type MenuEntry } from '../Menu/Menu';
import { PreviewFrame } from '../PreviewFrame/PreviewFrame';
import { RULER_SIZE, Ruler } from '../Ruler/Ruler';
import { Select } from '../Select/Select';
import styles from './ViewportCard.module.css';

export { formatZoom };

export const MIN_CARD_WIDTH = 320;
/** Card border width on both sides, used by the fit calculation. */
export const CARD_CHROME_WIDTH = 2;
/** Screen pixels within which a dragged edge snaps to a breakpoint. */
const SNAP_DISTANCE = 8;

export type ViewportCardActions = {
  onRename: (name: string) => void;
  onResize: (size: { width?: number; height?: number }) => void;
  onZoom: (zoom: number) => void;
  onRotate: () => void;
  onMove: (delta: -1 | 1) => void;
  onReload: () => void;
  onCapture: (stage: HTMLElement) => void;
  onCopy: (stage: HTMLElement) => void;
  onOpenInTab: () => void;
  onOpenInWindow: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  onRemove: () => void;
  /** Show this viewport on its own (or go back to all of them). */
  onFocus: () => void;
  onColorScheme: (scheme: ColorScheme | null) => void;
};

type Props = ViewportCardActions & {
  viewport: ViewportConfig;
  /** Identifies the card (a viewport is shown twice when comparing two addresses); defaults to the viewport id. */
  cardId?: string;
  /** Visual position (CSS order); the DOM order stays stable so frames don't reload. */
  order: number;
  /** Name of the preview iframe (ties its agent to this card). */
  frameName?: string;
  /**
   * The preview no longer shows the workspace's page, as reported by its agent.
   * Undefined without an agent: the frame guesses from its load events.
   */
  navigatedAway?: boolean;
  customBreakpoints?: Breakpoint[];
  /** Breakpoints found in the page's stylesheets (for the "This site" labels). */
  siteBreakpoints?: number[];
  /** Widths a dragged edge snaps to. */
  snapWidths?: number[];
  /** Column grid drawn over the preview when `grid.show` is on. */
  grid?: GridSettings;
  /** Responsive check results from the preview's agent (sites the user allowed). */
  checks?: CheckReport | null;
  highlighted?: CheckKind | null;
  onHighlight?: (kind: CheckKind | null) => void;
  /** Page to show; null shows an empty placeholder of the right size. */
  src: string | null;
  reloadKey: string;
  index: number;
  count: number;
  canDuplicate: boolean;
  breakpointSet: BreakpointSetId;
  showRulers: boolean;
  /** Focus mode: this card is the one on show… */
  focused?: boolean;
  /** …or another one is, and this card stays loaded but out of sight. */
  concealed?: boolean;
  /** Zoom used instead of the viewport's own (focus mode). */
  zoomOverride?: number;
  /** A CSS filter over the page (vision simulation). */
  filter?: string | null;
  /** Measuring: an overlay over the preview takes the pointer. */
  measuring?: boolean;
  /** A design mockup laid over the preview. */
  overlay?: DesignOverlayState;
  /** The page's scroll position, for the design overlay (0 when unknown). */
  overlayScroll?: number;
  onOverlayFile?: (file: File) => void;
  onOverlayChange?: (patch: Partial<DesignOverlayState>) => void;
  onOverlayRemove?: () => void;
  /** Comparing two addresses: the side this card shows, and what B shows. */
  compare?: { side: 'a' | 'b'; target: string };
  /** On a B card the close button stops comparing instead of removing the viewport. */
  onStopCompare?: () => void;
};

type Drag = {
  axis: 'x' | 'y' | 'xy';
  width: number;
  height: number;
  snapped: number | null;
  /** Where the drag started (pointer and size). */
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

export function ViewportCard(props: Props) {
  const { viewport, src, reloadKey, index, count, canDuplicate, breakpointSet, showRulers } = props;
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const side = props.compare?.side;

  const { name, orientation, colorScheme } = viewport;
  const width = drag?.width ?? viewport.width;
  const height = drag?.height ?? viewport.height;
  const zoom = props.zoomOverride ?? viewport.zoom;
  const zoomOptions = ZOOM_OPTIONS.includes(zoom) ? ZOOM_OPTIONS : [...ZOOM_OPTIONS, zoom].sort((a, b) => a - b);
  const breakpoint = breakpointFor(breakpointSet, width, props.customBreakpoints, props.siteBreakpoints);
  const rulerSize = showRulers ? RULER_SIZE : 0;
  const contentWidth = Math.round(width * zoom) + rulerSize;
  const sizeClass = sizeClassOf(width, height);
  const snapWidths = props.snapWidths ?? [];

  const menuEntries: MenuEntry[] = [
    {
      id: 'focus',
      label: props.focused ? t('card.menuUnfocus') : t('card.menuFocus'),
      icon: props.focused ? 'minimize' : 'maximize',
      onSelect: props.onFocus,
    },
    {
      id: 'duplicate',
      label: t('card.menuDuplicate'),
      icon: 'copy',
      disabled: !canDuplicate,
      onSelect: props.onDuplicate,
    },
    {
      id: 'copy',
      label: t('card.menuCopyImage'),
      icon: 'clipboard',
      disabled: !src,
      onSelect: () => stageRef.current && props.onCopy(stageRef.current),
    },
    { id: 'tab', label: t('card.menuOpenTab'), icon: 'external', disabled: !src, onSelect: props.onOpenInTab },
    { id: 'window', label: t('card.menuOpenWindow'), icon: 'window', disabled: !src, onSelect: props.onOpenInWindow },
    ...(props.onOverlayFile
      ? [
          {
            id: 'overlay',
            label: props.overlay ? t('card.menuOverlayRemove') : t('card.menuOverlay'),
            icon: 'overlay',
            disabled: !src && !props.overlay,
            onSelect: () => (props.overlay ? props.onOverlayRemove?.() : fileRef.current?.click()),
          } satisfies MenuEntry,
        ]
      : []),
    { kind: 'separator', id: 'sep-scheme' },
    { kind: 'heading', id: 'scheme', label: t('card.colorScheme') },
    {
      id: 'scheme-auto',
      label: t('card.schemeAuto'),
      radio: true,
      checked: !colorScheme,
      onSelect: () => props.onColorScheme(null),
    },
    {
      id: 'scheme-light',
      label: t('card.schemeLight'),
      radio: true,
      checked: colorScheme === 'light',
      onSelect: () => props.onColorScheme('light'),
    },
    {
      id: 'scheme-dark',
      label: t('card.schemeDark'),
      radio: true,
      checked: colorScheme === 'dark',
      onSelect: () => props.onColorScheme('dark'),
    },
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

  /* ---------- Resizing by dragging an edge ---------- */

  // While dragging, preview frames must not take the pointer: Chrome sends the
  // events to a frame from another site under the pointer, despite pointer capture.
  const dragAxis = drag?.axis;
  useLayoutEffect(() => {
    if (!dragAxis) return;
    const root = document.documentElement;
    root.dataset.resizing = dragAxis;
    return () => {
      delete root.dataset.resizing;
    };
  }, [dragAxis]);

  const startDrag = (axis: Drag['axis'], event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    // Capturing the pointer keeps the drag going over the preview frames.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      axis,
      width: viewport.width,
      height: viewport.height,
      snapped: null,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: viewport.width,
      startHeight: viewport.height,
    });
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (!drag) return;
    // Shift: steps of 10px. Alt: no snapping to breakpoints.
    const step = event.shiftKey ? 10 : undefined;
    const next = { ...drag };
    if (drag.axis !== 'y') {
      const result = resolveDrag(drag.startWidth + (event.clientX - drag.startX) / zoom, {
        targets: event.altKey ? [] : snapWidths,
        threshold: SNAP_DISTANCE / zoom,
        step,
      });
      next.width = result.value;
      next.snapped = result.snapped;
    }
    if (drag.axis !== 'x')
      next.height = resolveDrag(drag.startHeight + (event.clientY - drag.startY) / zoom, { step }).value;
    if (next.width !== drag.width || next.height !== drag.height || next.snapped !== drag.snapped) setDrag(next);
  };

  const endDrag = (commit: boolean) => {
    if (!drag) return;
    setDrag(null);
    if (!commit) return;
    const patch: { width?: number; height?: number } = {};
    if (drag.width !== viewport.width) patch.width = drag.width;
    if (drag.height !== viewport.height) patch.height = drag.height;
    if (patch.width !== undefined || patch.height !== undefined) props.onResize(patch);
  };

  const handleProps = (axis: Drag['axis']) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => startDrag(axis, event),
    onPointerMove: moveDrag,
    onPointerUp: () => endDrag(true),
    onPointerCancel: () => endDrag(false),
  });

  const onHandleKey = (axis: 'x' | 'y') => (event: KeyboardEvent<HTMLDivElement>) => {
    const current = axis === 'x' ? viewport.width : viewport.height;
    const next = keyboardResize(current, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    if (next !== current) props.onResize(axis === 'x' ? { width: next } : { height: next });
  };

  // Breakpoints within the dragged width, including the one the edge snapped to.
  const guides = drag && drag.axis !== 'y' ? snapWidths.filter((value) => value <= width) : [];

  return (
    <section
      className={styles.card}
      style={{ width: Math.max(MIN_CARD_WIDTH, contentWidth + CARD_CHROME_WIDTH), order: props.order }}
      aria-label={t(side === 'b' ? 'card.labelCompare' : 'card.label', {
        name,
        width: viewport.width,
        height: viewport.height,
      })}
      data-testid="viewport-card"
      data-viewport-id={viewport.id}
      data-card-id={props.cardId ?? viewport.id}
      data-size-class={sizeClass}
      data-focused={props.focused || undefined}
      data-concealed={props.concealed || undefined}
      data-resizing={drag ? drag.axis : undefined}
      data-side={side}
    >
      <header
        className={styles.header}
        data-card-header
        onDoubleClick={(event) => {
          // Double-click on the header's background (not on a control) focuses the card.
          if (!(event.target as Element).closest('button, input, select, label, [role="menu"]')) props.onFocus();
        }}
      >
        <div className={styles.row}>
          <span className={styles.classIcon} aria-hidden="true">
            <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={15} />
          </span>
          <div className={styles.title}>
            <NameField name={name} onRename={props.onRename} />
            {props.compare && (
              <span
                className={styles.side}
                data-side={props.compare.side}
                data-tooltip={
                  side === 'b' ? t('card.compareHint', { target: props.compare.target }) : props.compare.target
                }
                data-testid="compare-side"
              >
                {side === 'b' ? t('card.compareBadge') : t('card.mainBadge')}
              </span>
            )}
          </div>
          <span className={styles.gap} data-header-gap aria-hidden="true" />
          <div className={styles.actions}>
            {props.focused && (
              <IconButton
                icon="minimize"
                size="xs"
                tone="accent"
                label={t('card.menuUnfocus')}
                shortcut="Esc"
                onClick={props.onFocus}
              />
            )}
            <IconButton
              icon="rotate"
              size="xs"
              label={orientation === 'portrait' ? t('card.rotateLandscape') : t('card.rotatePortrait')}
              onClick={props.onRotate}
              disabled={viewport.width === viewport.height}
            />
            <IconButton
              icon="reload"
              size="xs"
              label={t('card.reload', { name })}
              onClick={props.onReload}
              disabled={!src}
            />
            <IconButton
              icon="camera"
              size="xs"
              label={t('card.capture', { name })}
              onClick={() => stageRef.current && props.onCapture(stageRef.current)}
              disabled={!src}
            />
            <Menu
              label={t('card.more', { name })}
              entries={menuEntries}
              align="end"
              minWidth={240}
              trigger={(triggerProps) => (
                <button
                  type="button"
                  {...triggerProps}
                  className={styles.moreButton}
                  aria-label={t('card.more', { name })}
                  data-tooltip={t('card.more', { name })}
                >
                  <Icon name="more" size={15} />
                </button>
              )}
            />
            {side === 'b' && props.onStopCompare ? (
              <IconButton
                icon="close"
                size="xs"
                tone="danger"
                label={t('compare.stop')}
                onClick={props.onStopCompare}
              />
            ) : (
              <IconButton
                icon="close"
                size="xs"
                tone="danger"
                label={t('card.remove', { name })}
                onClick={props.onRemove}
              />
            )}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.meta}>
            <SizeFields
              key={`${viewport.width}x${viewport.height}`}
              width={viewport.width}
              height={viewport.height}
              onResize={props.onResize}
            />
            {breakpoint && (
              <span
                className={styles.badge}
                data-tooltip={t('card.breakpointHint', { set: t(`breakpoints.${breakpointSet}` as const) })}
                data-testid="breakpoint-badge"
              >
                {breakpoint}
              </span>
            )}
            {props.checks && props.onHighlight && (
              <ChecksBadge
                report={props.checks}
                highlighted={props.highlighted ?? null}
                onHighlight={props.onHighlight}
              />
            )}
            {colorScheme && (
              <span
                className={styles.scheme}
                data-tooltip={colorScheme === 'dark' ? t('card.schemeDarkHint') : t('card.schemeLightHint')}
                data-testid="scheme-badge"
              >
                <Icon name={colorScheme === 'dark' ? 'moon' : 'sun'} size={12} />
                <span className="visually-hidden">
                  {colorScheme === 'dark' ? t('card.schemeDark') : t('card.schemeLight')}
                </span>
              </span>
            )}
          </div>
          <label className="visually-hidden" htmlFor={`zoom-${viewport.id}`}>
            {t('card.zoomLabel', { name })}
          </label>
          <Select
            id={`zoom-${viewport.id}`}
            size="sm"
            mono
            className={styles.zoom}
            value={zoom}
            onChange={(event) => props.onZoom(Number(event.target.value))}
            data-tooltip={t('card.zoomHint')}
            disabled={props.zoomOverride !== undefined}
          >
            {zoomOptions.map((option) => (
              <option key={option} value={option}>
                {formatZoom(option)}
              </option>
            ))}
          </Select>
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
              <Ruler orientation="horizontal" length={width} zoom={zoom} marks={snapWidths} />
              <Ruler orientation="vertical" length={height} zoom={zoom} />
            </>
          )}
          <div ref={stageRef} className={styles.frameSlot} data-stage>
            {src ? (
              <PreviewFrame
                key={`${src}#${reloadKey}`}
                src={src}
                width={width}
                height={height}
                zoom={zoom}
                title={
                  side === 'b' && props.compare
                    ? t('frame.titleCompare', {
                        name,
                        target: props.compare.target,
                        width: viewport.width,
                        height: viewport.height,
                      })
                    : t('frame.title', { name, width: viewport.width, height: viewport.height })
                }
                onBack={props.onReload}
                name={props.frameName}
                navigatedAway={props.navigatedAway}
                filter={props.filter}
              />
            ) : (
              <div className={styles.placeholder} style={{ width: width * zoom, height: height * zoom }}>
                {/* Only what fits at this zoom. */}
                {width * zoom >= 64 && height * zoom >= 64 && (
                  <span className={styles.placeholderIcon}>
                    <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={22} />
                  </span>
                )}
                {width * zoom >= 96 && (
                  <span className={styles.placeholderSize}>
                    {width} × {height}
                  </span>
                )}
                {width * zoom >= 170 && height * zoom >= 150 && (
                  <span className={styles.placeholderHint}>{t('card.placeholder')}</span>
                )}
              </div>
            )}
            {props.grid?.show && <GridOverlay grid={props.grid} width={width} height={height} zoom={zoom} />}
            {src && props.overlay && props.onOverlayChange && props.onOverlayRemove && (
              <DesignOverlay
                overlay={props.overlay}
                width={width}
                height={height}
                zoom={zoom}
                scrollY={props.overlayScroll ?? 0}
                name={name}
                onChange={props.onOverlayChange}
                onRemove={props.onOverlayRemove}
              />
            )}
            {src && props.measuring && <MeasureOverlay width={width} height={height} zoom={zoom} />}
            {guides.map((value) => (
              <span
                key={value}
                className={styles.guide}
                style={{ left: value * zoom }}
                data-snapped={drag?.snapped === value || undefined}
                data-edge={value >= width - 1 || undefined}
                aria-hidden="true"
              >
                <span className={styles.guideLabel}>{value}</span>
              </span>
            ))}
            {drag && (
              <span className={styles.dragSize} aria-hidden="true" data-testid="resize-size">
                {width} × {height}
                {breakpoint && <span className={styles.dragBreakpoint}>{breakpoint}</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Resize handles sit just outside the card, so they never cover the page's scrollbar. */}
      <div
        className={`${styles.handle} ${styles.handleX}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('card.resizeWidth', { name })}
        aria-valuenow={viewport.width}
        aria-valuemin={MIN_DIMENSION}
        aria-valuemax={MAX_DIMENSION}
        tabIndex={0}
        data-tooltip={t('card.resizeHint')}
        data-testid="resize-width"
        onKeyDown={onHandleKey('x')}
        {...handleProps('x')}
      >
        <span className={styles.grip} />
      </div>
      <div
        className={`${styles.handle} ${styles.handleY}`}
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('card.resizeHeight', { name })}
        aria-valuenow={viewport.height}
        aria-valuemin={MIN_DIMENSION}
        aria-valuemax={MAX_DIMENSION}
        tabIndex={0}
        data-testid="resize-height"
        onKeyDown={onHandleKey('y')}
        {...handleProps('y')}
      >
        <span className={styles.grip} />
      </div>
      <div className={`${styles.handle} ${styles.handleXY}`} aria-hidden="true" {...handleProps('xy')} />
      {props.onOverlayFile && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          data-testid="overlay-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Picking the same file again must fire a change too.
            event.target.value = '';
            if (file) props.onOverlayFile?.(file);
          }}
        />
      )}
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
        aria-label={t('card.rename', { name })}
        data-tooltip={t('card.rename', { name })}
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
      className={styles.dimension}
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
      style={{ width: `${Math.max(3, values[field].length) + 2.2}ch` }}
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
