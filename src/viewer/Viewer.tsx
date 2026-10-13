import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddViewportDialog } from '../components/DevicePresetPicker/AddViewportDialog';
import { Button } from '../components/Button/Button';
import { CaptureDialog } from '../components/CaptureDialog/CaptureDialog';
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
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { resolveLanguage } from '../i18n/translate';
import type { PreviewAdapter } from '../services/preview-adapter';
import { canCapture, captureElement, requestCapturePermission } from '../services/screenshot';
import { createSettingsExport, defaultViewports, parseSettingsImport } from '../services/storage';
import { fitZoomForAll } from '../state/fit';
import { createGroup, findGroupTemplates } from '../state/groups';
import type { SettingsAction } from '../state/settings-reducer';
import { canAddViewport, fromTemplates, setZoomForAll, stepZoom } from '../state/viewports';
import type { ThemePreference, ViewportConfig, ViewportLabSettings } from '../types';
import { downloadBlob, fileNamePart, timestamp } from '../utils/download';
import { displayHost, parsePreviewUrl, type UrlParseError } from '../utils/url';
import { TopBar } from './TopBar';
import styles from './Viewer.module.css';

const URL_ERRORS: Record<UrlParseError, MessageKey> = {
  empty: 'url.error.empty',
  'unsupported-scheme': 'url.error.unsupported',
  invalid: 'url.error.invalid',
};

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];
const WORKSPACE_GAP = 20;
const WORKSPACE_PADDING = 24;
const DEFAULT_CARD_CHROME_HEIGHT = 86;

type DialogName = 'add' | 'saveGroup' | 'manageGroups' | 'access' | 'capture' | 'settings' | 'help';

type ProbeState = 'idle' | 'checking' | 'reachable' | 'unreachable' | 'unknown';

export type ViewerProps = {
  initialSettings: ViewportLabSettings;
  initialUrl: URL | null;
  initialInput: string;
  initialError: UrlParseError | null;
  adapter: PreviewAdapter;
  version: string;
  /** No settings were stored yet: fit the default viewports once a page loads. */
  firstRun: boolean;
};

export function ViewerApp(props: ViewerProps) {
  const [settings, dispatch] = usePersistentSettings(props.initialSettings);
  const language = resolveLanguage(settings.language);
  useTheme(settings.theme);

  return (
    <I18nProvider language={language}>
      <ToastProvider>
        <Workspace {...props} settings={settings} dispatch={dispatch} />
      </ToastProvider>
    </I18nProvider>
  );
}

type WorkspaceProps = ViewerProps & {
  settings: ViewportLabSettings;
  dispatch: (action: SettingsAction) => void;
};

function Workspace({
  settings,
  dispatch,
  adapter,
  initialUrl,
  initialInput,
  initialError,
  version,
  firstRun,
}: WorkspaceProps) {
  const { t } = useI18n();
  const toast = useToast();

  const [address, setAddress] = useState(initialUrl?.href ?? initialInput);
  const [addressError, setAddressError] = useState<MessageKey | null>(initialError ? URL_ERRORS[initialError] : null);
  const [currentUrl, setCurrentUrl] = useState<URL | null>(initialUrl);
  const [probeRun, setProbeRun] = useState(0);
  const [probeResult, setProbeResult] = useState<{ key: string; kind: ProbeState } | null>(null);
  const [showAnyway, setShowAnyway] = useState(false);
  const [reloadAll, setReloadAll] = useState(0);
  const [cardReloads, setCardReloads] = useState<Record<string, number>>({});
  const [dismissedHost, setDismissedHost] = useState<string | null>(null);
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
        setAddressError(URL_ERRORS[result.error]);
        addressRef.current?.focus();
        return;
      }
      const url = result.url;
      setAddressError(null);
      setAddress(url.href);
      setShowAnyway(false);
      setDismissedHost(null);
      if (currentUrl?.href === url.href) setReloadAll((n) => n + 1);
      setCurrentUrl(url);
      setProbeRun((n) => n + 1);
      dispatch({ type: 'visitUrl', url: url.href });
      history.replaceState(null, '', `?${new URLSearchParams({ url: url.href })}`);
    },
    [currentUrl, dispatch],
  );

  useEffect(() => {
    document.title = host ? `${host} — ViewportLab` : 'ViewportLab';
  }, [host]);

  // Reachability of the current address; a new address or retry starts a new check.
  const probeKey = currentUrl ? `${currentUrl.href}#${probeRun}` : null;
  const probe: ProbeState = !probeKey ? 'idle' : probeResult?.key === probeKey ? probeResult.kind : 'checking';

  useEffect(() => {
    if (!currentUrl || !probeKey) return;
    let cancelled = false;
    void adapter.probe(currentUrl).then((result) => {
      if (!cancelled) setProbeResult({ key: probeKey, kind: result.kind });
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, currentUrl, probeKey]);

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
    const previous = viewports;
    dispatch({ type: 'removeViewport', id: vp.id });
    withUndo(t('toast.removed', { name: vp.name }), () => dispatch({ type: 'replaceViewports', viewports: previous }));
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
        { width: element.clientWidth - WORKSPACE_PADDING * 2, height: element.clientHeight - top - WORKSPACE_PADDING },
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
  const autoFitPending = useRef(firstRun);
  useEffect(() => {
    if (!autoFitPending.current || !currentUrl) return;
    const frame = requestAnimationFrame(() => {
      autoFitPending.current = false;
      fit();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentUrl, fit]);

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
    const granted = await siteAccess.allowSite();
    if (granted) {
      toast({ message: t('access.granted', { host: displayHost(currentUrl) }), tone: 'success' });
      setReloadAll((n) => n + 1);
    } else {
      toast({ message: t('access.denied'), tone: 'error' });
    }
  };

  const allowAllSites = async () => {
    const granted = await siteAccess.allowAllSites();
    if (granted) {
      toast({ message: t('access.grantedAll'), tone: 'success' });
      setReloadAll((n) => n + 1);
    } else {
      toast({ message: t('access.denied'), tone: 'error' });
    }
  };

  /* ---------- Screenshots ---------- */

  const runCapture = async (element: HTMLElement, label: string[]) => {
    const parts = ['viewportlab', host ?? 'page', ...label].map(fileNamePart);
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
    setReloadAll((n) => n + 1);
    // Let the dialog close and the previews reload before capturing.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await pending?.();
  };

  /* ---------- Settings data ---------- */

  const exportSettings = () => {
    const data = JSON.stringify(createSettingsExport(settings), null, 2);
    downloadBlob(new Blob([data], { type: 'application/json' }), `viewportlab-settings_${timestamp()}.json`);
  };

  const importSettings = async (file: File) => {
    try {
      const imported = parseSettingsImport(JSON.parse(await file.text()), settings);
      if (!imported) throw new Error('Not a ViewportLab export');
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

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(settings.theme) + 1) % THEME_CYCLE.length]!;
    dispatch({ type: 'setTheme', theme: next });
  };

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
    theme: cycleTheme,
    help: () => setDialog('help'),
  });

  // Signals that the workspace is interactive (used by end-to-end tests).
  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  /* ---------- Render ---------- */

  const src = currentUrl?.href ?? null;
  // Chrome doesn't tell the page when a frame was refused, so the tip shows
  // for any site that isn't allowed yet (unless the site is simply unreachable).
  const showNotice = Boolean(
    currentUrl &&
    settings.embedHints &&
    siteAccess.site === false &&
    probe !== 'unreachable' &&
    dismissedHost !== currentUrl.hostname,
  );

  const renderCards = () => (
    <div className={styles.cards} data-layout={settings.layout} data-cards>
      {visible.map((vp, index) => (
        <ViewportCard
          key={vp.id}
          viewport={vp}
          src={src}
          reloadKey={reloadAll * 1000 + (cardReloads[vp.id] ?? 0)}
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
            else toast({ message: t('window.opened', size), tone: 'success' });
          }}
          onDuplicate={() => {
            dispatch({ type: 'duplicateViewport', id: vp.id });
            toast({ message: t('toast.duplicated', { name: vp.name }), tone: 'success' });
          }}
          onHide={() => dispatch({ type: 'updateViewport', id: vp.id, patch: { hidden: true } })}
          onRemove={() => removeViewport(vp)}
        />
      ))}
    </div>
  );

  const renderContent = () => {
    if (currentUrl && probe === 'unreachable' && !showAnyway) {
      return (
        <ErrorState
          icon="alert"
          tone="danger"
          title={t('error.unreachableTitle', { host: host ?? '' })}
          body={t('error.unreachableBody')}
        >
          <Button variant="primary" icon="reload" onClick={() => setProbeRun((n) => n + 1)}>
            {t('error.retry')}
          </Button>
          <Button icon="external" onClick={() => void adapter.openInTab(currentUrl.href)}>
            {t('access.noticeOpen')}
          </Button>
          <Button variant="ghost" onClick={() => setShowAnyway(true)}>
            {t('error.showAnyway')}
          </Button>
        </ErrorState>
      );
    }
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
        theme={settings.theme}
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
        onCycleTheme={cycleTheme}
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
      {showNotice && host && currentUrl && (
        <EmbedNotice
          host={host}
          onAllow={() => void allowSite()}
          onOpenInTab={() => void adapter.openInTab(currentUrl.href)}
          onDismiss={() => setDismissedHost(currentUrl.hostname)}
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
          if (group) toast({ message: t('groups.updated', { name: group.name }), tone: 'success' });
        }}
        onDelete={(id) => {
          const group = settings.groups.find((item) => item.id === id);
          const previous = settings.groups;
          dispatch({ type: 'deleteGroup', id });
          if (group)
            withUndo(t('groups.deleted', { name: group.name }), () =>
              dispatch({ type: 'replaceGroups', groups: previous }),
            );
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
