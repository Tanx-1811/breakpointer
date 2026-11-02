import { useState, type DragEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { breakpointMap } from '../../state/breakpoint-map';
import type { ResponsiveScore } from '../../state/score';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import type { Breakpoint, ColorScheme } from '../../types';
import { MAX_VIEWPORTS } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './ViewportSidebar.module.css';

export type SidebarViewport = {
  id: string;
  name: string;
  width: number;
  height: number;
  hidden: boolean;
  colorScheme?: ColorScheme;
  /** The breakpoint its width is in (e.g. "md"); null when labels are off. */
  breakpoint: string | null;
  /** Kinds of issue found in its preview; null when it wasn't checked. */
  issues: number | null;
};

export type SidebarPage = {
  /** The page's title, when its preview reported one. */
  title: string | null;
  host: string;
  address: string;
  /** The HTTP status of the page, when known. */
  status?: number;
  /** Breakpointer may run in the site's previews; null while unknown. */
  allowed: boolean | null;
};

type Props = {
  viewports: SidebarViewport[];
  canAdd: boolean;
  /** The viewport shown on its own (focus mode). */
  focusedId: string | null;
  /** The breakpoints in use (empty when labels are off), and the name of their set. */
  breakpoints: Breakpoint[];
  breakpointsName: string | null;
  page: SidebarPage | null;
  score: ResponsiveScore | null;
  /** Kinds of issue in every preview together. */
  issueKinds: number;
  busy: boolean;
  onAdd: () => void;
  /** Scrolls the workspace to a viewport's preview (showing it first when hidden). */
  onReveal: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onMoveTo: (id: string, index: number) => void;
  onFocus: (id: string) => void;
  onAudit: () => void;
  onAllowSite: () => void;
  onClose: () => void;
};

/**
 * The viewports sidebar: every viewport as a row (show, hide, reorder, focus),
 * a map of where each one sits against the breakpoints, and the page at a glance.
 */
export function ViewportSidebar(props: Props) {
  const { viewports } = props;
  const { t } = useI18n();
  const [dragId, setDragId] = useState<string | null>(null);
  /** Insertion slot while dragging: 0 = before the first row, n = after the last. */
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  const onDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    setDropSlot(index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0));
  };
  const endDrag = () => {
    setDragId(null);
    setDropSlot(null);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const from = viewports.findIndex((vp) => vp.id === dragId);
    if (dragId && from >= 0 && dropSlot !== null) {
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

  const onRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const target = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (target < 0 || target >= viewports.length) return;
    props.onMoveTo(id, target);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-sidebar-id="${id}"]`)?.focus());
  };

  const shown = viewports.filter((vp) => !vp.hidden);
  const map = breakpointMap(
    shown.map((vp) => ({ item: vp, width: vp.width })),
    props.breakpoints,
  );
  const mapLabel = [
    props.breakpoints.length
      ? t('sidebar.mapBreakpoints', { list: props.breakpoints.map((bp) => `${bp.name} ${bp.min}`).join(', ') })
      : t('sidebar.mapNoBreakpoints'),
    t('sidebar.mapViewports', { list: shown.map((vp) => `${vp.name} ${vp.width}`).join(', ') || '—' }),
  ].join('. ');

  const { page, score } = props;

  return (
    <aside className={styles.sidebar} aria-label={t('sidebar.label')} data-testid="viewport-sidebar">
      <section className={styles.section} aria-labelledby="sidebar-viewports">
        <div className={styles.sectionHead}>
          <h2 id="sidebar-viewports" className={styles.heading}>
            {t('workspace.viewports')}{' '}
            <span className={styles.count} aria-hidden="true">
              {viewports.length}/{MAX_VIEWPORTS}
            </span>
            <span className="visually-hidden">
              {t('workspace.countLabel', { count: viewports.length, max: MAX_VIEWPORTS })}
            </span>
          </h2>
          <IconButton
            icon="plus"
            size="xs"
            label={t('toolbar.addViewport')}
            shortcut="A"
            onClick={props.onAdd}
            disabled={!props.canAdd}
            data-testid="sidebar-add"
          />
          <IconButton icon="sidebar" size="xs" label={t('sidebar.hide')} shortcut="\" onClick={props.onClose} />
        </div>
        <ul className={styles.rows} aria-label={t('workspace.viewports')} data-tour="viewports">
          {viewports.map((vp, index) => {
            const sizeClass = sizeClassOf(vp.width, vp.height);
            const size = `${vp.width} × ${vp.height}`;
            return (
              <li
                key={vp.id}
                className={styles.item}
                data-drop={dropMarker(index)}
                data-hidden={vp.hidden || undefined}
                data-focused={props.focusedId === vp.id || undefined}
                onDragOver={(event) => onDragOver(event, index)}
                onDrop={onDrop}
              >
                <button
                  type="button"
                  className={styles.row}
                  data-sidebar-id={vp.id}
                  data-size-class={sizeClass}
                  data-testid="sidebar-row"
                  aria-label={t('workspace.chipLabel', { name: vp.name, size })}
                  aria-describedby="sidebar-hint"
                  draggable
                  onDragStart={(event) => {
                    setDragId(vp.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', vp.id);
                  }}
                  onDragEnd={endDrag}
                  onClick={() => props.onReveal(vp.id)}
                  onDoubleClick={() => !vp.hidden && props.onFocus(vp.id)}
                  onKeyDown={(event) => onRowKeyDown(event, vp.id, index)}
                >
                  <span className={styles.icon} aria-hidden="true">
                    <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={14} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>
                      {vp.name}
                      {vp.colorScheme && (
                        <Icon name={vp.colorScheme === 'dark' ? 'moon' : 'sun'} size={11} className={styles.scheme} />
                      )}
                    </span>
                    <span className={styles.size}>{size}</span>
                  </span>
                  {vp.breakpoint && !vp.hidden && <span className={styles.breakpoint}>{vp.breakpoint}</span>}
                  {!vp.hidden && vp.issues ? (
                    <span className={styles.issues} title={t('sidebar.issues', { count: vp.issues })}>
                      <Icon name="alert" size={10} />
                      {vp.issues}
                    </span>
                  ) : null}
                </button>
                <IconButton
                  icon={vp.hidden ? 'eyeOff' : 'eye'}
                  size="xs"
                  label={t(vp.hidden ? 'sidebar.show' : 'sidebar.hideViewport', { name: vp.name })}
                  onClick={() => props.onToggleVisible(vp.id)}
                  data-testid="sidebar-visibility"
                />
              </li>
            );
          })}
        </ul>
        <p id="sidebar-hint" className={styles.hint}>
          {t('sidebar.rowHint')}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="sidebar-map">
        <div className={styles.sectionHead}>
          <h2 id="sidebar-map" className={styles.heading}>
            {t('sidebar.map')}
          </h2>
          {props.breakpointsName && <span className={styles.setName}>{props.breakpointsName}</span>}
        </div>
        <div className={styles.map} role="img" aria-label={mapLabel} data-testid="breakpoint-map">
          <span className={styles.track} />
          {map.ticks.map((tick) => (
            <span key={`${tick.name}-${tick.min}`} className={styles.tick} style={{ left: `${tick.at * 100}%` }}>
              {tick.labelled && <span className={styles.tickName}>{tick.name}</span>}
            </span>
          ))}
          {map.markers.map((marker) => (
            <span
              key={marker.item.id}
              className={styles.marker}
              data-size-class={sizeClassOf(marker.item.width, marker.item.height)}
              data-focused={props.focusedId === marker.item.id || undefined}
              style={{ left: `${marker.at * 100}%` }}
            />
          ))}
          <span className={styles.ends}>
            <span>{map.start}</span>
            <span>{map.end}</span>
          </span>
        </div>
        {!props.breakpoints.length && <p className={styles.hint}>{t('sidebar.mapHint')}</p>}
      </section>

      {page && (
        <section className={styles.section} aria-labelledby="sidebar-page">
          <h2 id="sidebar-page" className={styles.heading}>
            {t('sidebar.page')}
          </h2>
          <div className={styles.card} data-testid="sidebar-page">
            <span className={styles.pageTitle}>{page.title || page.host}</span>
            <span className={styles.pageAddress}>{page.address}</span>
            <span className={styles.pills}>
              {page.status !== undefined && (
                <span className={styles.pill} data-tone={page.status >= 400 ? 'bad' : 'ok'}>
                  {page.status}
                </span>
              )}
              {page.allowed === true && (
                <span className={styles.pill} data-tone="ok">
                  {t('sidebar.allowed')}
                </span>
              )}
            </span>
            {page.allowed === false && (
              <Button size="sm" variant="primary" icon="shield" onClick={props.onAllowSite} disabled={props.busy}>
                {t('tools.allowSite', { host: page.host })}
              </Button>
            )}
          </div>
          {score && (
            <button type="button" className={styles.card} onClick={props.onAudit} data-testid="sidebar-score">
              <span className={styles.score} data-grade={score.grade}>
                {score.score}
              </span>
              <span className={styles.scoreText}>
                <span className={styles.pageTitle}>{t('sidebar.score', { grade: score.grade })}</span>
                <span className={styles.pageAddress}>
                  {props.issueKinds === 0
                    ? t('sidebar.noIssues')
                    : props.issueKinds === 1
                      ? t('sidebar.issueKindsOne')
                      : t('sidebar.issueKinds', { count: props.issueKinds })}
                </span>
              </span>
              <Icon name="chevronRight" size={14} className={styles.chevron} />
            </button>
          )}
        </section>
      )}
    </aside>
  );
}
