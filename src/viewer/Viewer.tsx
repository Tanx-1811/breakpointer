import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddViewportDialog } from '../components/DevicePresetPicker/AddViewportDialog';
import { Button } from '../components/Button/Button';
import { CaptureDialog } from '../components/CaptureDialog/CaptureDialog';
import { Banner } from '../components/Banner/Banner';
import { EmbedNotice } from '../components/EmbedNotice/EmbedNotice';
import { ErrorState } from '../components/ErrorState/ErrorState';
import { ManageGroupsDialog, SaveGroupDialog } from '../components/GroupDialogs/GroupDialogs';
import { HelpDialog } from '../components/HelpDialog/HelpDialog';
import { RULER_SIZE } from '../components/Ruler/Ruler';
import { SettingsDialog } from '../components/SettingsDialog/SettingsDialog';
import { SiteAccessDialog } from '../components/SiteAccessDialog/SiteAccessDialog';
import { ToastProvider, useToast } from '../components/Toast/Toast';
import { CARD_CHROME_WIDTH, MIN_CARD_WIDTH, ViewportCard } from '../components/ViewportCard/ViewportCard';
import { Welcome } from '../components/Welcome/Welcome';
import { WorkspaceBar } from '../components/WorkspaceBar/WorkspaceBar';
import { usePersistentSettings } from '../hooks/usePersistentSettings';
import { useShortcuts } from '../hooks/useShortcuts';
import { useSiteAccess } from '../hooks/useSiteAccess';
import { useStableDomOrder } from '../hooks/useStableDomOrder';
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { resolveLanguage } from '../i18n/translate';
import type { PreviewAdapter } from '../services/preview-adapter';
import { canCapture, captureElement, requestCapturePermission } from '../services/screenshot';
import { loadDismissedNoticeHosts, saveDismissedNoticeHosts } from '../services/session-state';
import { createSettingsExport, defaultViewports, parseSettingsFile } from '../services/storage';
import { fitZoomForAll } from '../state/fit';
import { createGroup, findGroupTemplates } from '../state/groups';
import type { SettingsAction } from '../state/settings-reducer';
import { canAddViewport, fromTemplates, setZoomForAll, stepZoom } from '../state/viewports';
import type { ViewportConfig, BreakpointerSettings } from '../types';
import { downloadBlob, fileNamePart, timestamp } from '../utils/download';
import { URL_ERROR_KEYS } from '../i18n/url-errors';
import { displayHost, isLocalHost, parsePreviewUrl, type UrlParseError } from '../utils/url';
import { TopBar } from './TopBar';
import styles from './Viewer.module.css';

const WORKSPACE_GAP = 20;
const WORKSPACE_PADDING = 24;
const DEFAULT_CARD_CHROME_HEIGHT = 86;
/** Pixels kept free when fitting, so rounding never pushes a card onto a new row. */
const FIT_SLACK = 2;

type DialogName = 'add' | 'saveGroup' | 'manageGroups' | 'access' | 'capture' | 'settings' | 'help';

type ProbeState = 'idle' | 'checking' | 'reachable' | 'unreachable' | 'unknown';

export type ViewerProps = {
  initialSettings: BreakpointerSettings;
  initialUrl: URL | null;
  initialInput: string;
  initialError: UrlParseError | null;
  adapter: PreviewAdapter;
  version: string;
  /** No settings were stored yet: fit the default viewports once a page loads. */
  /** Fit the viewports once: after the first page is shown (first run), or right away (group from the popup). */
  autoFit: 'none' | 'afterFirstPage' | 'now';
};

export function ViewerApp(props: ViewerProps) {
  const [settings, dispatch] = usePersistentSettings(props.initialSettings);
  const language = resolveLanguage(settings.language);
  const resolvedTheme = useTheme(settings.theme);

  return (
    <I18nProvider language={language}>
      <ToastProvider>
        <Workspace {...props} settings={settings} dispatch={dispatch} resolvedTheme={resolvedTheme} />
      </ToastProvider>
    </I18nProvider>
  );
}

type WorkspaceProps = ViewerProps & {
  settings: BreakpointerSettings;
  dispatch: (action: SettingsAction) => void;
  resolvedTheme: 'light' | 'dark';
};

function Workspace({
  settings,
  dispatch,
  adapter,
  initialUrl,
  initialInput,
  initialError,
  version,
  autoFit,
  resolvedTheme,
}: WorkspaceProps) {
  const { t } = useI18n();
  const toast = useToast();

  const [address, setAddress] = useState(initialUrl?.href ?? initialInput);
  const [addressError, setAddressError] = useState<MessageKey | null>(
    initialError ? URL_ERROR_KEYS[initialError] : null,
  );
  const [currentUrl, setCurrentUrl] = useState<URL | null>(initialUrl);
  const [probeRun, setProbeRun] = useState(0);
  const [probeResult, setProbeResult] = useState<{ key: string; kind: ProbeState } | null>(null);
  const [reloadAll, setReloadAll] = useState(0);
  const [cardReloads, setCardReloads] = useState<Record<string, number>>({});
  // Hosts whose blocked-site tip was dismissed, until Chrome closes.
  const [dismissedHosts, setDismissedHosts] = useState<string[]>([]);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [commandShortcuts, setCommandShortcuts] = useState({ open: '', preview: '' });

  const addressRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const pendingCapture = useRef<(() => Promise<void>) | null>(null);

  const siteAccess = useSiteAccess(currentUrl);
  const { viewports } = settings;
  const visible = useMemo(() => viewports.filter((vp) => !vp.hidden), [viewports]);
  const host = currentUrl ? displayHost(currentUrl) : null;

  /* ---------- Navigation ---------- */

  const navigate = useCallback(
    (input: string) => {
      const result = parsePreviewUrl(input);
      if (!result.ok) {
        setAddressError(URL_ERROR_KEYS[result.error]);
        addressRef.current?.focus();
        return;
      }
      const url = result.url;
      setAddressError(null);
      setAddress(url.href);
      if (currentUrl?.href === url.href) setReloadAll((n) => n + 1);
      // A dev server is rarely on port 80: suggest adding the port.
      if (isLocalHost(url.hostname) && !url.port && !/:\d/.test(input)) {
        toast({ message: t('url.hint.localPort', { host: url.hostname }), tone: 'info' });
      }
      setCurrentUrl(url);
      setProbeRun((n) => n + 1);
      dispatch({ type: 'visitUrl', url: url.href });
      history.replaceState(null, '', `?${new URLSearchParams({ url: url.href })}`);
    },
    [currentUrl, dispatch, t, toast],
  );

  useEffect(() => {
    let active = true;
    void loadDismissedNoticeHosts().then((hosts) => {
      if (active) setDismissedHosts(hosts);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title = host ? `${host} — Breakpointer` : 'Breakpointer';
  }, [host]);

  // Reachability of the current address; a new address or retry starts a new check.
  // Re-checked when the address, a retry or the site's access changes; waits until access is known.
  const probeKey = currentUrl && siteAccess.site !== null ? `${currentUrl.href}#${probeRun}#${siteAccess.site}` : null;
  const probe: ProbeState = !currentUrl
    ? 'idle'
    : probeKey && probeResult?.key === probeKey
      ? probeResult.kind
      : 'checking';

  useEffect(() => {
    if (!currentUrl || !probeKey) return;
    let cancelled = false;
    void adapter.probe(currentUrl, { hasAccess: siteAccess.site === true }).then((result) => {
      if (!cancelled) setProbeResult({ key: probeKey, kind: result.kind });
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, currentUrl, probeKey, siteAccess.site]);

  useEffect(() => {
    void chrome.commands
      ?.getAll()
      .then((commands) => {
        const find = (name: string) => commands.find((command) => command.name === name)?.shortcut ?? '';
        setCommandShortcuts({ open: find('_execute_action'), preview: find('preview-current-page') });
      })
      .catch(() => {});
  }, [dialog]);

  /* ---------- Undo helper ---------- */

  const withUndo = useCallback(
    (message: string, undo: () => void) =>
      toast({ message, tone: 'success', action: { label: t('common.undo'), onAction: undo } }),
    [toast, t],
  );

  const replaceViewports = useCallback(
    (next: ViewportConfig[], message: string) => {
      const previous = viewports;
      dispatch({ type: 'replaceViewports', viewports: next });
      withUndo(message, () => dispatch({ type: 'replaceViewports', viewports: previous }));
    },
    [dispatch, viewports, withUndo],
  );

  /* ---------- Viewport actions ---------- */

  const removeViewport = (vp: ViewportConfig) => {
    const index = viewports.findIndex((item) => item.id === vp.id);
    dispatch({ type: 'removeViewport', id: vp.id });
    // Undo puts back only this viewport, keeping anything changed since.
    withUndo(t('toast.removed', { name: vp.name }), () => dispatch({ type: 'restoreViewport', viewport: vp, index }));
  };

  const moveVisible = (vp: ViewportConfig, delta: -1 | 1) => {
    const position = visible.findIndex((item) => item.id === vp.id);
    const neighbour = visible[position + delta];
    if (!neighbour) return;
    dispatch({ type: 'moveViewportTo', id: vp.id, index: viewports.findIndex((item) => item.id === neighbour.id) });
  };

  /** The largest common zoom at which `list` fits in the visible workspace. */
  const computeFitZoom = useCallback(
    (list: ViewportConfig[]) => {
      const element = workspaceRef.current;
      if (!element) return null;
      const cards = element.querySelector<HTMLElement>('[data-cards]');
      const header = element.querySelector<HTMLElement>('[data-card-header]');
      const top = cards?.offsetTop ?? WORKSPACE_PADDING;
      const chromeHeight = (header?.offsetHeight ?? DEFAULT_CARD_CHROME_HEIGHT - 2) + 2;
      const rulerSize = settings.showRulers ? RULER_SIZE : 0;
      return fitZoomForAll(
        list,
        {
          width: element.clientWidth - WORKSPACE_PADDING * 2 - FIT_SLACK,
          height: element.clientHeight - top - WORKSPACE_PADDING - FIT_SLACK,
        },
        settings.layout,
        {
          chromeHeight,
          chromeWidth: CARD_CHROME_WIDTH + rulerSize,
          stageExtraHeight: rulerSize,
          minCardWidth: MIN_CARD_WIDTH,
          gap: WORKSPACE_GAP,
        },
      );
    },
    [settings.layout, settings.showRulers],
  );

  const fit = useCallback(() => {
    const zoom = computeFitZoom(viewports);
    if (zoom !== null) dispatch({ type: 'setZoomForAll', zoom });
  }, [computeFitZoom, dispatch, viewports]);

  // First run: once a page is shown, fit the default viewports to this screen.
  const autoFitPending = useRef(autoFit !== 'none');
  useEffect(() => {
    if (!autoFitPending.current) return;
    if (autoFit === 'afterFirstPage' && !currentUrl) return;
    // Wait until the site-access tip (which takes space) has been decided.
    if (currentUrl && siteAccess.site === null) return;
    const frame = requestAnimationFrame(() => {
      autoFitPending.current = false;
      fit();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFit, currentUrl, fit, siteAccess.site]);

  const applyGroup = (id: string) => {
    const group = findGroupTemplates(id, settings.groups, t);
    if (!group) return;
    let next = fromTemplates(group.viewports);
    // Built-in groups are fitted to this screen; saved groups keep their zoom.
    const zoom = id.startsWith('builtin:') ? computeFitZoom(next) : null;
    if (zoom !== null) next = setZoomForAll(next, zoom);
    replaceViewports(next, t('groups.applied', { name: group.name }));
  };

  /* ---------- Site access ---------- */

  const allowSite = async () => {
    if (!currentUrl) return;
    const granted = await siteAccess.allowSite().catch(() => false);
    if (granted) {
      toast({ message: t('access.granted', { host: displayHost(currentUrl) }), tone: 'success' });
      setReloadAll((n) => n + 1);
    } else {
      toast({ message: t('access.denied'), tone: 'error' });
    }
  };

  const allowAllSites = async () => {
    const granted = await siteAccess.allowAllSites().catch(() => false);
    if (granted) {
      toast({ message: t('access.grantedAll'), tone: 'success' });
      setReloadAll((n) => n + 1);
    } else {
      toast({ message: t('access.denied'), tone: 'error' });
    }
  };

  /* ---------- Screenshots ---------- */

  const runCapture = async (element: HTMLElement, label: string[]) => {
    const parts = ['breakpointer', host ?? 'page', ...label].map(fileNamePart);
    const fileName = `${parts.join('_')}_${timestamp()}.png`;
    const result = await captureElement(element, fileName);
    if (!result.ok) toast({ message: t('capture.failed'), tone: 'error' });
    else if (result.partial) toast({ message: t('capture.partial'), tone: 'info' });
    else toast({ message: t('capture.saved', { file: result.fileName }), tone: 'success' });
  };

  const capture = async (element: HTMLElement | null, label: string[]) => {
    if (!currentUrl) {
      toast({ message: t('capture.notReady'), tone: 'info' });
      return;
    }
    if (!element) return;
    if (await canCapture()) {
      await runCapture(element, label);
      return;
    }
    pendingCapture.current = () => runCapture(element, label);
    setDialog('capture');
  };

  const allowCapture = async () => {
    const granted = await requestCapturePermission();
    setDialog(null);
    const pending = pendingCapture.current;
    pendingCapture.current = null;
    if (!granted) {
      toast({ message: t('access.denied'), tone: 'error' });
      return;
    }
    // Let the dialog close, then capture what is on screen right now.
    await new Promise((resolve) => setTimeout(resolve, 150));
    await pending?.();
    // All-sites access also lets sites that refused to load in a frame appear.
    toast({
      message: t('access.grantedAll'),
      tone: 'info',
      action: { label: t('common.reload'), onAction: () => setReloadAll((n) => n + 1) },
    });
  };

  /* ---------- Settings data ---------- */

  const exportSettings = () => {
    const data = JSON.stringify(createSettingsExport(settings), null, 2);
    downloadBlob(new Blob([data], { type: 'application/json' }), `breakpointer-settings_${timestamp()}.json`);
  };

  const importSettings = async (file: File) => {
    try {
      const imported = parseSettingsFile(await file.text(), settings);
      if (!imported) throw new Error('Not a Breakpointer export');
      const previous = settings;
      dispatch({ type: 'replaceSettings', settings: imported });
      withUndo(t('settings.imported'), () => dispatch({ type: 'replaceSettings', settings: previous }));
    } catch {
      toast({ message: t('settings.importFailed'), tone: 'error' });
    }
  };

  const resetWorkspace = () => {
    replaceViewports(
      defaultViewports((id) => t(`preset.${id}` as MessageKey)),
      t('toast.reset'),
    );
    setDialog(null);
  };

  // The toolbar button and T always visibly switch: light ↔ dark (System is set in Settings).
  const toggleTheme = () => dispatch({ type: 'setTheme', theme: resolvedTheme === 'dark' ? 'light' : 'dark' });

  /* ---------- Shortcuts ---------- */

  useShortcuts({
    focusAddress: () => addressRef.current?.focus(),
    reload: () => currentUrl && setReloadAll((n) => n + 1),
    add: () => setDialog('add'),
    groups: () => document.querySelector<HTMLButtonElement>('[data-groups-trigger]')?.click(),
    fit,
    zoomIn: () => dispatch({ type: 'setZoomForAll', zoom: stepZoom(viewports, 1) }),
    zoomOut: () => dispatch({ type: 'setZoomForAll', zoom: stepZoom(viewports, -1) }),
    layout: () => dispatch({ type: 'setLayout', layout: settings.layout === 'wrap' ? 'row' : 'wrap' }),
    rulers: () => dispatch({ type: 'setShowRulers', showRulers: !settings.showRulers }),
    capture: () => void capture(workspaceRef.current, ['workspace']),
    theme: toggleTheme,
    help: () => setDialog('help'),
  });

  // Signals that the workspace is interactive (used by end-to-end tests).
  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  /* ---------- Render ---------- */

  const src = currentUrl?.href ?? null;
  // Cards stay in a stable DOM order (moving an iframe reloads it); CSS `order` places them.
  const domOrder = useStableDomOrder(visible.map((vp) => vp.id));
  // Chrome doesn't tell the page when a frame was refused, so the tip shows
  // for any site that isn't allowed yet (unless the site is simply unreachable).
  const showNotice = Boolean(
    currentUrl &&
    settings.embedHints &&
    siteAccess.site === false &&
    probe !== 'unreachable' &&
    !dismissedHosts.includes(currentUrl.hostname),
  );

  const renderCards = () => (
    <div className={styles.cards} data-layout={settings.layout} data-cards>
      {domOrder.map((id) => {
        const index = visible.findIndex((item) => item.id === id);
        const vp = visible[index];
        return vp ? (
          <ViewportCard
            key={vp.id}
            order={index}
            viewport={vp}
            src={src}
            reloadKey={`${reloadAll}.${cardReloads[vp.id] ?? 0}`}
            index={index}
            count={visible.length}
            canDuplicate={canAddViewport(viewports)}
            breakpointSet={settings.breakpoints}
            showRulers={settings.showRulers}
            onRename={(name) => dispatch({ type: 'updateViewport', id: vp.id, patch: { name } })}
            onResize={(size) => dispatch({ type: 'updateViewport', id: vp.id, patch: size })}
            onZoom={(zoom) => dispatch({ type: 'updateViewport', id: vp.id, patch: { zoom } })}
            onRotate={() => dispatch({ type: 'rotateViewport', id: vp.id })}
            onMove={(delta) => moveVisible(vp, delta)}
            onReload={() => setCardReloads((map) => ({ ...map, [vp.id]: (map[vp.id] ?? 0) + 1 }))}
            onCapture={(stage) => void capture(stage, [vp.name, `${vp.width}x${vp.height}`])}
            onOpenInTab={() => src && void adapter.openInTab(src)}
            onOpenInWindow={async () => {
              if (!src) return;
              const size = await adapter.openInWindow(src, { width: vp.width, height: vp.height }).catch(() => null);
              if (!size) toast({ message: t('window.failed'), tone: 'error' });
              else if (size.width !== vp.width || size.height !== vp.height)
                toast({ message: t('window.clamped', size), tone: 'info' });
            }}
            onDuplicate={() => {
              dispatch({ type: 'duplicateViewport', id: vp.id });
              toast({ message: t('toast.duplicated', { name: vp.name }), tone: 'success' });
            }}
            onHide={() => dispatch({ type: 'updateViewport', id: vp.id, patch: { hidden: true } })}
            onRemove={() => removeViewport(vp)}
          />
        ) : null;
      })}
    </div>
  );

  const renderContent = () => {
    if (viewports.length === 0) {
      return (
        <>
          {!currentUrl && <Welcome onTryExample={() => navigate('https://example.com')} />}
          <ErrorState icon="layers" title={t('empty.noViewportsTitle')} body={t('empty.noViewportsBody')}>
            <Button variant="primary" icon="plus" onClick={() => setDialog('add')}>
              {t('toolbar.addViewport')}
            </Button>
            <Button icon="layers" onClick={() => applyGroup('builtin:basics')}>
              {t('empty.applyBasics')}
            </Button>
          </ErrorState>
        </>
      );
    }
    if (visible.length === 0) {
      return (
        <ErrorState icon="eyeOff" title={t('empty.allHiddenTitle')} body={t('empty.allHiddenBody')}>
          <Button variant="primary" icon="eye" onClick={() => dispatch({ type: 'showAll' })}>
            {t('empty.showAll')}
          </Button>
        </ErrorState>
      );
    }
    return (
      <>
        {!currentUrl && <Welcome onTryExample={() => navigate('https://example.com')} />}
        {renderCards()}
      </>
    );
  };

  return (
    <div className={styles.app}>
      <TopBar
        address={address}
        addressError={addressError ? t(addressError) : null}
        addressRef={addressRef}
        recentUrls={settings.recentUrls}
        hasUrl={Boolean(currentUrl)}
        secure={currentUrl ? currentUrl.protocol === 'https:' : null}
        siteAllowed={siteAccess.site}
        groups={settings.groups}
        canAddViewport={canAddViewport(viewports)}
        onAddressChange={(value) => {
          setAddress(value);
          if (addressError) setAddressError(null);
        }}
        onSubmit={() => navigate(address)}
        onReloadAll={() => setReloadAll((n) => n + 1)}
        onOpenInTab={() => currentUrl && void adapter.openInTab(currentUrl.href)}
        onApplyGroup={applyGroup}
        onSaveGroup={() => setDialog('saveGroup')}
        onManageGroups={() => setDialog('manageGroups')}
        onAddViewport={() => setDialog('add')}
        onCapture={() => void capture(workspaceRef.current, ['workspace'])}
        onSiteAccess={() => setDialog('access')}
        onToggleTheme={toggleTheme}
        resolvedTheme={resolvedTheme}
        onSettings={() => setDialog('settings')}
        onHelp={() => setDialog('help')}
      />
      <WorkspaceBar
        viewports={viewports}
        layout={settings.layout}
        breakpoints={settings.breakpoints}
        showRulers={settings.showRulers}
        onToggleVisible={(id) => {
          const vp = viewports.find((item) => item.id === id);
          if (vp) dispatch({ type: 'updateViewport', id, patch: { hidden: !vp.hidden } });
        }}
        onMoveTo={(id, index) => dispatch({ type: 'moveViewportTo', id, index })}
        onZoomAll={(zoom) => dispatch({ type: 'setZoomForAll', zoom })}
        onFit={fit}
        onLayout={(layout) => dispatch({ type: 'setLayout', layout })}
        onBreakpoints={(breakpoints) => dispatch({ type: 'setBreakpoints', breakpoints })}
        onRulers={(showRulers) => dispatch({ type: 'setShowRulers', showRulers })}
      />
      {probe === 'unreachable' && host && currentUrl && (
        // The previews stay: each frame shows Chrome's own error page too.
        <Banner
          tone="danger"
          icon="alert"
          testId="unreachable-banner"
          actions={
            <>
              <Button
                size="sm"
                variant="primary"
                icon="reload"
                onClick={() => {
                  setProbeRun((n) => n + 1);
                  setReloadAll((n) => n + 1);
                }}
              >
                {t('error.retry')}
              </Button>
              <Button size="sm" icon="external" onClick={() => void adapter.openInTab(currentUrl.href)}>
                {t('access.noticeOpen')}
              </Button>
            </>
          }
        >
          <strong>{t('error.unreachableTitle', { host })}</strong> {t('error.unreachableBody')}
        </Banner>
      )}
      {showNotice && host && currentUrl && (
        <EmbedNotice
          host={host}
          onAllow={() => void allowSite()}
          onOpenInTab={() => void adapter.openInTab(currentUrl.href)}
          onDismiss={() => {
            const next = [...dismissedHosts.filter((host) => host !== currentUrl.hostname), currentUrl.hostname];
            setDismissedHosts(next);
            void saveDismissedNoticeHosts(next);
          }}
          onNeverShow={() => {
            dispatch({ type: 'setEmbedHints', embedHints: false });
            toast({ message: t('access.noticeHidden'), tone: 'info' });
          }}
        />
      )}
      <main ref={workspaceRef} className={styles.workspace} aria-label={t('workspace.region')} data-testid="workspace">
        {renderContent()}
      </main>

      <AddViewportDialog
        open={dialog === 'add'}
        canAdd={canAddViewport(viewports)}
        onAdd={(viewport) => {
          dispatch({ type: 'addViewport', viewport });
          toast({ message: t('add.added', { name: viewport.name }), tone: 'success' });
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />
      <SaveGroupDialog
        open={dialog === 'saveGroup'}
        viewportCount={viewports.length}
        groupCount={settings.groups.length}
        onSave={(name) => {
          dispatch({ type: 'saveGroup', group: createGroup(name, viewports) });
          toast({ message: t('groups.saved', { name }), tone: 'success' });
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />
      <ManageGroupsDialog
        open={dialog === 'manageGroups'}
        groups={settings.groups}
        canReplace={viewports.length > 0}
        onRename={(id, name) => dispatch({ type: 'renameGroup', id, name })}
        onReplace={(id) => {
          const group = settings.groups.find((item) => item.id === id);
          dispatch({ type: 'updateGroupViewports', id });
          if (group)
            withUndo(t('groups.updated', { name: group.name }), () => dispatch({ type: 'replaceGroup', group }));
        }}
        onDelete={(id) => {
          const index = settings.groups.findIndex((item) => item.id === id);
          const group = settings.groups[index];
          dispatch({ type: 'deleteGroup', id });
          if (group)
            withUndo(t('groups.deleted', { name: group.name }), () => dispatch({ type: 'restoreGroup', group, index }));
        }}
        onClose={() => setDialog(null)}
      />
      <SiteAccessDialog
        open={dialog === 'access'}
        url={currentUrl}
        siteAllowed={siteAccess.site}
        allSites={siteAccess.allSites}
        granted={siteAccess.granted}
        onAllowSite={() => void allowSite()}
        onAllowAll={() => void allowAllSites()}
        onRevoke={(patterns) => void siteAccess.revoke(patterns)}
        onClose={() => setDialog(null)}
      />
      <CaptureDialog
        open={dialog === 'capture'}
        onAllow={() => void allowCapture()}
        onClose={() => {
          pendingCapture.current = null;
          setDialog(null);
        }}
      />
      <SettingsDialog
        open={dialog === 'settings'}
        settings={settings}
        version={version}
        onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
        onLanguage={(language) => dispatch({ type: 'setLanguage', language })}
        onBreakpoints={(breakpoints) => dispatch({ type: 'setBreakpoints', breakpoints })}
        onRulers={(showRulers) => dispatch({ type: 'setShowRulers', showRulers })}
        onEmbedHints={(embedHints) => dispatch({ type: 'setEmbedHints', embedHints })}
        onRememberRecent={(rememberRecent) => dispatch({ type: 'setRememberRecent', rememberRecent })}
        onClearRecent={() => {
          dispatch({ type: 'clearRecent' });
          toast({ message: t('settings.recentCleared'), tone: 'success' });
        }}
        onExport={exportSettings}
        onImport={(file) => void importSettings(file)}
        onReset={resetWorkspace}
        onManageAccess={() => setDialog('access')}
        onOpenShortcuts={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        onClose={() => setDialog(null)}
      />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} commandShortcuts={commandShortcuts} />
    </div>
  );
}
