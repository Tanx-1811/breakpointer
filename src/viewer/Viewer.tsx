import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CheckKind, ElementInfo, MediaReport } from '../agent/protocol';
import { AddViewportDialog } from '../components/DevicePresetPicker/AddViewportDialog';
import { Button } from '../components/Button/Button';
import { CaptureDialog } from '../components/CaptureDialog/CaptureDialog';
import { Banner } from '../components/Banner/Banner';
import { CommandPalette, type PaletteCommand } from '../components/CommandPalette/CommandPalette';
import { EmbedNotice } from '../components/EmbedNotice/EmbedNotice';
import { ErrorState } from '../components/ErrorState/ErrorState';
import { ManageGroupsDialog, SaveGroupDialog } from '../components/GroupDialogs/GroupDialogs';
import { HelpDialog } from '../components/HelpDialog/HelpDialog';
import { InspectorPanel, type InspectorRow } from '../components/Inspector/InspectorPanel';
import { LiveCssDialog } from '../components/LiveCssDialog/LiveCssDialog';
import { RULER_SIZE } from '../components/Ruler/Ruler';
import { SettingsDialog } from '../components/SettingsDialog/SettingsDialog';
import { SiteAccessDialog } from '../components/SiteAccessDialog/SiteAccessDialog';
import { ToastProvider, useToast } from '../components/Toast/Toast';
import { TooltipLayer } from '../components/Tooltip/TooltipLayer';
import { CARD_CHROME_WIDTH, MIN_CARD_WIDTH, ViewportCard } from '../components/ViewportCard/ViewportCard';
import { Welcome } from '../components/Welcome/Welcome';
import { WorkspaceBar, type ToolToggle } from '../components/WorkspaceBar/WorkspaceBar';
import { DockStatus, ZoomDock } from '../components/ZoomDock/ZoomDock';
import { useFrameAgents } from '../hooks/useFrameAgents';
import { useNavigationHistory } from '../hooks/useNavigationHistory';
import { usePersistentSettings } from '../hooks/usePersistentSettings';
import { useShortcuts } from '../hooks/useShortcuts';
import { useSiteAccess } from '../hooks/useSiteAccess';
import { useStableDomOrder } from '../hooks/useStableDomOrder';
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { createTranslator, resolveLanguage, type Language } from '../i18n/translate';
import { composeSheet, type SheetEntry } from '../services/composite';
import type { PreviewAdapter } from '../services/preview-adapter';
import {
  blobToDataUrl,
  canCapture,
  captureElement,
  captureElementImage,
  copyImageToClipboard,
  copyText,
  requestCapturePermission,
} from '../services/screenshot';
import { frameName } from '../services/frame-agents';
import { loadDismissedNoticeHosts, saveDismissedNoticeHosts } from '../services/session-state';
import { createSettingsExport, defaultViewports, parseSettingsFile } from '../services/storage';
import { breakpointEdges, breakpointFor, breakpointSet } from '../data/breakpoints';
import { fitZoomForAll } from '../state/fit';
import { isOneTimeUrl, pageOf } from '../state/follow';
import { buildReportHtml, type ReportCard } from '../state/report';
import { createGroup, findGroupTemplates, uniqueGroupName } from '../state/groups';
import type { SettingsAction } from '../state/settings-reducer';
import { sizeClassOf } from '../state/size-class';
import {
  canAddViewport,
  clampZoom,
  createViewport,
  fromTemplates,
  isSortedByWidth,
  nextZoom,
  rotateVisible,
  setZoomForAll,
  sortByWidth,
  stepZoom,
} from '../state/viewports';
import type { BreakpointSetId, ColorScheme, ViewportConfig, BreakpointerSettings, WorkspaceLayout } from '../types';
import { MAX_VIEWPORTS } from '../utils/constants';
import { downloadBlob, fileNamePart, timestamp } from '../utils/download';
import { modShortcut } from '../utils/platform';
import { URL_ERROR_KEYS } from '../i18n/url-errors';
import { shortHash } from '../utils/hash';
import {
  displayHost,
  isLocalHost,
  looksLikeAddress,
  parsePreviewUrl,
  toSafeHref,
  type UrlParseError,
} from '../utils/url';
import { buildCommands } from './commands';
import { TopBar, type CaptureKind } from './TopBar';
import { usePan, useWheelZoom } from './workspace-gestures';
import styles from './Viewer.module.css';

const WORKSPACE_GAP = 20;
const WORKSPACE_PADDING = 24;
/** Space kept free under the cards for the zoom dock. */
const WORKSPACE_BOTTOM = 92;
const DEFAULT_CARD_CHROME_HEIGHT = 72;
/** Pixels kept free when fitting, so rounding never pushes a card onto a new row. */
const FIT_SLACK = 2;

type DialogName = 'add' | 'saveGroup' | 'manageGroups' | 'access' | 'capture' | 'settings' | 'help' | 'css' | 'palette';

/** Height of the viewports made by "Test breakpoint edges". */
const EDGE_VIEWPORT_HEIGHT = 800;

type ProbeState = 'idle' | 'checking' | 'reachable' | 'unreachable' | 'unknown';

/** How a navigation is recorded in the workspace tab's history. */
type HistoryMode = 'push' | 'replace' | 'none';

type InspectorState = {
  open: boolean;
  /** Hovering a preview outlines elements; a click picks one. */
  picking: boolean;
  selector: string | null;
  /** Each card's answer, for the frame (generation) that gave it. */
  results: Record<string, { generation: string; info: ElementInfo | null }>;
};

const CLOSED_INSPECTOR: InspectorState = { open: false, picking: false, selector: null, results: {} };

export type ViewerProps = {
  initialSettings: BreakpointerSettings;
  initialUrl: URL | null;
  initialInput: string;
  initialError: UrlParseError | null;
  adapter: PreviewAdapter;
  /** This workspace tab, for messages from the agents in its preview frames. */
  tabId: number | null;
  version: string;
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
        <TooltipLayer />
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

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));

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
  const english = useMemo(() => createTranslator('en'), []);

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
  const [hideScrollbars, setHideScrollbars] = useState(false);
  const [liveCss, setLiveCss] = useState('');
  const [highlights, setHighlights] = useState<Record<string, CheckKind | null>>({});
  const [commandShortcuts, setCommandShortcuts] = useState({ open: '', preview: '' });
  // Focus mode: one viewport on its own, at its own zoom (nothing is saved).
  const [focus, setFocus] = useState<{ id: string; zoom: number } | null>(null);
  const [inspector, setInspector] = useState<InspectorState>(CLOSED_INSPECTOR);
  const [busy, setBusy] = useState<null | 'report' | 'sheet'>(null);

  const addressRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pendingCapture = useRef<(() => Promise<void>) | null>(null);

  const siteAccess = useSiteAccess(currentUrl);
  const navigation = useNavigationHistory();
  const { viewports } = settings;
  const visible = useMemo(() => viewports.filter((vp) => !vp.hidden), [viewports]);
  // The zoom all visible viewports share (e.g. after Fit), if any.
  const commonZoom =
    visible.length > 0 && visible.every((vp) => vp.zoom === visible[0]!.zoom) ? visible[0]!.zoom : null;
  const host = currentUrl ? displayHost(currentUrl) : null;
  const focused = focus && visible.some((vp) => vp.id === focus.id) ? focus : null;
  const paletteShortcut = modShortcut('K');

  /* ---------- Navigation ---------- */

  const resetInspection = useCallback(
    () => setInspector((state) => (state.selector ? { ...state, selector: null, results: {} } : state)),
    [],
  );

  /** Shows `url` in every preview and records it (address bar, recent pages, the tab's history). */
  const showPage = useCallback(
    (url: URL, mode: HistoryMode) => {
      setAddressError(null);
      setAddress(url.href);
      // A card that led a synced navigation still shows that page (its address was
      // pinned): load it afresh too, even when it is pinned to this very address.
      const pinned = Object.keys(srcOverrides);
      if (pinned.length)
        setCardReloads((map) => {
          const next = { ...map };
          for (const id of pinned) next[id] = (next[id] ?? 0) + 1;
          return next;
        });
      setSrcOverrides({});
      setStrays({});
      resetInspection();
      if (currentUrl?.href === url.href) setReloadAll((n) => n + 1);
      setCurrentUrl(url);
      setProbeRun((n) => n + 1);
      dispatch({ type: 'visitUrl', url: url.href });
      const search = `?${new URLSearchParams({ url: url.href })}`;
      if (mode === 'push' && currentUrl?.href !== url.href) history.pushState(null, '', search);
      else if (mode !== 'none') history.replaceState(null, '', search);
    },
    [currentUrl, dispatch, resetInspection, srcOverrides],
  );

  const navigate = useCallback(
    (input: string) => {
      const result = parsePreviewUrl(input);
      if (!result.ok) {
        setAddressError(URL_ERROR_KEYS[result.error]);
        addressRef.current?.focus();
        return;
      }
      const url = result.url;
      // A dev server is rarely on port 80: suggest adding the port.
      if (isLocalHost(url.hostname) && !url.port && !/:\d/.test(input)) {
        toast({ message: t('url.hint.localPort', { host: url.hostname }), tone: 'info' });
      }
      showPage(url, 'push');
    },
    [showPage, t, toast],
  );

  // Back and forward (buttons, Alt+←/→, mouse buttons) move between previewed pages.
  useEffect(() => {
    const onPopState = () => {
      const href = toSafeHref(new URLSearchParams(location.search).get('url'));
      if (href) {
        showPage(new URL(href), 'none');
        return;
      }
      // An entry without a page: the workspace as opened, maybe with an address that couldn't be used.
      const input = new URLSearchParams(location.search).get('input') ?? '';
      const parsed = input ? parsePreviewUrl(input) : null;
      setCurrentUrl(null);
      setAddress(input);
      setAddressError(parsed && !parsed.ok ? URL_ERROR_KEYS[parsed.error] : null);
      setSrcOverrides({});
      setStrays({});
      resetInspection();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [resetInspection, showPage]);

  // The page restored from the last visit gets its address in this history entry
  // too, so going Back to it shows that page rather than an empty workspace.
  useEffect(() => {
    if (initialUrl && new URLSearchParams(location.search).get('url') !== initialUrl.href)
      history.replaceState(null, '', `?${new URLSearchParams({ url: initialUrl.href })}`);
  }, [initialUrl]);

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
    (list: ViewportConfig[], layout: WorkspaceLayout = settings.layout) => {
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
          height: element.clientHeight - top - WORKSPACE_BOTTOM - FIT_SLACK,
        },
        layout,
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

  /** The zoom at which one viewport fills the workspace on its own (focus mode). */
  const focusZoom = useCallback(
    (vp: ViewportConfig) => computeFitZoom([{ ...vp, hidden: false }], 'wrap') ?? vp.zoom,
    [computeFitZoom],
  );

  const fit = useCallback(() => {
    if (focused) {
      const vp = visible.find((item) => item.id === focused.id);
      if (vp) setFocus({ id: vp.id, zoom: focusZoom(vp) });
      return;
    }
    const zoom = computeFitZoom(viewports);
    if (zoom !== null) dispatch({ type: 'setZoomForAll', zoom });
  }, [computeFitZoom, dispatch, focusZoom, focused, viewports, visible]);

  const zoomTo = (zoom: number) => {
    if (focused) setFocus({ ...focused, zoom: clampZoom(zoom) });
    else dispatch({ type: 'setZoomForAll', zoom });
  };

  const zoomStep = (direction: 1 | -1) => {
    if (focused) setFocus({ ...focused, zoom: nextZoom(focused.zoom, direction) });
    else dispatch({ type: 'setZoomForAll', zoom: stepZoom(viewports, direction) });
  };

  /** Leaves focus mode, keeping the keyboard focus on that card if the button pressed goes away with it. */
  const exitFocus = () => {
    if (!focused) return;
    const card = `[data-viewport-id="${CSS.escape(focused.id)}"]`;
    const active = document.activeElement;
    setFocus(null);
    if (active instanceof HTMLElement && active.closest(`[data-testid="zoom-dock"], ${card}`))
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`${card} [aria-haspopup="menu"]`)?.focus());
  };

  const toggleFocus = (id: string) => {
    if (focused?.id === id) {
      exitFocus();
      return;
    }
    const vp = visible.find((item) => item.id === id);
    if (!vp) return;
    setFocus({ id, zoom: focusZoom(vp) });
    requestAnimationFrame(() => workspaceRef.current?.scrollTo({ top: 0, left: 0 }));
  };

  // First run (or a group from the popup): fit the viewports to this screen once a
  // page is shown — before that, the welcome panel takes the room they will have.
  const fitPending = useRef(autoFit !== 'none');
  useEffect(() => {
    if (!fitPending.current || !currentUrl) return;
    // Wait until the site-access tip (which takes space) has been decided.
    if (siteAccess.site === null) return;
    const frame = requestAnimationFrame(() => {
      fitPending.current = false;
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
    setFocus(null);
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

  /** Runs a capture now, or after explaining and asking for the permission screenshots need. */
  const withCapture = async (run: () => Promise<void>) => {
    if (!currentUrl) {
      toast({ message: t('capture.notReady'), tone: 'info' });
      return;
    }
    if (await canCapture()) {
      await run();
      return;
    }
    pendingCapture.current = run;
    setDialog('capture');
  };

  const capture = (element: HTMLElement | null, label: string[]) =>
    withCapture(async () => {
      if (!element) return;
      const parts = ['breakpointer', host ?? 'page', ...label].map(fileNamePart);
      const fileName = `${parts.join('_')}_${timestamp()}.png`;
      const result = await captureElement(element, fileName);
      if (!result.ok) toast({ message: t('capture.failed'), tone: 'error' });
      else if (result.partial) toast({ message: t('capture.partial'), tone: 'info' });
      else toast({ message: t('capture.saved', { file: result.fileName }), tone: 'success' });
    });

  const copyCapture = (element: HTMLElement | null) =>
    withCapture(async () => {
      if (!element) return;
      const image = await captureElementImage(element);
      const copied = image ? await copyImageToClipboard(image.blob) : false;
      toast(
        copied
          ? { message: t('capture.copied'), tone: 'success', key: 'copy' }
          : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
      );
    });

  const cardLabel = (vp: ViewportConfig) =>
    [
      `${vp.width} × ${vp.height}`,
      breakpointFor(settings.breakpoints, vp.width, settings.customBreakpoints, siteBreakpoints ?? []),
      vp.colorScheme ? t(vp.colorScheme === 'dark' ? 'card.schemeDark' : 'card.schemeLight') : null,
    ]
      .filter(Boolean)
      .join(' · ');

  /** Every visible preview in one labelled image. */
  const captureAll = () =>
    withCapture(async () => {
      if (!currentUrl || busy) return;
      if (visible.length === 0) {
        toast({ message: t('report.nothing'), tone: 'info' });
        return;
      }
      setBusy('sheet');
      try {
        // Focus mode hides the other previews; they must be on screen to be captured.
        if (focused) {
          setFocus(null);
          await nextFrame();
        }
        const entries: SheetEntry[] = [];
        for (const [index, vp] of visible.entries()) {
          toast({
            message: t('capture.allProgress', { current: index + 1, total: visible.length }),
            tone: 'info',
            key: 'sheet',
          });
          const stage = document.querySelector<HTMLElement>(`[data-viewport-id="${CSS.escape(vp.id)}"] [data-stage]`);
          const shot = stage ? await captureElementImage(stage) : null;
          if (shot) entries.push({ image: shot.blob, title: vp.name, subtitle: cardLabel(vp) });
        }
        const title = visible.map((vp) => agents.frameOf(vp.id)?.title).find(Boolean) ?? displayHost(currentUrl);
        const sheet = await composeSheet(entries, {
          heading: title,
          url: currentUrl.href,
          footer: `Breakpointer · ${new Date().toLocaleString(language)}`,
        });
        if (!sheet) throw new Error('Nothing captured');
        const fileName = `breakpointer-all_${fileNamePart(displayHost(currentUrl))}_${timestamp()}.png`;
        downloadBlob(sheet, fileName);
        toast({ message: t('capture.saved', { file: fileName }), tone: 'success', key: 'sheet' });
      } catch (error) {
        console.warn('[Breakpointer] Capturing all viewports failed.', error);
        toast({ message: t('capture.failed'), tone: 'error', key: 'sheet' });
      } finally {
        setBusy(null);
      }
    });

  const onCapture = (kind: CaptureKind) => {
    if (kind === 'all') void captureAll();
    else if (kind === 'copy') void copyCapture(workspaceRef.current);
    else void capture(workspaceRef.current, ['workspace']);
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
    setFocus(null);
    replaceViewports(
      defaultViewports((id) => t(`preset.${id}` as MessageKey)),
      t('toast.reset'),
    );
    setDialog(null);
  };

  // The toolbar button and T always visibly switch: light ↔ dark (System is set in Settings).
  const toggleTheme = () => dispatch({ type: 'setTheme', theme: resolvedTheme === 'dark' ? 'light' : 'dark' });

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
    if (focus && !ids.has(focus.id)) setFocus(null);
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
    resetInspection();
    setCurrentUrl(new URL(next));
    setAddress(next);
    setAddressError(null);
    setProbeRun((n) => n + 1);
    dispatch({ type: 'visitUrl', url: next });
    history.pushState(null, '', `?${new URLSearchParams({ url: next })}`);
    return true;
  };

  /* ---------- Inspector ---------- */

  const stopPicking = () => {
    setInspector((state) => ({ ...state, picking: false }));
    agents.broadcast({ type: 'inspect', on: false });
  };

  const closeInspector = () => {
    // Keyboard focus inside the panel would be lost with it: give it to the toolbar's Inspect button.
    const inPanel = document.activeElement?.closest('[data-testid="inspector"]');
    setInspector(CLOSED_INSPECTOR);
    agents.broadcast({ type: 'inspect', on: false });
    agents.broadcast({ type: 'select', selector: null });
    if (inPanel)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="inspect-toggle"]')?.focus());
  };

  const startPicking = () => {
    setInspector((state) => ({ ...state, open: true, picking: true }));
    agents.broadcast({ type: 'inspect', on: true });
    hintAccess(t('tools.inspect'));
  };

  /** The toolbar toggle and I: open the inspector and pick, or close it. */
  const toggleInspector = () => {
    if (inspector.open) closeInspector();
    else startPicking();
  };

  const clearSelection = () => {
    setInspector((state) => ({ ...state, selector: null, results: {} }));
    agents.broadcast({ type: 'select', selector: null });
  };

  const onEscape = () => {
    if (inspector.picking) stopPicking();
    else if (focused) exitFocus();
    else if (inspector.open) closeInspector();
  };

  const agents = useFrameAgents(tabId, generations, {
    onHello: (cardId) => {
      agents.send(cardId, { type: 'checks', enabled: settings.checks });
      if (outlines) agents.send(cardId, { type: 'outlines', on: true });
      if (hideScrollbars) agents.send(cardId, { type: 'scrollbars', hidden: true });
      if (liveCss) agents.send(cardId, { type: 'css', css: liveCss });
      const scheme = viewports.find((vp) => vp.id === cardId)?.colorScheme;
      if (scheme) agents.send(cardId, { type: 'colorScheme', scheme });
      if (inspector.picking) agents.send(cardId, { type: 'inspect', on: true });
      if (inspector.selector) agents.send(cardId, { type: 'select', selector: inspector.selector });
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
    onScroll: (cardId, ratio, anchor) => {
      if (!settings.sync.scroll) return;
      // Content anchors only fit previews of the same page; others scroll to the same ratio.
      const page = agents.frameOf(cardId)?.href;
      for (const vp of visible) {
        if (vp.id === cardId) continue;
        const other = agents.frameOf(vp.id)?.href;
        const samePage = Boolean(page && other && pageOf(page) === pageOf(other));
        agents.send(vp.id, { type: 'scrollTo', ratio, anchor: samePage ? anchor : undefined });
      }
    },
    onZoom: (direction) => zoomStep(direction),
    onPick: (cardId, selector, element) => {
      const generation = generations[cardId];
      if (!generation) return;
      setInspector((state) => ({
        ...state,
        open: true,
        picking: false,
        selector,
        results: { [cardId]: { generation, info: element } },
      }));
      agents.broadcast({ type: 'inspect', on: false });
      agents.broadcast({ type: 'select', selector });
    },
    onElement: (cardId, selector, element) => {
      const generation = generations[cardId];
      if (!generation) return;
      setInspector((state) =>
        state.selector === selector
          ? { ...state, results: { ...state.results, [cardId]: { generation, info: element } } }
          : state,
      );
    },
    onKey: (_cardId, key) => {
      if (key === 'Escape') onEscape();
    },
  });
  const { broadcast, send } = agents;

  // Keep every connected frame in step with the tools (new frames get them on hello).
  useEffect(() => broadcast({ type: 'checks', enabled: settings.checks }), [broadcast, settings.checks]);
  useEffect(() => broadcast({ type: 'outlines', on: outlines }), [broadcast, outlines]);
  useEffect(() => broadcast({ type: 'scrollbars', hidden: hideScrollbars }), [broadcast, hideScrollbars]);
  useEffect(() => broadcast({ type: 'css', css: liveCss }), [broadcast, liveCss]);
  // When the inspector's selection goes (cleared, closed, another page), previews drop its outline too.
  useEffect(() => {
    if (!inspector.selector) broadcast({ type: 'select', selector: null });
  }, [broadcast, inspector.selector]);
  const schemeKey = visible.map((vp) => `${vp.id}:${vp.colorScheme ?? ''}`).join(' ');
  useEffect(() => {
    for (const entry of schemeKey.split(' ')) {
      const [id, scheme] = entry.split(':');
      if (id) send(id, { type: 'colorScheme', scheme: (scheme || null) as ColorScheme | null });
    }
  }, [schemeKey, send]);

  // Breakpoints found in the page's own stylesheets, from a preview showing the workspace's page.
  const siteMedia: MediaReport | null = (() => {
    if (!currentUrl) return null;
    for (const vp of visible) {
      const frame = agents.frameOf(vp.id);
      if (frame?.media && pageOf(frame.href) === pageOf(currentUrl.href)) return frame.media;
    }
    return null;
  })();
  const siteBreakpoints = siteMedia?.breakpoints ?? null;
  // Dragged edges snap to the breakpoints in use.
  const snapWidths =
    breakpointSet(settings.breakpoints, settings.customBreakpoints, siteBreakpoints ?? [])?.breakpoints.map(
      (breakpoint) => breakpoint.min,
    ) ?? [];

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
      case 'scrollbars': {
        const on = !hideScrollbars;
        setHideScrollbars(on);
        if (on) hintAccess(t('tools.scrollbars'));
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

  const setBreakpoints = (set: BreakpointSetId) => {
    dispatch({ type: 'setBreakpoints', breakpoints: set });
    if (set !== 'site' || !currentUrl) return;
    if (siteAccess.site === false) hintAccess(t('breakpoints.site'));
    else if (siteMedia && siteMedia.breakpoints.length === 0)
      toast({
        message: siteMedia.unreadable ? t('breakpoints.siteUnreadable') : t('breakpoints.siteNone'),
        tone: 'info',
        key: 'site-breakpoints',
      });
  };

  const setColorScheme = (vp: ViewportConfig, scheme: ColorScheme | null) => {
    dispatch({ type: 'updateViewport', id: vp.id, patch: { colorScheme: scheme } });
    if (scheme) hintAccess(t('card.colorScheme'));
  };

  const applyLiveCss = (css: string) => {
    setLiveCss(css);
    setDialog(null);
    toast({ message: css ? t('css.applied') : t('css.cleared'), tone: 'success', key: 'live-css' });
    if (css) hintAccess(t('css.title'));
  };

  const testEdges = () => {
    const edges = breakpointEdges(
      settings.breakpoints,
      settings.customBreakpoints,
      MAX_VIEWPORTS,
      siteBreakpoints ?? [],
    );
    if (edges.length === 0) {
      toast({ message: t('tools.noEdges'), tone: 'info' });
      return;
    }
    let next = edges.map((edge) =>
      createViewport({ name: edge.name, width: edge.width, height: EDGE_VIEWPORT_HEIGHT }),
    );
    const zoom = computeFitZoom(next);
    if (zoom !== null) next = setZoomForAll(next, zoom);
    setFocus(null);
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

  const sortViewports = () => {
    if (isSortedByWidth(viewports)) {
      toast({ message: t('tools.alreadySorted'), tone: 'info', key: 'sort' });
      return;
    }
    replaceViewports(sortByWidth(viewports), t('tools.sorted'));
  };

  const scrollAllToTop = () => {
    hintAccess(t('palette.scrollTop'));
    broadcast({ type: 'scrollTo', ratio: 0 });
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

  const runReport = async () => {
    if (!currentUrl) return;
    const list = visible;
    setBusy('report');
    try {
      if (focused) {
        setFocus(null);
        await nextFrame();
      }
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
          breakpoint: breakpointFor(settings.breakpoints, vp.width, settings.customBreakpoints, siteBreakpoints ?? []),
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
      setBusy(null);
    }
  };

  const exportReport = () => {
    if (!currentUrl || busy) return;
    if (visible.length === 0) {
      toast({ message: t('report.nothing'), tone: 'info' });
      return;
    }
    void withCapture(runReport);
  };

  /* ---------- Shortcuts and gestures ---------- */

  useShortcuts({
    focusAddress: () => addressRef.current?.focus(),
    reload: () => currentUrl && reloadAllPreviews(),
    add: () => setDialog('add'),
    groups: () => document.querySelector<HTMLButtonElement>('[data-groups-trigger]')?.click(),
    fit,
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
    layout: () => dispatch({ type: 'setLayout', layout: settings.layout === 'wrap' ? 'row' : 'wrap' }),
    rulers: () => dispatch({ type: 'setShowRulers', showRulers: !settings.showRulers }),
    capture: () => void capture(workspaceRef.current, ['workspace']),
    theme: toggleTheme,
    help: () => setDialog('help'),
    palette: () => (dialog === 'palette' ? setDialog(null) : openPalette()),
    inspect: toggleInspector,
    escape: onEscape,
  });

  useWheelZoom(stageRef, (direction) => zoomStep(direction));
  const panLayer = usePan(workspaceRef);

  /* ---------- Command palette ---------- */

  // A snapshot of the commands, taken when the palette opens (it closes again when one runs).
  const [paletteCommands, setPaletteCommands] = useState<PaletteCommand[]>([]);
  const openPalette = () => {
    setPaletteCommands(
      buildCommands({
        t,
        en: english,
        settings,
        hasUrl: Boolean(currentUrl),
        canAdd: canAddViewport(viewports),
        focusedId: focused?.id ?? null,
        outlines,
        hideScrollbars,
        liveCss: Boolean(liveCss),
        inspecting: inspector.open,
        actions: {
          reloadAll: reloadAllPreviews,
          openInTab: () => currentUrl && void adapter.openInTab(currentUrl.href),
          scrollTop: scrollAllToTop,
          navigate,
          addPreset: (preset, name) => addViewport({ name, width: preset.width, height: preset.height }),
          openAdd: () => setDialog('add'),
          applyGroup,
          saveGroup: () => setDialog('saveGroup'),
          manageGroups: () => setDialog('manageGroups'),
          toggleVisible: (id) => toggleVisible(id),
          showAll: () => dispatch({ type: 'showAll' }),
          focus: toggleFocus,
          fit,
          zoomTo,
          setLayout: (layout) => dispatch({ type: 'setLayout', layout }),
          rotateAll,
          sortByWidth: sortViewports,
          edges: testEdges,
          toggleTool,
          toggleRulers: () => dispatch({ type: 'setShowRulers', showRulers: !settings.showRulers }),
          setBreakpoints,
          liveCss: () => setDialog('css'),
          inspect: toggleInspector,
          capture: onCapture,
          report: exportReport,
          setTheme: (theme) => dispatch({ type: 'setTheme', theme }),
          setLanguage: (lang) => dispatch({ type: 'setLanguage', language: lang }),
          openSettings: () => setDialog('settings'),
          siteAccess: () => setDialog('access'),
          help: () => setDialog('help'),
          exportSettings,
        },
      }),
    );
    setDialog('palette');
  };

  const commandFromQuery = (query: string): PaletteCommand | null => {
    // Not for numbers such as a width ("768" would read as an IP address).
    if (!looksLikeAddress(query)) return null;
    const result = parsePreviewUrl(query);
    if (!result.ok) return null;
    return {
      id: 'preview-typed',
      section: t('palette.section.page'),
      icon: 'globe',
      title: t('palette.preview', { url: result.url.href }),
      run: () => navigate(result.url.href),
    };
  };

  function addViewport(viewport: { name: string; width: number; height: number }) {
    if (!canAddViewport(viewports)) {
      toast({ message: t('add.limit', { max: MAX_VIEWPORTS }), tone: 'info' });
      return;
    }
    // A new viewport would stay out of sight in focus mode.
    setFocus(null);
    dispatch({
      type: 'addViewport',
      viewport: commonZoom === null ? viewport : { ...viewport, zoom: commonZoom },
    });
    toast({ message: t('add.added', { name: viewport.name }), tone: 'success', key: 'added' });
  }

  function toggleVisible(id: string) {
    const vp = viewports.find((item) => item.id === id);
    if (vp) dispatch({ type: 'updateViewport', id, patch: { hidden: !vp.hidden } });
  }

  // Chrome doesn't tell the page when a frame was refused, so the tip shows
  // for any site that isn't allowed yet (unless the site is simply unreachable).
  const showNotice = Boolean(
    currentUrl &&
    settings.embedHints &&
    siteAccess.site === false &&
    probe !== 'unreachable' &&
    !dismissedHosts.includes(currentUrl.hostname),
  );

  const inspectorRows: InspectorRow[] = visible.map((vp) => {
    const result = inspector.results[vp.id];
    return {
      id: vp.id,
      name: vp.name,
      width: vp.width,
      height: vp.height,
      sizeClass: sizeClassOf(vp.width, vp.height),
      info: result && result.generation === generations[vp.id] ? result.info : undefined,
    };
  });

  const revealCard = (id: string) => {
    if (focused && focused.id !== id) setFocus(null);
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-viewport-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }),
    );
  };

  const renderCards = () => (
    <div className={styles.cards} data-layout={settings.layout} data-focus={focused ? '' : undefined} data-cards>
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
            siteBreakpoints={siteBreakpoints ?? undefined}
            snapWidths={snapWidths}
            grid={settings.grid}
            checks={settings.checks ? (agents.frameOf(vp.id)?.report ?? null) : null}
            highlighted={highlights[vp.id] ?? null}
            onHighlight={(kind) => highlight(vp.id, kind)}
            showRulers={settings.showRulers}
            focused={focused?.id === vp.id}
            concealed={Boolean(focused && focused.id !== vp.id)}
            zoomOverride={focused?.id === vp.id ? focused.zoom : undefined}
            onRename={(name) => dispatch({ type: 'updateViewport', id: vp.id, patch: { name } })}
            onResize={(size) => dispatch({ type: 'updateViewport', id: vp.id, patch: size })}
            onZoom={(zoom) => dispatch({ type: 'updateViewport', id: vp.id, patch: { zoom } })}
            onRotate={() => dispatch({ type: 'rotateViewport', id: vp.id })}
            onMove={(delta) => moveVisible(vp, delta)}
            onReload={() => reloadCard(vp.id)}
            onCapture={(stage) =>
              // The image is taken as shown on screen, so the name says at which zoom.
              void capture(stage, [
                vp.name,
                `${vp.width}x${vp.height}`,
                `${Math.round((focused?.id === vp.id ? focused.zoom : vp.zoom) * 100)}pct`,
              ])
            }
            onCopy={(stage) => void copyCapture(stage)}
            // The page this preview shows now (it may have followed a link on its own).
            onOpenInTab={() => {
              const page = agents.frameOf(vp.id)?.href ?? cardSrc(vp.id);
              if (page) void adapter.openInTab(toSafeHref(page) ?? src ?? page);
            }}
            onOpenInWindow={async () => {
              if (!src) return;
              const size = await adapter.openInWindow(src, { width: vp.width, height: vp.height }).catch(() => null);
              if (!size) toast({ message: t('window.failed'), tone: 'error' });
              else if (size.width !== vp.width || size.height !== vp.height)
                toast({ message: t('window.clamped', size), tone: 'info' });
            }}
            onDuplicate={() => {
              setFocus(null);
              dispatch({ type: 'duplicateViewport', id: vp.id });
              toast({ message: t('toast.duplicated', { name: vp.name }), tone: 'success' });
            }}
            onHide={() => dispatch({ type: 'updateViewport', id: vp.id, patch: { hidden: true } })}
            onRemove={() => removeViewport(vp)}
            onFocus={() => toggleFocus(vp.id)}
            onColorScheme={(scheme) => setColorScheme(vp, scheme)}
          />
        ) : null;
      })}
    </div>
  );

  const welcome = !currentUrl && (
    <Welcome
      savedPages={settings.savedPages}
      recentUrls={settings.rememberRecent ? settings.recentUrls : []}
      paletteShortcut={paletteShortcut}
      onOpen={navigate}
      onTryExample={() => navigate('https://example.com')}
    />
  );

  const renderContent = () => {
    if (viewports.length === 0) {
      return (
        <>
          {welcome}
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
        {welcome}
        {renderCards()}
      </>
    );
  };

  const focusedViewport = focused ? visible.find((vp) => vp.id === focused.id) : undefined;

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
        canGoBack={navigation.canGoBack}
        canGoForward={navigation.canGoForward}
        onBack={navigation.back}
        onForward={navigation.forward}
        onAddressChange={(value) => {
          setAddress(value);
          if (addressError) setAddressError(null);
        }}
        onSubmit={(value) => navigate(value ?? address)}
        onReloadAll={reloadAllPreviews}
        onOpenInTab={() => currentUrl && void adapter.openInTab(currentUrl.href)}
        onPalette={openPalette}
        paletteShortcut={paletteShortcut}
        onCapture={onCapture}
        onSiteAccess={() => setDialog('access')}
        onToggleTheme={toggleTheme}
        resolvedTheme={resolvedTheme}
        onSettings={() => setDialog('settings')}
        onHelp={() => setDialog('help')}
        savedPages={settings.savedPages}
        saved={Boolean(currentUrl && settings.savedPages.includes(currentUrl.href))}
        onToggleSaved={toggleSaved}
      />
      <WorkspaceBar
        viewports={viewports}
        groups={settings.groups}
        canAddViewport={canAddViewport(viewports)}
        breakpoints={settings.breakpoints}
        siteBreakpoints={siteBreakpoints}
        showRulers={settings.showRulers}
        sync={settings.sync.scroll || settings.sync.navigation}
        showGrid={settings.grid.show}
        inspecting={inspector.open}
        tools={{
          syncScroll: settings.sync.scroll,
          syncNavigation: settings.sync.navigation,
          checks: settings.checks,
          outlines,
          scrollbars: hideScrollbars,
          grid: settings.grid.show,
          liveCss: Boolean(liveCss),
        }}
        hasUrl={Boolean(currentUrl)}
        siteAllowed={siteAccess.site}
        host={host}
        focusedId={focused?.id ?? null}
        onToggleVisible={toggleVisible}
        onMoveTo={(id, index) => dispatch({ type: 'moveViewportTo', id, index })}
        onApplyGroup={applyGroup}
        onSaveGroup={() => setDialog('saveGroup')}
        onManageGroups={() => setDialog('manageGroups')}
        onAddViewport={() => setDialog('add')}
        onBreakpoints={setBreakpoints}
        onRulers={(showRulers) => dispatch({ type: 'setShowRulers', showRulers })}
        onSync={setSyncAll}
        onGrid={(show) => dispatch({ type: 'setGrid', grid: { show } })}
        onInspect={toggleInspector}
        onTool={toggleTool}
        onLiveCss={() => setDialog('css')}
        onEdges={testEdges}
        onRotateAll={rotateAll}
        onSortByWidth={sortViewports}
        onReport={exportReport}
        onAllowSite={() => void allowSite()}
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
      <div className={styles.body}>
        <div ref={stageRef} className={styles.stage}>
          <main
            ref={workspaceRef}
            className={styles.workspace}
            aria-label={t('workspace.region')}
            data-testid="workspace"
          >
            {renderContent()}
          </main>
          {visible.length > 0 && (
            <ZoomDock
              zoom={focused ? focused.zoom : commonZoom}
              disabled={visible.length === 0}
              onZoom={zoomTo}
              onStep={zoomStep}
              onFit={fit}
              layout={settings.layout}
              onLayout={(layout) => dispatch({ type: 'setLayout', layout })}
              focused={Boolean(focused)}
              status={
                focusedViewport ? (
                  <DockStatus icon="maximize" testId="focus-status" action={t('focus.exit')} onAction={exitFocus}>
                    {t('focus.label')} <strong>{focusedViewport.name}</strong>
                  </DockStatus>
                ) : inspector.picking ? (
                  <DockStatus
                    icon="inspect"
                    testId="inspect-status"
                    action={t('inspector.stopPicking')}
                    onAction={stopPicking}
                  >
                    {t('inspector.pickingHint')}
                  </DockStatus>
                ) : null
              }
            />
          )}
        </div>
        {inspector.open && (
          <InspectorPanel
            picking={inspector.picking}
            selector={inspector.selector}
            rows={inspectorRows}
            needsAccess={Boolean(currentUrl && siteAccess.site === false)}
            host={host}
            busy={requesting}
            onPick={() => (inspector.picking ? stopPicking() : startPicking())}
            onClear={clearSelection}
            onClose={closeInspector}
            onReveal={revealCard}
            onCopySelector={(selector) =>
              void copyText(selector).then((copied) =>
                toast(
                  copied
                    ? { message: t('inspector.copied'), tone: 'success', key: 'copy' }
                    : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
                ),
              )
            }
            onAllowSite={() => void allowSite()}
          />
        )}
      </div>
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

      <CommandPalette
        open={dialog === 'palette'}
        commands={paletteCommands}
        fromQuery={commandFromQuery}
        onClose={() => setDialog((current) => (current === 'palette' ? null : current))}
      />
      <AddViewportDialog
        open={dialog === 'add'}
        canAdd={canAddViewport(viewports)}
        viewports={viewports}
        onAdd={(viewport) => {
          addViewport(viewport);
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
        onApply={(id) => {
          setDialog(null);
          applyGroup(id);
        }}
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
        siteBreakpoints={siteBreakpoints}
        onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
        onLanguage={(lang) => dispatch({ type: 'setLanguage', language: lang })}
        onBreakpoints={setBreakpoints}
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
      <HelpDialog
        open={dialog === 'help'}
        onClose={() => setDialog(null)}
        commandShortcuts={commandShortcuts}
        paletteShortcut={paletteShortcut}
      />
    </div>
  );
}
