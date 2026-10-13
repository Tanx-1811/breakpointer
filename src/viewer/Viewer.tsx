import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CheckKind } from '../agent/protocol';
import { AddViewportDialog } from '../components/DevicePresetPicker/AddViewportDialog';
import { Button } from '../components/Button/Button';
import { CaptureDialog } from '../components/CaptureDialog/CaptureDialog';
import { Banner } from '../components/Banner/Banner';
import { EmbedNotice } from '../components/EmbedNotice/EmbedNotice';
import { ErrorState } from '../components/ErrorState/ErrorState';
import { ManageGroupsDialog, SaveGroupDialog } from '../components/GroupDialogs/GroupDialogs';
import { HelpDialog } from '../components/HelpDialog/HelpDialog';
import { LiveCssDialog } from '../components/LiveCssDialog/LiveCssDialog';
import { RULER_SIZE } from '../components/Ruler/Ruler';
import { SettingsDialog } from '../components/SettingsDialog/SettingsDialog';
import { SiteAccessDialog } from '../components/SiteAccessDialog/SiteAccessDialog';
import { ToastProvider, useToast } from '../components/Toast/Toast';
import { CARD_CHROME_WIDTH, MIN_CARD_WIDTH, ViewportCard } from '../components/ViewportCard/ViewportCard';
import { Welcome } from '../components/Welcome/Welcome';
import { WorkspaceBar } from '../components/WorkspaceBar/WorkspaceBar';
import { useFrameAgents } from '../hooks/useFrameAgents';
import { usePersistentSettings } from '../hooks/usePersistentSettings';
import { useShortcuts } from '../hooks/useShortcuts';
import { useSiteAccess } from '../hooks/useSiteAccess';
import { useStableDomOrder } from '../hooks/useStableDomOrder';
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { resolveLanguage, type Language } from '../i18n/translate';
import type { PreviewAdapter } from '../services/preview-adapter';
import {
  blobToDataUrl,
  canCapture,
  captureElement,
  captureElementImage,
  requestCapturePermission,
} from '../services/screenshot';
import { frameName } from '../services/frame-agents';
import { loadDismissedNoticeHosts, saveDismissedNoticeHosts } from '../services/session-state';
import { createSettingsExport, defaultViewports, parseSettingsFile } from '../services/storage';
import { breakpointEdges, breakpointFor } from '../data/breakpoints';
import { fitZoomForAll } from '../state/fit';
import { isOneTimeUrl, pageOf } from '../state/follow';
import { buildReportHtml, type ReportCard } from '../state/report';
import { createGroup, findGroupTemplates, uniqueGroupName } from '../state/groups';
import type { SettingsAction } from '../state/settings-reducer';
import {
  canAddViewport,
  createViewport,
  fromTemplates,
  rotateVisible,
  setZoomForAll,
  stepZoom,
} from '../state/viewports';
import type { ViewportConfig, BreakpointerSettings } from '../types';
import { MAX_VIEWPORTS } from '../utils/constants';
import { downloadBlob, fileNamePart, timestamp } from '../utils/download';
import { URL_ERROR_KEYS } from '../i18n/url-errors';
import { shortHash } from '../utils/hash';
import { displayHost, isLocalHost, parsePreviewUrl, toSafeHref, type UrlParseError } from '../utils/url';
import { TopBar, type ToolToggle } from './TopBar';
import { usePan, useWheelZoom } from './workspace-gestures';
import styles from './Viewer.module.css';

const WORKSPACE_GAP = 20;
const WORKSPACE_PADDING = 24;
const DEFAULT_CARD_CHROME_HEIGHT = 86;
/** Pixels kept free when fitting, so rounding never pushes a card onto a new row. */
const FIT_SLACK = 2;

type DialogName = 'add' | 'saveGroup' | 'manageGroups' | 'access' | 'capture' | 'settings' | 'help' | 'css';

/** Height of the viewports made by "Test breakpoint edges". */
const EDGE_VIEWPORT_HEIGHT = 800;

type ProbeState = 'idle' | 'checking' | 'reachable' | 'unreachable' | 'unknown';

export type ViewerProps = {
  initialSettings: BreakpointerSettings;
  initialUrl: URL | null;
  initialInput: string;
  initialError: UrlParseError | null;
  adapter: PreviewAdapter;
  /** This workspace tab, for messages from the agents in its preview frames. */
  tabId: number | null;
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
        <Workspace
          {...props}
          settings={settings}
          dispatch={dispatch}
          resolvedTheme={resolvedTheme}
          language={language}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

type WorkspaceProps = ViewerProps & {
  settings: BreakpointerSettings;
  dispatch: (action: SettingsAction) => void;
  resolvedTheme: 'light' | 'dark';
  language: Language;
};

function Workspace({
  settings,
  dispatch,
  adapter,
  tabId,
  initialUrl,
  initialInput,
  initialError,
  version,
  autoFit,
  resolvedTheme,
  language,
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
  // Synced navigation: a card that led a navigation keeps its own frame (its
  // address is pinned), and cards whose page moved without the others following
  // are "strays" ("Navigated away · Back").
  const [srcOverrides, setSrcOverrides] = useState<Record<string, string>>({});
  const [strays, setStrays] = useState<Record<string, boolean>>({});
  // Inspection tools for this session (not saved).
  const [outlines, setOutlines] = useState(false);
  const [liveCss, setLiveCss] = useState('');
  const [highlights, setHighlights] = useState<Record<string, CheckKind | null>>({});
  const [commandShortcuts, setCommandShortcuts] = useState({ open: '', preview: '' });

  const addressRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const pendingCapture = useRef<(() => Promise<void>) | null>(null);

  const siteAccess = useSiteAccess(currentUrl);
  const { viewports } = settings;
  const visible = useMemo(() => viewports.filter((vp) => !vp.hidden), [viewports]);
  // The zoom all visible viewports share (e.g. after Fit), if any.
  const commonZoom =
    visible.length > 0 && visible.every((vp) => vp.zoom === visible[0]!.zoom) ? visible[0]!.zoom : null;
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
      setSrcOverrides({});
      setStrays({});
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
    const position = visible.findIndex((item) => item.id === vp.id);
    const neighbour = visible[position + 1] ?? visible[position - 1];
    dispatch({ type: 'removeViewport', id: vp.id });
    // The focused Remove button disappears with its card: keep focus nearby.
    requestAnimationFrame(() => {
      const target = neighbour
        ? document.querySelector<HTMLElement>(`[data-viewport-id="${CSS.escape(neighbour.id)}"] [aria-haspopup="menu"]`)
        : document.querySelector<HTMLElement>('[data-add-viewport]');
      target?.focus();
    });
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
  const fitOnStart = useRef(autoFit !== 'none');
  // First run without a page: fit again once a page replaces the welcome panel.
  const fitAfterFirstPage = useRef(autoFit === 'afterFirstPage' && !initialUrl);
  useEffect(() => {
    if (!fitOnStart.current && !(fitAfterFirstPage.current && currentUrl)) return;
    // Wait until the site-access tip (which takes space) has been decided.
    if (currentUrl && siteAccess.site === null) return;
    const frame = requestAnimationFrame(() => {
      fitOnStart.current = false;
      if (currentUrl) fitAfterFirstPage.current = false;
      fit();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentUrl, fit, siteAccess.site]);

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

  // Only one Chrome permission prompt at a time; buttons are disabled meanwhile.
  const [requesting, setRequesting] = useState(false);
  const requestingRef = useRef(false);
  /** Runs `request` (called synchronously, so it keeps the click's user gesture); false if one is already open. */
  const withPrompt = async (request: () => Promise<boolean>): Promise<boolean | null> => {
    if (requestingRef.current) return null;
    requestingRef.current = true;
    setRequesting(true);
    try {
      return await request();
    } catch {
      return false;
    } finally {
      requestingRef.current = false;
      setRequesting(false);
    }
  };

  const allowSite = async () => {
    if (!currentUrl) return;
    const granted = await withPrompt(() => siteAccess.allowSite());
    if (granted === null) return;
    if (granted) {
      toast({ message: t('access.granted', { host: displayHost(currentUrl) }), tone: 'success' });
      reloadAllPreviews();
    } else {
      toast({ message: t('access.denied'), tone: 'error' });
    }
  };

  const allowAllSites = async () => {
    const granted = await withPrompt(() => siteAccess.allowAllSites());
    if (granted === null) return;
    if (granted) {
      toast({ message: t('access.grantedAll'), tone: 'success' });
      reloadAllPreviews();
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
    const granted = await withPrompt(() => requestCapturePermission());
    if (granted === null) return;
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
      action: { label: t('common.reload'), onAction: () => reloadAllPreviews() },
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
    reload: () => currentUrl && reloadAllPreviews(),
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

  // A page opened from the popup, context menu, command or keyword (?url=) counts as a visit.
  const recordedInitialVisit = useRef(false);
  useEffect(() => {
    if (recordedInitialVisit.current || !initialUrl) return;
    recordedInitialVisit.current = true;
    dispatch({ type: 'visitUrl', url: initialUrl.href });
  }, [dispatch, initialUrl]);

  // Signals that the workspace is interactive (used by end-to-end tests).
  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  /* ---------- Render ---------- */

  const src = currentUrl?.href ?? null;
  // Cards stay in a stable DOM order (moving an iframe reloads it); CSS `order` places them.
  const domOrder = useStableDomOrder(visible.map((vp) => vp.id));

  // A hidden or removed card loses its frame: when it comes back it shows the
  // workspace's page, so forget what was pinned or flagged for it.
  const visibleKey = visible.map((vp) => vp.id).join(' ');
  const [prunedFor, setPrunedFor] = useState(visibleKey);
  if (prunedFor !== visibleKey) {
    setPrunedFor(visibleKey);
    const ids = new Set(visible.map((vp) => vp.id));
    const keepVisible = <T,>(map: Record<string, T>) =>
      Object.keys(map).every((id) => ids.has(id))
        ? map
        : Object.fromEntries(Object.entries(map).filter(([id]) => ids.has(id)));
    setSrcOverrides(keepVisible);
    setStrays(keepVisible);
  }

  /* ---------- Frame agents (sync, checks, inspection) ---------- */

  const cardSrc = (id: string) => srcOverrides[id] ?? src;
  const cardReloadKey = (id: string) => `${reloadAll}.${cardReloads[id] ?? 0}`;
  // A frame's generation changes whenever it is replaced (new address or reload).
  const generations = useMemo(() => {
    const map: Record<string, string> = {};
    for (const vp of visible) {
      const page = srcOverrides[vp.id] ?? src;
      if (page) map[vp.id] = shortHash(`${page}#${reloadAll}.${cardReloads[vp.id] ?? 0}`);
    }
    return map;
  }, [visible, srcOverrides, src, reloadAll, cardReloads]);

  // The page the previews follow, updated at once: several previews can report
  // the same navigation (e.g. a redirect) before the next render.
  const followedUrl = useRef<string | null>(currentUrl?.href ?? null);
  useLayoutEffect(() => {
    followedUrl.current = currentUrl?.href ?? null;
  }, [currentUrl]);

  /**
   * Follow a page that one preview navigated to: the others load it, that one
   * keeps its frame. False when it can't be followed.
   */
  const followFrame = (cardId: string, href: string): boolean => {
    const next = toSafeHref(href);
    const current = followedUrl.current;
    if (!next || !current) return false;
    // Moving within the page (e.g. a table of contents updating #section) isn't a new page.
    if (pageOf(next) === pageOf(current)) return true;
    // Sign-in callbacks and other one-time links must not load again in every preview.
    if (isOneTimeUrl(next)) return false;
    followedUrl.current = next;
    setSrcOverrides((overrides) => ({ [cardId]: overrides[cardId] ?? current }));
    setStrays({});
    setCurrentUrl(new URL(next));
    setAddress(next);
    setAddressError(null);
    setProbeRun((n) => n + 1);
    dispatch({ type: 'visitUrl', url: next });
    history.replaceState(null, '', `?${new URLSearchParams({ url: next })}`);
    return true;
  };

  const agents = useFrameAgents(tabId, generations, {
    onHello: (cardId) => {
      agents.send(cardId, { type: 'checks', enabled: settings.checks });
      if (outlines) agents.send(cardId, { type: 'outlines', on: true });
      if (liveCss) agents.send(cardId, { type: 'css', css: liveCss });
      setHighlights((map) => (map[cardId] ? { ...map, [cardId]: null } : map));
    },
    onNavigate: (cardId, href, { user, newDocument }) => {
      // The page tidying its own address (e.g. dropping tracking parameters) isn't a navigation.
      if (!user && !newDocument) return;
      // Only what the user did is followed: redirects a page makes by itself (e.g.
      // sending narrow screens to /m/) stay in that preview.
      if (user && settings.sync.navigation && followFrame(cardId, href)) return;
      const current = followedUrl.current;
      const stray = !current || pageOf(href) !== pageOf(current);
      setStrays((map) => (Boolean(map[cardId]) === stray ? map : { ...map, [cardId]: stray }));
    },
    onScroll: (cardId, ratio) => {
      if (settings.sync.scroll) agents.broadcast({ type: 'scrollTo', ratio }, cardId);
    },
    onZoom: (direction) => dispatch({ type: 'setZoomForAll', zoom: stepZoom(viewports, direction) }),
  });
  const { broadcast } = agents;

  // Keep every connected frame in step with the tools (new frames get them on hello).
  useEffect(() => broadcast({ type: 'checks', enabled: settings.checks }), [broadcast, settings.checks]);
  useEffect(() => broadcast({ type: 'outlines', on: outlines }), [broadcast, outlines]);
  useEffect(() => broadcast({ type: 'css', css: liveCss }), [broadcast, liveCss]);

  const reloadAllPreviews = () => {
    setSrcOverrides({});
    setStrays({});
    setReloadAll((n) => n + 1);
  };
  const reloadCard = (id: string) => {
    setSrcOverrides(({ [id]: _dropped, ...rest }) => rest);
    setStrays(({ [id]: _stray, ...rest }) => rest);
    setCardReloads((map) => ({ ...map, [id]: (map[id] ?? 0) + 1 }));
  };
  const highlight = (cardId: string, kind: CheckKind | null) => {
    setHighlights((map) => ({ ...map, [cardId]: kind }));
    agents.send(cardId, { type: 'highlight', kind });
  };

  /* ---------- Tools ---------- */

  /** Tools that run inside the preview need the site's permission: offer it. */
  const hintAccess = (feature: string) => {
    if (!currentUrl || siteAccess.site !== false) return;
    toast({
      message: t('tools.needsAccess', { feature, host: displayHost(currentUrl) }),
      tone: 'info',
      key: 'tools-access',
      action: { label: t('tools.allow'), onAction: () => void allowSite() },
    });
  };

  const toggleTool = (tool: ToolToggle) => {
    switch (tool) {
      case 'syncScroll': {
        const on = !settings.sync.scroll;
        dispatch({ type: 'setSync', sync: { scroll: on } });
        if (on) hintAccess(t('tools.syncScroll'));
        break;
      }
      case 'syncNavigation': {
        const on = !settings.sync.navigation;
        dispatch({ type: 'setSync', sync: { navigation: on } });
        if (on) hintAccess(t('tools.syncNavigation'));
        break;
      }
      case 'checks':
        setChecks(!settings.checks);
        break;
      case 'outlines': {
        const on = !outlines;
        setOutlines(on);
        if (on) hintAccess(t('tools.outlines'));
        break;
      }
      case 'grid':
        dispatch({ type: 'setGrid', grid: { show: !settings.grid.show } });
        break;
    }
  };

  const setChecks = (on: boolean) => {
    dispatch({ type: 'setChecks', checks: on });
    if (on) hintAccess(t('tools.checks'));
    else setHighlights({});
  };

  const setSyncAll = (on: boolean) => {
    dispatch({ type: 'setSync', sync: { scroll: on, navigation: on } });
    if (on) hintAccess(t('workspace.sync'));
  };

  const applyLiveCss = (css: string) => {
    setLiveCss(css);
    setDialog(null);
    toast({ message: css ? t('css.applied') : t('css.cleared'), tone: 'success', key: 'live-css' });
    if (css) hintAccess(t('css.title'));
  };

  const testEdges = () => {
    const edges = breakpointEdges(settings.breakpoints, settings.customBreakpoints, MAX_VIEWPORTS);
    if (edges.length === 0) {
      toast({ message: t('tools.noEdges'), tone: 'info' });
      return;
    }
    let next = edges.map((edge) =>
      createViewport({ name: edge.name, width: edge.width, height: EDGE_VIEWPORT_HEIGHT }),
    );
    const zoom = computeFitZoom(next);
    if (zoom !== null) next = setZoomForAll(next, zoom);
    replaceViewports(
      next,
      next.length === 1 ? t('tools.edgesAppliedOne') : t('tools.edgesApplied', { count: next.length }),
    );
  };

  const rotateAll = () => {
    const count = visible.filter((vp) => vp.width !== vp.height).length;
    if (count === 0) {
      toast({ message: t('tools.nothingToRotate'), tone: 'info' });
      return;
    }
    replaceViewports(rotateVisible(viewports), count === 1 ? t('tools.rotatedOne') : t('tools.rotated', { count }));
  };

  const toggleSaved = () => {
    if (!currentUrl) return;
    const saved = settings.savedPages.includes(currentUrl.href);
    dispatch({ type: 'toggleSavedPage', url: currentUrl.href });
    toast({
      message: t(saved ? 'pages.removed' : 'pages.saved', { host: displayHost(currentUrl) }),
      tone: 'success',
      key: 'saved-page',
    });
  };

  /* ---------- Report ---------- */

  const [reporting, setReporting] = useState(false);

  const runReport = async () => {
    if (!currentUrl) return;
    const list = visible;
    setReporting(true);
    try {
      const cards: ReportCard[] = [];
      for (const [index, vp] of list.entries()) {
        toast({
          message: t('report.progress', { current: index + 1, total: list.length }),
          tone: 'info',
          key: 'report',
        });
        const stage = document.querySelector<HTMLElement>(`[data-viewport-id="${CSS.escape(vp.id)}"] [data-stage]`);
        const shot = stage ? await captureElementImage(stage, 'image/jpeg') : null;
        cards.push({
          name: vp.name,
          width: vp.width,
          height: vp.height,
          zoom: vp.zoom,
          breakpoint: breakpointFor(settings.breakpoints, vp.width, settings.customBreakpoints),
          image: shot ? await blobToDataUrl(shot.blob) : null,
          checks: settings.checks ? (agents.frameOf(vp.id)?.report ?? null) : null,
        });
      }
      const title = list.map((vp) => agents.frameOf(vp.id)?.title).find(Boolean) ?? displayHost(currentUrl);
      const html = buildReportHtml({ url: currentUrl.href, title, created: new Date(), version, language, cards }, t);
      const fileName = `breakpointer-report_${fileNamePart(displayHost(currentUrl))}_${timestamp()}.html`;
      downloadBlob(new Blob([html], { type: 'text/html' }), fileName);
      toast({ message: t('report.saved', { file: fileName }), tone: 'success', key: 'report' });
    } catch (error) {
      console.warn('[Breakpointer] Report failed.', error);
      toast({ message: t('report.failed'), tone: 'error', key: 'report' });
    } finally {
      setReporting(false);
    }
  };

  const exportReport = async () => {
    if (!currentUrl || reporting) return;
    if (visible.length === 0) {
      toast({ message: t('report.nothing'), tone: 'info' });
      return;
    }
    if (await canCapture()) {
      await runReport();
      return;
    }
    pendingCapture.current = runReport;
    setDialog('capture');
  };

  /* ---------- Gestures ---------- */

  useWheelZoom(workspaceRef, (direction) => dispatch({ type: 'setZoomForAll', zoom: stepZoom(viewports, direction) }));
  const panLayer = usePan(workspaceRef);

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
            src={cardSrc(vp.id)}
            reloadKey={cardReloadKey(vp.id)}
            frameName={generations[vp.id] === undefined ? undefined : frameName(vp.id, generations[vp.id]!)}
            navigatedAway={agents.frameOf(vp.id) ? strays[vp.id] === true : undefined}
            index={index}
            count={visible.length}
            canDuplicate={canAddViewport(viewports)}
            breakpointSet={settings.breakpoints}
            customBreakpoints={settings.customBreakpoints}
            grid={settings.grid}
            checks={settings.checks ? (agents.frameOf(vp.id)?.report ?? null) : null}
            highlighted={highlights[vp.id] ?? null}
            onHighlight={(kind) => highlight(vp.id, kind)}
            showRulers={settings.showRulers}
            onRename={(name) => dispatch({ type: 'updateViewport', id: vp.id, patch: { name } })}
            onResize={(size) => dispatch({ type: 'updateViewport', id: vp.id, patch: size })}
            onZoom={(zoom) => dispatch({ type: 'updateViewport', id: vp.id, patch: { zoom } })}
            onRotate={() => dispatch({ type: 'rotateViewport', id: vp.id })}
            onMove={(delta) => moveVisible(vp, delta)}
            onReload={() => reloadCard(vp.id)}
            onCapture={(stage) =>
              // The image is taken as shown on screen, so the name says at which zoom.
              void capture(stage, [vp.name, `${vp.width}x${vp.height}`, `${Math.round(vp.zoom * 100)}pct`])
            }
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
        onReloadAll={reloadAllPreviews}
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
        host={host}
        savedPages={settings.savedPages}
        saved={Boolean(currentUrl && settings.savedPages.includes(currentUrl.href))}
        onToggleSaved={toggleSaved}
        tools={{
          syncScroll: settings.sync.scroll,
          syncNavigation: settings.sync.navigation,
          checks: settings.checks,
          outlines,
          grid: settings.grid.show,
          liveCss: Boolean(liveCss),
        }}
        onTool={toggleTool}
        onLiveCss={() => setDialog('css')}
        onEdges={testEdges}
        onRotateAll={rotateAll}
        onReport={() => void exportReport()}
        onAllowSite={() => void allowSite()}
      />
      <WorkspaceBar
        viewports={viewports}
        layout={settings.layout}
        breakpoints={settings.breakpoints}
        showRulers={settings.showRulers}
        sync={settings.sync.scroll || settings.sync.navigation}
        showGrid={settings.grid.show}
        onSync={setSyncAll}
        onGrid={(show) => dispatch({ type: 'setGrid', grid: { show } })}
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
                  reloadAllPreviews();
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
          busy={requesting}
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
      {panLayer && (
        <div
          className={styles.panLayer}
          style={panLayer.style}
          data-dragging={panLayer.dragging || undefined}
          data-testid="pan-layer"
          aria-hidden="true"
          onPointerDown={panLayer.onPointerDown}
          onPointerMove={panLayer.onPointerMove}
          onPointerUp={panLayer.onPointerUp}
          onPointerCancel={panLayer.onPointerUp}
        />
      )}

      <AddViewportDialog
        open={dialog === 'add'}
        canAdd={canAddViewport(viewports)}
        onAdd={(viewport) => {
          dispatch({
            type: 'addViewport',
            viewport: commonZoom === null ? viewport : { ...viewport, zoom: commonZoom },
          });
          toast({ message: t('add.added', { name: viewport.name }), tone: 'success', key: 'added' });
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />
      <SaveGroupDialog
        open={dialog === 'saveGroup'}
        viewportCount={viewports.length}
        groupCount={settings.groups.length}
        onSave={(requested) => {
          const name = uniqueGroupName(requested, settings.groups);
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
        busy={requesting}
        onAllowSite={() => void allowSite()}
        onAllowAll={() => void allowAllSites()}
        onRevoke={(patterns) =>
          void siteAccess.revoke(patterns).then((removed) => {
            if (!removed) toast({ message: t('access.revokeFailed'), tone: 'error' });
          })
        }
        onClose={() => setDialog(null)}
      />
      <CaptureDialog
        open={dialog === 'capture'}
        busy={requesting}
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
        onCustomBreakpoints={(breakpoints) => dispatch({ type: 'setCustomBreakpoints', breakpoints })}
        onSync={(sync) => dispatch({ type: 'setSync', sync })}
        onChecks={setChecks}
        onGrid={(grid) => dispatch({ type: 'setGrid', grid })}
        onOpenSaved={(url) => {
          setDialog(null);
          navigate(url);
        }}
        onRemoveSaved={(url) => dispatch({ type: 'removeSavedPage', url })}
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
      <LiveCssDialog
        open={dialog === 'css'}
        css={liveCss}
        host={host}
        siteAllowed={siteAccess.site}
        busy={requesting}
        onApply={applyLiveCss}
        onClear={() => applyLiveCss('')}
        onAllowSite={() => void allowSite()}
        onClose={() => setDialog(null)}
      />
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} commandShortcuts={commandShortcuts} />
    </div>
  );
}
