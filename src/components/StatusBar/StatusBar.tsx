import { useI18n } from '../../i18n/I18nProvider';
import type { WorkspaceLayout } from '../../types';
import { formatZoom } from '../../utils/format';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './StatusBar.module.css';

type Props = {
  /** Viewports shown, and how many there are. */
  shown: number;
  total: number;
  hasUrl: boolean;
  /** The page's HTTP status, when known. */
  status?: number;
  /** Site access for the page: null without a page. */
  access: { host: string; allowed: boolean | null; allSites: boolean } | null;
  sync: { scroll: boolean; navigation: boolean };
  /** Kinds of issue in every preview; null when checks are off. */
  issueKinds: number | null;
  breakpointsName: string | null;
  /** e.g. "390–1440", or null without visible viewports. */
  widths: string | null;
  /** The zoom every visible viewport shares; null when they differ. */
  zoom: number | null;
  layout: WorkspaceLayout;
  sidebar: boolean;
  minimap: boolean;
  onSidebar: () => void;
  onSiteAccess: () => void;
  onSync: () => void;
  onAudit: () => void;
  onFit: () => void;
  onMinimap: () => void;
};

const LAYOUT_ICONS: Record<WorkspaceLayout, IconName> = { wrap: 'wrap', row: 'row', stack: 'stack' };
const LAYOUT_KEYS = { wrap: 'layout.wrap', row: 'layout.row', stack: 'layout.stack' } as const;

/** A quiet line along the bottom of the workspace: what it shows and how, each part a shortcut to change it. */
export function StatusBar(props: Props) {
  const { t } = useI18n();
  const { access, sync } = props;
  const syncText =
    sync.scroll && sync.navigation
      ? t('status.syncBoth')
      : sync.scroll
        ? t('status.syncScroll')
        : sync.navigation
          ? t('status.syncLinks')
          : t('status.syncOff');

  return (
    <footer className={styles.bar} aria-label={t('status.label')} data-testid="status-bar">
      <button
        type="button"
        className={styles.item}
        aria-pressed={props.sidebar}
        data-tooltip={t('sidebar.toggle')}
        data-shortcut="\"
        aria-label={t('sidebar.toggle')}
        onClick={props.onSidebar}
      >
        <Icon name="sidebar" size={13} />
      </button>
      <span className={styles.text} data-testid="status-previews">
        <span className={styles.dot} data-on={(props.hasUrl && props.shown > 0) || undefined} aria-hidden="true" />
        {props.shown === 1 ? t('status.previewsOne') : t('status.previews', { count: props.shown })}
        {props.total > props.shown && (
          <span className={styles.muted}>· {t('status.hidden', { count: props.total - props.shown })}</span>
        )}
      </span>
      {props.status !== undefined && props.status >= 400 && (
        <span className={styles.text} data-tone="bad">
          {t('status.http', { status: props.status })}
        </span>
      )}
      {access && (
        <button
          type="button"
          className={styles.item}
          data-tone={access.allowed ? 'ok' : undefined}
          onClick={props.onSiteAccess}
          data-testid="status-access"
        >
          <Icon name={access.allowed ? 'shieldCheck' : 'shield'} size={13} />
          <span className={styles.label}>
            {access.allSites
              ? t('status.allSites')
              : access.allowed
                ? t('status.allowed', { host: access.host })
                : t('status.notAllowed', { host: access.host })}
          </span>
        </button>
      )}
      <button
        type="button"
        className={styles.item}
        aria-pressed={sync.scroll || sync.navigation}
        onClick={props.onSync}
        data-testid="status-sync"
      >
        <Icon name="link" size={13} />
        <span className={styles.label}>{syncText}</span>
      </button>

      <span className={styles.spacer} />

      {props.issueKinds !== null && props.hasUrl && (
        <button
          type="button"
          className={styles.item}
          data-tone={props.issueKinds > 0 ? 'warn' : 'ok'}
          onClick={props.onAudit}
          data-shortcut="E"
          data-testid="status-issues"
        >
          <Icon name={props.issueKinds > 0 ? 'alert' : 'check'} size={13} />
          {props.issueKinds === 0
            ? t('status.noIssues')
            : props.issueKinds === 1
              ? t('status.issuesOne')
              : t('status.issues', { count: props.issueKinds })}
        </button>
      )}
      {props.breakpointsName && <span className={`${styles.text} ${styles.optional}`}>{props.breakpointsName}</span>}
      {props.widths && (
        <span className={`${styles.text} ${styles.mono} ${styles.optional}`}>
          {t('status.widths', { range: props.widths })}
        </span>
      )}
      {props.shown > 0 && (
        <button
          type="button"
          className={`${styles.item} ${styles.mono}`}
          onClick={props.onFit}
          data-tooltip={t('status.fit')}
          data-shortcut="F"
          data-testid="status-zoom"
        >
          {props.zoom === null ? t('workspace.zoomMixed') : formatZoom(props.zoom)}
        </button>
      )}
      <span className={`${styles.text} ${styles.optional}`}>
        <Icon name={LAYOUT_ICONS[props.layout]} size={13} />
        {t(LAYOUT_KEYS[props.layout])}
      </span>
      <button
        type="button"
        className={styles.item}
        aria-pressed={props.minimap}
        aria-label={t('minimap.toggle')}
        data-tooltip={t('minimap.toggle')}
        onClick={props.onMinimap}
        data-testid="status-minimap"
      >
        <Icon name="minimap" size={13} />
      </button>
    </footer>
  );
}
