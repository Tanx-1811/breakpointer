import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHECK_KINDS, type CheckKind, type ElementInfo, type ElementRect, type MediaReport } from '../agent/protocol';
import { AddViewportDialog } from '../components/DevicePresetPicker/AddViewportDialog';
import { AuditPanel, type AuditRow, type AuditTab } from '../components/AuditPanel/AuditPanel';
import { Button } from '../components/Button/Button';
import { CaptureDialog } from '../components/CaptureDialog/CaptureDialog';
import { Banner } from '../components/Banner/Banner';
import { CommandPalette, type PaletteCommand } from '../components/CommandPalette/CommandPalette';
import { CompareDialog } from '../components/CompareDialog/CompareDialog';
import { ScanDialog, type ScanResult } from '../components/ScanDialog/ScanDialog';
import { VisualDialog, type VisualRow } from '../components/VisualDialog/VisualDialog';
import { ContrastDialog, type ContrastColors } from '../components/ContrastDialog/ContrastDialog';
import type { DesignOverlayState } from '../components/DesignOverlay/DesignOverlay';
import { FLOATING_TOOLBAR, FloatingPreview, adoptStyles } from '../components/FloatingPreview/FloatingPreview';
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
import { VisionFilters } from '../components/VisionFilters/VisionFilters';
import { Welcome } from '../components/Welcome/Welcome';
import {
  VISION_KEYS,
  WorkspaceBar,
  type SimulateState,
  type SimulateToggle,
  type ToolToggle,
} from '../components/WorkspaceBar/WorkspaceBar';
import { DockStatus, ZoomDock } from '../components/ZoomDock/ZoomDock';
import { useFrameAgents } from '../hooks/useFrameAgents';
import { useNavigationHistory } from '../hooks/useNavigationHistory';
import { usePersistentSettings } from '../hooks/usePersistentSettings';
import { overlayOpen, useShortcuts } from '../hooks/useShortcuts';
import { useSiteAccess } from '../hooks/useSiteAccess';
import { useStableDomOrder } from '../hooks/useStableDomOrder';
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { createTranslator, resolveLanguage, type Language } from '../i18n/translate';
import { captureScale, composeSheet, cropToRect, stitchSlices, type SheetEntry } from '../services/composite';
import type { PreviewAdapter } from '../services/preview-adapter';
import {
  blobToDataUrl,
  canCapture,
  captureElement,
  captureElementImage,
  captureWindowImage,
  copyImageToClipboard,
  copyText,
  requestCapturePermission,
} from '../services/screenshot';
import { frameName } from '../services/frame-agents';
import { loadDismissedNoticeHosts, saveDismissedNoticeHosts } from '../services/session-state';
import { markSeen } from '../services/whats-new';
import { enableEmbeddingForExtensionFrames } from '../services/embed-rules';
import { hasSiteAccess, requestSiteAccess } from '../services/site-access';
import {
  closeWindows,
  focusOwnWindow,
  focusWindows,
  navigateWindowTabs,
  onWindowClosed,
  openWindowsSideBySide,
  screenArea,
  type ManagedWindow,
} from '../services/windows';
import { createSettingsExport, defaultViewports, normalizeSnippetName, parseSettingsFile } from '../services/storage';
import { breakpointEdges, breakpointFor, breakpointSet } from '../data/breakpoints';
import {
  compareCardId,
  compareLabel,
  compareUrl,
  isCompareCardId,
  mirrorBack,
  swapCompare,
  viewportIdOf,
  type CompareTarget,
} from '../state/compare';
import { fitZoomForAll } from '../state/fit';
import { slicePositions, stitchedHeight } from '../state/full-page';
import { groupIssues, issuesMarkdown, statsMarkdown, typeMarkdown } from '../state/audit';
import { CHECK_KIND_KEYS, withoutKinds } from '../state/checks';
import {
  SCAN_CARD_ID,
  coverageNotes,
  rangeText,
  scanCoverage,
  scanFindings,
  scanMarkdown,
  type ScanSample,
} from '../state/scan';
import { viewportKey, type SnapshotPage } from '../state/snapshots';
import { workspaceLink } from '../state/workspace-link';
import { clearSnapshots, deletePageSnapshots, snapshotPages } from '../services/snapshot-store';
import { INSPECTED_PROPERTIES, comparisonMarkdown, propertyValue } from '../state/inspector';
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
import { visionFilter, type VisionMode } from '../state/vision';
import type {
  BreakpointSetId,
  ColorScheme,
  CssSnippet,
  ViewportConfig,
  BreakpointerSettings,
  WorkspaceLayout,
} from '../types';
import { MAX_CSS_SNIPPETS, MAX_LIVE_CSS, MAX_VIEWPORTS } from '../utils/constants';
import { downloadBlob, fileNamePart, timestamp } from '../utils/download';
import { modShortcut, whenVisible } from '../utils/platform';
import { URL_ERROR_KEYS } from '../i18n/url-errors';
import { shortHash } from '../utils/hash';
import { createId } from '../utils/id';
import {
  displayHost,
  isLocalHost,
  looksLikeAddress,
  parsePreviewUrl,
  toSafeHref,
  type UrlParseError,
} from '../utils/url';
import { buildCommands } from './commands';
import { useAuditData } from './useAuditData';
import { useVisualCheck, type Capture } from './useVisualCheck';
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

type DialogName =
  | 'add'
  | 'saveGroup'
  | 'manageGroups'
  | 'access'
  | 'capture'
  | 'settings'
  | 'help'
  | 'css'
  | 'palette'
  | 'contrast'
  | 'compare'
  | 'scan'
  | 'visual';

/** Document Picture-in-Picture (Chrome 116+): an always-on-top window the page fills itself. */
type PictureInPictureHost = Window & {
  documentPictureInPicture?: { requestWindow(options: { width: number; height: number }): Promise<Window> };
};

/** One preview: a visible viewport, or (when comparing two addresses) its B side. */
type CardEntry = { id: string; viewport: ViewportConfig; compare: boolean };

const SIMULATE_LABELS: Record<SimulateToggle, MessageKey> = {
  pseudo: 'stress.pseudo',
  rtl: 'stress.rtl',
  spacing: 'stress.spacing',
  reduceMotion: 'motion.reduce',
  moreContrast: 'prefs.moreContrast',
  print: 'prefs.print',
  pauseAnimations: 'animations.pause',
};

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
  /** A workspace link replaced these viewports as the workspace opened (it can be undone). */
  replacedViewports?: ViewportConfig[] | null;
  /** This version has news the user hasn't seen (Help shows a dot until opened). */
  whatsNew?: boolean;
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
  replacedViewports,
  whatsNew,
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
  // The last width scan of a page (kept for the session).
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  // The visual check: capturing hides its dialog, and only one runs at a time.
  const [visualBusy, setVisualBusy] = useState(false);
  const [visualConcealed, setVisualConcealed] = useState(false);
  // Pages with visual baselines, listed in Settings.
  const [snapshotList, setSnapshotList] = useState<SnapshotPage[] | null>(null);
  // Reload every preview every so many seconds (0: off); for this session.
  const [autoReload, setAutoReload] = useState(0);
  // Where each preview's page is scrolled (as its agent last said), and where to scroll a
  // reloaded one back to when its page says hello again.
  const lastScroll = useRef<Record<string, { href: string; y: number }>>({});
  const scrollToRestore = useRef<Record<string, { href: string; y: number }>>({});
  // The audit panel (issues, page stats and type of every preview); it shares the side with the inspector.
  const [audit, setAudit] = useState<{ open: boolean; tab: AuditTab }>({ open: false, tab: 'issues' });
  const [busy, setBusy] = useState<null | 'report' | 'sheet'>(null);
  // One capture at a time: each one shows the previews one by one and captures the screen.
  const capturing = busy !== null || visualBusy;
  // Utilities for this session (not saved).
  const [measuring, setMeasuring] = useState(false);
  const [vision, setVision] = useState<VisionMode>('none');
  const [stress, setStress] = useState({ pseudo: false, rtl: false, spacing: false });
  // The page's styles for preferences the browser doesn't have.
  const [preferences, setPreferences] = useState({ reducedMotion: false, moreContrast: false, print: false });
  const [pauseAnimations, setPauseAnimations] = useState(false);
  // Labels drawn over the previews.
  const [annotate, setAnnotate] = useState({ images: false, tabOrder: false, layout: false });
  const [contrastColors, setContrastColors] = useState<ContrastColors>({ text: '#1f2430', background: '#ffffff' });
  // Comparing two addresses: every visible viewport also shows a B preview.
  const [compare, setCompare] = useState<CompareTarget | null>(null);
  // Design mockups laid over previews (object URLs of local files), by card.
  const [overlays, setOverlays] = useState<Record<string, DesignOverlayState>>({});
  // The scroll position of previews with a design overlay (it moves with the page).
  const [overlayScroll, setOverlayScroll] = useState<Record<string, number>>({});
  const overlayUrls = useRef(new Set<string>());
  // Viewports opened as real Chrome windows (they follow the workspace's address).
  const [realWindows, setRealWindows] = useState<ManagedWindow[]>([]);
  // The always-on-top floating preview, and which viewport it shows.
  const [floating, setFloating] = useState<{ pip: Window; viewportId: string } | null>(null);

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
  const simulateState: SimulateState = {
    vision,
    reduceMotion: preferences.reducedMotion,
    moreContrast: preferences.moreContrast,
    print: preferences.print,
    pauseAnimations,
    pseudo: stress.pseudo,
    rtl: stress.rtl,
    spacing: stress.spacing,
  };

  // Each visible viewport is a card; when comparing, its B side is a second card next to it.
  const cards = useMemo<CardEntry[]>(
    () =>
      visible.flatMap((viewport) => {
        const main: CardEntry = { id: viewport.id, viewport, compare: false };
        return compare ? [main, { id: compareCardId(viewport.id), viewport, compare: true }] : [main];
      }),
    [visible, compare],
  );
  /** The address a card shows while the workspace shows `page`. */
  const pageFor = useCallback(
    (cardId: string, page: string | null) =>
      page && compare && isCompareCardId(cardId) ? compareUrl(compare, page) : page,
    [compare],
  );
  /** Two previews show the same page (B previews in mirror mode: the same path on the other site). */
  const samePage = (a: string, b: string) => {
    if (pageOf(a) === pageOf(b)) return true;
    if (compare?.mode !== 'mirror') return false;
    try {
      const [first, second] = [new URL(a), new URL(b)];
      return first.pathname === second.pathname && first.search === second.search;
    } catch {
      return false;
    }
  };
  /** A card's name in captures, reports and the inspector: B previews are marked. */
  const cardTitle = (card: CardEntry) => (card.compare ? `${card.viewport.name} · B` : card.viewport.name);
  /** The preview area of a card, for captures. */
  const stageOf = (cardId: string) =>
    document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(cardId)}"] [data-stage]`);

  /* ---------- Navigation ---------- */

  // The element being inspected, for work that outlives a render (a capture puts its outline back).
  const inspectedNow = useRef(inspector.selector);
  useLayoutEffect(() => {
    inspectedNow.current = inspector.selector;
  });
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
      // When comparing, every visible viewport is shown twice.
      const shown = compare
        ? list.flatMap((vp) => (vp.hidden ? [vp] : [vp, { ...vp, id: compareCardId(vp.id) }]))
        : list;
      const element = workspaceRef.current;
      if (!element) return null;
      const cards = element.querySelector<HTMLElement>('[data-cards]');
      const header = element.querySelector<HTMLElement>('[data-card-header]');
      const top = cards?.offsetTop ?? WORKSPACE_PADDING;
      const chromeHeight = (header?.offsetHeight ?? DEFAULT_CARD_CHROME_HEIGHT - 2) + 2;
      const rulerSize = settings.showRulers ? RULER_SIZE : 0;
      return fitZoomForAll(
        shown,
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
    [compare, settings.layout, settings.showRulers],
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
  // The previews start loading after that fit: a frame resized just as its page
  // finishes loading can stop getting clicks (see state/stray-input.ts).
  const [fitPending, setFitPending] = useState(autoFit !== 'none');
  useEffect(() => {
    if (!fitPending || !currentUrl) return;
    // Wait until the site-access tip (which takes space) has been decided.
    if (siteAccess.site === null) return;
    const frame = requestAnimationFrame(() => {
      setFitPending(false);
      fit();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentUrl, fit, fitPending, siteAccess.site]);

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

  /** Access to the current site that is removed the next time Chrome starts. */
  const allowSiteForSession = async () => {
    if (!currentUrl) return;
    const granted = await withPrompt(() => siteAccess.allowSiteForSession());
    if (granted === null) return;
    if (granted) {
      toast({ message: t('access.grantedSession', { host: displayHost(currentUrl) }), tone: 'success' });
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

  const cardLabel = (vp: ViewportConfig, compareSide = false) =>
    [
      `${vp.width} × ${vp.height}`,
      breakpointFor(settings.breakpoints, vp.width, settings.customBreakpoints, siteBreakpoints ?? []),
      vp.colorScheme ? t(vp.colorScheme === 'dark' ? 'card.schemeDark' : 'card.schemeLight') : null,
      compareSide && compare ? compareLabel(compare) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  /** Every visible preview in one labelled image. */
  const captureAll = () =>
    withCapture(async () => {
      if (!currentUrl || capturing) return;
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
        for (const [index, card] of cards.entries()) {
          toast({
            message: t('capture.allProgress', { current: index + 1, total: cards.length }),
            tone: 'info',
            key: 'sheet',
          });
          const stage = stageOf(card.id);
          const shot = stage ? await captureElementImage(stage) : null;
          if (shot)
            entries.push({
              image: shot.blob,
              title: cardTitle(card),
              subtitle: cardLabel(card.viewport, card.compare),
            });
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

  // A workspace link set the viewports: say so, and offer to put back the ones it replaced.
  const announcedLink = useRef(false);
  useEffect(() => {
    if (announcedLink.current || !replacedViewports) return;
    announcedLink.current = true;
    withUndo(viewports.length === 1 ? t('link.openedOne') : t('link.opened', { count: viewports.length }), () =>
      dispatch({ type: 'replaceViewports', viewports: replacedViewports }),
    );
  }, [dispatch, replacedViewports, t, viewports.length, withUndo]);

  // News of this version, until Help is opened.
  const [news, setNews] = useState(Boolean(whatsNew));
  const openHelp = () => {
    setDialog('help');
    if (news) {
      setNews(false);
      void markSeen(version);
    }
  };

  /** A link that opens this page with these viewports in Breakpointer, for a teammate. */
  const copyWorkspaceLink = () => {
    const link = workspaceLink(chrome.runtime.getURL('viewer/viewer.html'), currentUrl?.href ?? null, visible);
    void copyText(link).then((copied) =>
      toast(
        copied
          ? { message: t('link.copied'), tone: 'success', key: 'copy' }
          : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
      ),
    );
  };

  // Signals that the workspace is interactive (used by end-to-end tests).
  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
  }, []);

  /* ---------- Render ---------- */

  const src = currentUrl?.href ?? null;
  // Cards stay in a stable DOM order (moving an iframe reloads it); CSS `order` places them.
  const domOrder = useStableDomOrder(cards.map((card) => card.id));

  // A hidden or removed card loses its frame: when it comes back it shows the
  // workspace's page, so forget what was pinned or flagged for it.
  const visibleKey = cards.map((card) => card.id).join(' ');
  const [prunedFor, setPrunedFor] = useState(visibleKey);
  if (prunedFor !== visibleKey) {
    setPrunedFor(visibleKey);
    const ids = new Set(cards.map((card) => card.id));
    const keepVisible = <T,>(map: Record<string, T>) =>
      Object.keys(map).every((id) => ids.has(id))
        ? map
        : Object.fromEntries(Object.entries(map).filter(([id]) => ids.has(id)));
    setSrcOverrides(keepVisible);
    setStrays(keepVisible);
    if (focus && !ids.has(focus.id)) setFocus(null);
  }

  /* ---------- Frame agents (sync, checks, inspection) ---------- */

  const cardSrc = (id: string) => (fitPending ? null : (srcOverrides[id] ?? pageFor(id, src)));
  const cardReloadKey = (id: string) => `${reloadAll}.${cardReloads[id] ?? 0}`;
  // A frame's generation changes whenever it is replaced (new address or reload).
  const generations = useMemo(() => {
    const map: Record<string, string> = {};
    for (const card of cards) {
      const page = srcOverrides[card.id] ?? pageFor(card.id, src);
      if (page) map[card.id] = shortHash(`${page}#${reloadAll}.${cardReloads[card.id] ?? 0}`);
    }
    // The width scanner's own preview, while its dialog is open.
    if (dialog === 'scan' && src) map[SCAN_CARD_ID] = shortHash(`${src}#scan#${reloadAll}`);
    return map;
  }, [cards, pageFor, srcOverrides, src, reloadAll, cardReloads, dialog]);

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
    const pinned = pageFor(cardId, current);
    setSrcOverrides((overrides) => {
      const keep = overrides[cardId] ?? pinned;
      return keep ? { [cardId]: keep } : {};
    });
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
    // Measuring and picking both take clicks in the previews: one at a time.
    setMeasuring(false);
    // The inspector and the audit share the side of the workspace.
    setAudit((state) => (state.open ? { ...state, open: false } : state));
    setInspector((state) => ({ ...state, open: true, picking: true }));
    agents.broadcast({ type: 'inspect', on: true });
    hintAccess(t('tools.inspect'));
  };

  /** The toolbar toggle and I: open the inspector and pick, or close it. */
  const toggleInspector = () => {
    if (inspector.open) closeInspector();
    else startPicking();
  };

  /* ---------- Audit panel ---------- */

  const closeAudit = () => {
    // Keyboard focus inside the panel would be lost with it: give it to the toolbar's Audit button.
    const inPanel = document.activeElement?.closest('[data-testid="audit"]');
    setAudit((state) => ({ ...state, open: false }));
    if (inPanel)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="audit-toggle"]')?.focus());
  };

  /** The toolbar toggle and E: the audit panel, on the tab asked for (or the one shown last). */
  const toggleAudit = (tab?: AuditTab) => {
    if (audit.open && (!tab || tab === audit.tab)) {
      closeAudit();
      return;
    }
    if (inspector.open) closeInspector();
    setAudit((state) => ({ open: true, tab: tab ?? state.tab }));
    hintAccess(t('audit.title'));
  };

  const clearSelection = () => {
    setInspector((state) => ({ ...state, selector: null, results: {} }));
    agents.broadcast({ type: 'select', selector: null });
  };

  const onEscape = () => {
    if (inspector.picking) stopPicking();
    else if (measuring) setMeasuring(false);
    else if (focused) exitFocus();
    else if (inspector.open) closeInspector();
    else if (vision !== 'none') setVision('none');
    else if (audit.open) closeAudit();
  };

  const agents = useFrameAgents(tabId, generations, {
    onHello: (cardId, href) => {
      agents.send(cardId, { type: 'checks', enabled: settings.checks, skip: settings.disabledChecks });
      if (outlines) agents.send(cardId, { type: 'outlines', on: true });
      if (hideScrollbars) agents.send(cardId, { type: 'scrollbars', hidden: true });
      if (liveCss) agents.send(cardId, { type: 'css', css: liveCss });
      const scheme = viewports.find((vp) => vp.id === viewportIdOf(cardId))?.colorScheme;
      if (scheme) agents.send(cardId, { type: 'colorScheme', scheme });
      if (stress.pseudo || stress.rtl || stress.spacing) agents.send(cardId, { type: 'stress', ...stress });
      if (preferences.reducedMotion || preferences.moreContrast || preferences.print)
        agents.send(cardId, { type: 'preferences', ...preferences });
      if (annotate.images || annotate.tabOrder || annotate.layout)
        agents.send(cardId, { type: 'annotate', ...annotate });
      if (pauseAnimations) agents.send(cardId, { type: 'animations', paused: true });
      if (overlays[cardId]) agents.send(cardId, { type: 'trackScroll', on: true });
      if (inspector.picking) agents.send(cardId, { type: 'inspect', on: true });
      if (inspector.selector) agents.send(cardId, { type: 'select', selector: inspector.selector });
      setHighlights((map) => (map[cardId] ? { ...map, [cardId]: null } : map));
      // Back to where a reloaded preview was — on that page only, not on another one
      // loaded meanwhile or a sign-in page the reload was sent to.
      const restore = scrollToRestore.current[cardId];
      if (restore) {
        delete scrollToRestore.current[cardId];
        if (pageOf(href) === pageOf(restore.href)) agents.send(cardId, { type: 'scrollTo', ratio: 0, y: restore.y });
      }
    },
    onNavigate: (cardId, href, { user, newDocument }) => {
      // The width scanner's preview is the scanner's own: the workspace doesn't follow it.
      if (cardId === SCAN_CARD_ID) return;
      // The page tidying its own address (e.g. dropping tracking parameters) isn't a navigation.
      if (!user && !newDocument) return;
      const current = followedUrl.current;
      // A B preview leads too (mirror mode): the workspace follows to the same page on A's site.
      const lead = isCompareCardId(cardId) ? (compare && current ? mirrorBack(compare, href, current) : null) : href;
      // Only what the user did is followed: redirects a page makes by itself (e.g.
      // sending narrow screens to /m/) stay in that preview.
      if (user && settings.sync.navigation && lead && followFrame(cardId, lead)) return;
      const expected = pageFor(cardId, current);
      const stray = !expected || pageOf(href) !== pageOf(expected);
      setStrays((map) => (Boolean(map[cardId]) === stray ? map : { ...map, [cardId]: stray }));
    },
    onScroll: (cardId, ratio, anchor, y, synced) => {
      if (cardId === SCAN_CARD_ID) return;
      const href = agents.frameOf(cardId)?.href;
      if (href) lastScroll.current[cardId] = { href, y };
      // A design overlay moves with its page.
      if (overlays[cardId]) setOverlayScroll((map) => (map[cardId] === y ? map : { ...map, [cardId]: y }));
      // Scrolls the workspace caused itself are reported only for overlays.
      if (synced || !settings.sync.scroll) return;
      // Content anchors only fit previews of the same page; others scroll to the same ratio.
      const page = agents.frameOf(cardId)?.href;
      for (const card of cards) {
        if (card.id === cardId) continue;
        const other = agents.frameOf(card.id)?.href;
        const same = Boolean(page && other && samePage(page, other));
        agents.send(card.id, { type: 'scrollTo', ratio, anchor: same ? anchor : undefined });
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

  // The page stats and type scale shown in the audit panel, measured in every preview.
  const connectedKey = cards
    .map((card) => (agents.frameOf(card.id) ? `${card.id}:${generations[card.id]}` : ''))
    .join(' ');
  const auditData = useAuditData({
    open: audit.open,
    tab: audit.tab,
    cardIds: cards.map((card) => card.id),
    generations,
    connectedKey,
    ask: agents.ask,
  });

  // Keep every connected frame in step with the tools (new frames get them on hello).
  // The checks switched off in Settings, as a stable key (the list is a new array after every change).
  const skippedChecks = settings.disabledChecks.join(' ');
  useEffect(
    () =>
      broadcast({
        type: 'checks',
        enabled: settings.checks,
        skip: skippedChecks ? (skippedChecks.split(' ') as CheckKind[]) : [],
      }),
    [broadcast, settings.checks, skippedChecks],
  );
  useEffect(() => broadcast({ type: 'outlines', on: outlines }), [broadcast, outlines]);
  useEffect(() => broadcast({ type: 'scrollbars', hidden: hideScrollbars }), [broadcast, hideScrollbars]);
  useEffect(() => broadcast({ type: 'css', css: liveCss }), [broadcast, liveCss]);
  useEffect(() => broadcast({ type: 'stress', ...stress }), [broadcast, stress]);
  useEffect(() => broadcast({ type: 'preferences', ...preferences }), [broadcast, preferences]);
  useEffect(() => broadcast({ type: 'annotate', ...annotate }), [broadcast, annotate]);
  useEffect(() => broadcast({ type: 'animations', paused: pauseAnimations }), [broadcast, pauseAnimations]);
  // When the inspector's selection goes (cleared, closed, another page), previews drop its outline too.
  useEffect(() => {
    if (!inspector.selector) broadcast({ type: 'select', selector: null });
  }, [broadcast, inspector.selector]);
  const schemeKey = cards.map((card) => `${card.id}:${card.viewport.colorScheme ?? ''}`).join(' ');
  useEffect(() => {
    for (const entry of schemeKey.split(' ')) {
      const [id, scheme] = entry.split(':');
      if (id) send(id, { type: 'colorScheme', scheme: (scheme || null) as ColorScheme | null });
    }
  }, [schemeKey, send]);
  // Previews with a design overlay report every scroll (also synced ones), so the overlay follows.
  const trackKey = cards.map((card) => `${card.id}:${overlays[card.id] ? 1 : 0}`).join(' ');
  useEffect(() => {
    for (const entry of trackKey.split(' ')) {
      const [id, on] = entry.split(':');
      if (id) send(id, { type: 'trackScroll', on: on === '1' });
    }
  }, [trackKey, send]);

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

  /** A card's check results, without the checks switched off; null when checks are off or unknown. */
  const checksOf = (cardId: string) =>
    settings.checks ? withoutKinds(agents.frameOf(cardId)?.report, settings.disabledChecks) : null;

  const reloadAllPreviews = () => {
    setSrcOverrides({});
    setStrays({});
    setReloadAll((n) => n + 1);
  };
  /** Notes where previews are scrolled, to bring them back there once reloaded (on the workspace's page only). */
  const rememberScroll = (ids: string[]) => {
    const page = currentUrl?.href ?? null;
    for (const id of ids) {
      const frame = agents.frameOf(id);
      const known = lastScroll.current[id];
      const expected = pageFor(id, page);
      if (!frame || !known || !expected || known.y <= 0) continue;
      if (known.href !== frame.href || pageOf(frame.href) !== pageOf(expected)) continue;
      scrollToRestore.current[id] = known;
    }
  };

  /** Reloads every preview; each one comes back to where it was scrolled. */
  const reloadKeepingPlace = () => {
    if (!currentUrl) return;
    scrollToRestore.current = {};
    rememberScroll(cards.map((card) => card.id));
    reloadAllPreviews();
  };

  const reloadCardKeepingPlace = (id: string) => {
    delete scrollToRestore.current[id];
    rememberScroll([id]);
    reloadCard(id);
  };

  // Automatic reloads: not while the tab is hidden, a dialog or menu is open, or something is captured.
  const autoReloadRef = useRef({ run: reloadKeepingPlace, blocked: false });
  useLayoutEffect(() => {
    autoReloadRef.current = { run: reloadKeepingPlace, blocked: dialog !== null || busy !== null };
  });
  useEffect(() => {
    if (!autoReload || !currentUrl) return;
    const timer = setInterval(() => {
      if (document.hidden || autoReloadRef.current.blocked || overlayOpen()) return;
      autoReloadRef.current.run();
    }, autoReload * 1000);
    return () => clearInterval(timer);
  }, [autoReload, currentUrl]);

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
      case 'imageSizes':
      case 'tabOrder':
      case 'gridFlex': {
        const key = tool === 'imageSizes' ? 'images' : tool === 'tabOrder' ? 'tabOrder' : 'layout';
        const on = !annotate[key];
        setAnnotate({ ...annotate, [key]: on });
        if (on)
          hintAccess(
            t(tool === 'imageSizes' ? 'tools.imageSizes' : tool === 'tabOrder' ? 'tools.tabOrder' : 'tools.gridFlex'),
          );
        break;
      }
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

  // The page colours every visible preview shows, when they all show the same.
  const schemes = new Set(visible.map((vp) => vp.colorScheme ?? null));
  const pageColors = schemes.size === 1 ? [...schemes][0]! : 'mixed';

  /** Every visible preview with the page's light or dark styles (or like the browser), with undo. */
  const setAllColorSchemes = (scheme: ColorScheme | null) => {
    if (visible.length === 0 || pageColors === scheme) return;
    replaceViewports(
      viewports.map((vp) => {
        if (vp.hidden) return vp;
        const { colorScheme: _previous, ...rest } = vp;
        return scheme ? { ...rest, colorScheme: scheme } : rest;
      }),
      t(scheme === 'dark' ? 'colors.dark' : scheme === 'light' ? 'colors.light' : 'colors.auto'),
    );
    if (scheme) hintAccess(t('card.colorScheme'));
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

  const scrollAllToBottom = () => {
    hintAccess(t('palette.scrollBottom'));
    broadcast({ type: 'scrollTo', ratio: 1 });
  };

  const copyAddress = () => {
    if (!currentUrl) return;
    void copyText(currentUrl.href).then((copied) =>
      toast(
        copied
          ? { message: t('palette.addressCopied'), tone: 'success', key: 'copy' }
          : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
      ),
    );
  };

  /* ---------- Width scanner ---------- */

  const openScan = () => {
    if (!currentUrl) {
      toast({ message: t('capture.notReady'), tone: 'info' });
      return;
    }
    setDialog('scan');
    hintAccess(t('scan.title'));
  };

  /**
   * Checks the page in the scanner's preview, once it is `width` wide (the checks
   * switched off left out). The scan waits while the tab is hidden — its preview
   * isn't laid out then — and asks again when the tab was hidden during a probe.
   */
  const probeScan = async (width: number): Promise<ScanSample> => {
    for (let attempt = 1; ; attempt++) {
      await whenVisible();
      let hidden = false;
      const onVisibility = () => {
        if (document.hidden) hidden = true;
      };
      document.addEventListener('visibilitychange', onVisibility);
      try {
        const reply = await agents
          .ask(SCAN_CARD_ID, { type: 'scanProbe', width }, 'scanned', 6000)
          .catch((error: unknown) => {
            if (hidden && attempt < 3) return null;
            throw error;
          });
        // Not answered, or measured before the preview had that width: ask again.
        if (!reply || (hidden && reply.width !== width && attempt < 3)) continue;
        return {
          width: reply.width,
          height: reply.height,
          issues: withoutKinds(reply.report, settings.disabledChecks)?.issues ?? [],
        };
      } finally {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    }
  };

  const copyScan = (result: ScanResult) =>
    void copyText(scanMarkdown(result.page, result.options, result.samples, t)).then((copied) =>
      toast(
        copied
          ? { message: t('audit.copied'), tone: 'success', key: 'copy' }
          : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
      ),
    );

  /** Measuring and picking both take clicks in the previews: one at a time. */
  const toggleMeasure = () => {
    if (!measuring && inspector.picking) stopPicking();
    setMeasuring(!measuring);
  };

  /** Simulations inside the previews (stress tests, page preferences) need the site's permission. */
  const toggleSimulate = (toggle: SimulateToggle) => {
    const on = !simulateState[toggle];
    if (toggle === 'pseudo' || toggle === 'rtl' || toggle === 'spacing') setStress({ ...stress, [toggle]: on });
    else if (toggle === 'reduceMotion') setPreferences({ ...preferences, reducedMotion: on });
    else if (toggle === 'moreContrast' || toggle === 'print') setPreferences({ ...preferences, [toggle]: on });
    else setPauseAnimations(on);
    if (on) hintAccess(t(SIMULATE_LABELS[toggle]));
  };

  /** Shows one viewport on its own, then the next or previous one ([ and ]). */
  const cycleFocus = (delta: 1 | -1) => {
    if (visible.length === 0) return;
    const position = focused ? visible.findIndex((vp) => vp.id === focused.id) : delta === 1 ? -1 : visible.length;
    const next = visible[(position + delta + visible.length) % visible.length]!;
    setFocus({ id: next.id, zoom: focusZoom(next) });
    requestAnimationFrame(() => workspaceRef.current?.scrollTo({ top: 0, left: 0 }));
  };

  /* ---------- Comparing two addresses ---------- */

  const allowCompareSite = async (url: URL) => {
    const granted = await withPrompt(() => requestSiteAccess(url));
    if (granted === null) return;
    if (!granted) {
      toast({ message: t('access.denied'), tone: 'error' });
      return;
    }
    toast({ message: t('access.granted', { host: displayHost(url) }), tone: 'success' });
    // Load the B previews again, now that the site may appear in frames.
    setCardReloads((map) => {
      const next = { ...map };
      for (const vp of visible) next[compareCardId(vp.id)] = (next[compareCardId(vp.id)] ?? 0) + 1;
      return next;
    });
  };

  const startCompare = async (target: CompareTarget) => {
    const starting = compare === null;
    setDialog(null);
    setCompare(target);
    if (starting && visible.length > 4) toast({ message: t('compare.many'), tone: 'info', key: 'compare-many' });
    // The other site may need its own permission to appear in frames.
    const page = currentUrl ? compareUrl(target, currentUrl.href) : null;
    if (!page) return;
    const other = new URL(page);
    if (await hasSiteAccess(other)) return;
    toast({
      message: t('compare.needsAccess', { host: displayHost(other) }),
      tone: 'info',
      key: 'compare-access',
      action: { label: t('tools.allow'), onAction: () => void allowCompareSite(other) },
    });
  };

  const stopCompare = () => {
    setCompare(null);
    setDialog((current) => (current === 'compare' ? null : current));
  };

  /** What B shows becomes the workspace's page, and A's page becomes the comparison. */
  const swapSides = () => {
    if (!compare || !currentUrl) return;
    const swapped = swapCompare(compare, currentUrl.href);
    if (!swapped) return;
    setCompare(swapped.target);
    navigate(swapped.page);
  };

  /* ---------- Design overlays ---------- */

  const addOverlay = (cardId: string, name: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ message: t('overlay.failed'), tone: 'error', key: 'overlay' });
      return;
    }
    // The image stays in this browser: an object URL of the local file.
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      overlayUrls.current.add(url);
      setOverlays((map) => ({ ...map, [cardId]: { src: url, opacity: 0.5, difference: false, hidden: false } }));
      toast({ message: t('overlay.added', { name }), tone: 'success', key: 'overlay' });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast({ message: t('overlay.failed'), tone: 'error', key: 'overlay' });
    };
    image.src = url;
  };

  const updateOverlay = (cardId: string, patch: Partial<DesignOverlayState>) =>
    setOverlays((map) => {
      const overlay = map[cardId];
      return overlay ? { ...map, [cardId]: { ...overlay, ...patch } } : map;
    });

  const removeOverlay = (cardId: string) => {
    const overlay = overlays[cardId];
    if (!overlay) return;
    URL.revokeObjectURL(overlay.src);
    overlayUrls.current.delete(overlay.src);
    setOverlays(({ [cardId]: _removed, ...rest }) => rest);
  };

  // The designs' object URLs are released when the workspace closes.
  useEffect(() => {
    const urls = overlayUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /* ---------- Live CSS snippets ---------- */

  const saveSnippet = (name: string, css: string) => {
    const snippetName = normalizeSnippetName(name);
    const code = css.trim().slice(0, MAX_LIVE_CSS);
    if (!snippetName || !code) return;
    const replaces = settings.cssSnippets.some(
      (snippet) => snippet.name.toLocaleLowerCase() === snippetName.toLocaleLowerCase(),
    );
    if (!replaces && settings.cssSnippets.length >= MAX_CSS_SNIPPETS) {
      toast({ message: t('css.snippetLimit', { max: MAX_CSS_SNIPPETS }), tone: 'info', key: 'snippet' });
      return;
    }
    dispatch({ type: 'saveCssSnippet', snippet: { id: createId(), name: snippetName, css: code } });
    toast({ message: t('css.snippetSaved', { name: snippetName }), tone: 'success', key: 'snippet' });
  };

  const deleteSnippet = (snippet: CssSnippet) => {
    const index = settings.cssSnippets.findIndex((item) => item.id === snippet.id);
    dispatch({ type: 'deleteCssSnippet', id: snippet.id });
    withUndo(t('css.snippetDeleted', { name: snippet.name }), () =>
      dispatch({ type: 'restoreCssSnippet', snippet, index }),
    );
  };

  /* ---------- Real windows ---------- */

  // The address the real windows show; they follow the workspace's.
  const windowsHref = useRef<string | null>(null);
  const realWindowsRef = useRef(realWindows);
  useLayoutEffect(() => {
    realWindowsRef.current = realWindows;
  });
  const shownHref = currentUrl?.href ?? null;
  useEffect(() => {
    if (!shownHref || shownHref === windowsHref.current) return;
    windowsHref.current = shownHref;
    const tabs = realWindowsRef.current.map((item) => item.tabId);
    if (tabs.length) void navigateWindowTabs(tabs, shownHref);
  }, [shownHref]);
  // The user can close them one by one.
  useEffect(
    () =>
      onWindowClosed((windowId) =>
        setRealWindows((list) =>
          list.some((item) => item.windowId === windowId) ? list.filter((item) => item.windowId !== windowId) : list,
        ),
      ),
    [],
  );

  /** Every visible viewport as a real window of its size, side by side: works for any site and any sign-in. */
  const openRealWindows = async () => {
    if (!currentUrl) return;
    if (visible.length === 0) {
      toast({ message: t('report.nothing'), tone: 'info' });
      return;
    }
    const url = currentUrl.href;
    const list = visible;
    toast({ message: t('windows.opening', { count: list.length }), tone: 'info', key: 'windows' });
    try {
      if (realWindowsRef.current.length) await closeWindows(realWindowsRef.current.map((item) => item.windowId));
      windowsHref.current = url;
      const opened = await openWindowsSideBySide(
        url,
        list.map((vp) => ({ viewportId: vp.id, width: vp.width, height: vp.height })),
        screenArea(),
      );
      if (opened.length === 0) throw new Error('No window opened');
      setRealWindows(opened);
      const clamped = opened.filter((item) => {
        const vp = list.find((viewport) => viewport.id === item.viewportId);
        return vp && (vp.width !== item.width || vp.height !== item.height);
      }).length;
      toast(
        clamped
          ? { message: t('windows.openedClamped', { count: opened.length, clamped }), tone: 'info', key: 'windows' }
          : { message: t('windows.opened', { count: opened.length }), tone: 'success', key: 'windows' },
      );
    } catch (error) {
      console.warn('[Breakpointer] Opening windows failed.', error);
      toast({ message: t('windows.failed'), tone: 'error', key: 'windows' });
    }
  };

  const closeRealWindows = () => {
    void closeWindows(realWindows.map((item) => item.windowId));
    setRealWindows([]);
  };

  /** Each real window as captured on screen (at full resolution), in one labelled image. */
  const captureRealWindows = () =>
    withCapture(async () => {
      if (!currentUrl || capturing || realWindows.length === 0) return;
      setBusy('sheet');
      try {
        const entries: SheetEntry[] = [];
        for (const [index, item] of realWindows.entries()) {
          toast({
            message: t('windows.captureProgress', { current: index + 1, total: realWindows.length }),
            tone: 'info',
            key: 'sheet',
          });
          const image = await captureWindowImage(item.windowId);
          const vp = viewports.find((viewport) => viewport.id === item.viewportId);
          if (image) entries.push({ image, title: vp?.name ?? '', subtitle: `${item.width} × ${item.height}` });
        }
        await focusOwnWindow();
        const sheet = await composeSheet(entries, {
          heading: displayHost(currentUrl),
          url: currentUrl.href,
          footer: `Breakpointer · ${new Date().toLocaleString(language)}`,
        });
        if (!sheet) throw new Error('Nothing captured');
        const fileName = `breakpointer-windows_${fileNamePart(displayHost(currentUrl))}_${timestamp()}.png`;
        downloadBlob(sheet, fileName);
        toast({ message: t('capture.saved', { file: fileName }), tone: 'success', key: 'sheet' });
      } catch (error) {
        console.warn('[Breakpointer] Capturing windows failed.', error);
        toast({ message: t('capture.failed'), tone: 'error', key: 'sheet' });
      } finally {
        setBusy(null);
      }
    });

  /* ---------- Visual check ---------- */

  const visualCheck = useVisualCheck(currentUrl?.href ?? null, dialog === 'visual');
  // One row per baseline: viewports of the same size and page colours share one.
  const visualViewports = visible.filter(
    (vp, index) => visible.findIndex((other) => viewportKey(other) === viewportKey(vp)) === index,
  );
  const visualRows: VisualRow[] = visualViewports.map((vp) => {
    const key = viewportKey(vp);
    return {
      key,
      name: vp.name,
      width: vp.width,
      height: vp.height,
      baseline: visualCheck.baselines.find((item) => item.key === key),
      result: visualCheck.results[key],
    };
  });

  /** Each viewport on its own (focus mode, fitted to the screen), captured as shown. */
  const captureViewports = async (list: ViewportConfig[]): Promise<Capture[]> => {
    const previousFocus = focused;
    const captures: Capture[] = [];
    try {
      for (const [index, vp] of list.entries()) {
        toast({
          message: t('visual.capturing', { current: index + 1, total: list.length }),
          tone: 'info',
          key: 'visual',
        });
        setFocus({ id: vp.id, zoom: focusZoom(vp) });
        await nextFrame();
        await nextFrame();
        const stage = stageOf(vp.id);
        const shot = stage ? await captureElementImage(stage) : null;
        if (shot) captures.push({ viewport: vp, image: shot.blob });
      }
    } finally {
      setFocus(previousFocus);
    }
    return captures;
  };

  /** Captures every viewport while the visual check's dialog steps aside, then hands the captures on. */
  const runVisual = (handle: (captures: Capture[]) => Promise<void>) =>
    withCapture(async () => {
      if (capturing || visualViewports.length === 0) return;
      setDialog('visual');
      setVisualBusy(true);
      setVisualConcealed(true);
      try {
        await nextFrame();
        const captures = await captureViewports(visualViewports);
        setVisualConcealed(false);
        if (captures.length === 0) throw new Error('Nothing captured');
        await handle(captures);
      } catch (error) {
        console.warn('[Breakpointer] The visual check failed.', error);
        toast({ message: t('capture.failed'), tone: 'error', key: 'visual' });
      } finally {
        setVisualConcealed(false);
        setVisualBusy(false);
      }
    });

  const saveBaseline = () =>
    runVisual(async (captures) => {
      const count = await visualCheck.save(captures).catch(() => null);
      toast(
        count === null
          ? { message: t('visual.storageFailed'), tone: 'error', key: 'visual' }
          : {
              message: count === 1 ? t('visual.savedOne') : t('visual.saved', { count }),
              tone: 'success',
              key: 'visual',
            },
      );
    });

  const compareBaseline = () =>
    runVisual(async (captures) => {
      const results = Object.values((await visualCheck.compare(captures)) ?? {});
      const compared = results.filter((result) => result.status === 'compared');
      const changed = compared.filter((result) => result.status === 'compared' && result.ratio > 0).length;
      toast({
        message: changed
          ? compared.length === 1
            ? t('visual.summaryOnly')
            : t('visual.summary', { changed, total: compared.length })
          : compared.length
            ? t('visual.summaryNone')
            : t('visual.none'),
        tone: changed ? 'info' : 'success',
        key: 'visual',
      });
    });

  const openVisual = () => {
    if (!currentUrl) {
      toast({ message: t('capture.notReady'), tone: 'info' });
      return;
    }
    setDialog('visual');
  };

  // Settings lists the pages with baselines when it opens.
  useEffect(() => {
    if (dialog !== 'settings') return;
    let active = true;
    void snapshotPages()
      .catch(() => [])
      .then((pages) => {
        if (active) setSnapshotList(pages);
      });
    return () => {
      active = false;
    };
  }, [dialog]);

  /* ---------- Full-page screenshots ---------- */

  /**
   * The whole page of one preview in a tall PNG: the preview is shown on its own (so all of it is on
   * screen), scrolled screen by screen and captured, then the screens are stitched together.
   */
  const captureFullPage = (cardId: string) =>
    withCapture(async () => {
      const card = cards.find((item) => item.id === cardId);
      if (!card || !currentUrl || capturing) return;
      if (!agents.frameOf(cardId)) {
        hintAccess(t('card.menuFullPage'));
        return;
      }
      const vp = card.viewport;
      const previousFocus = focused;
      setBusy('sheet');
      try {
        setFocus({ id: vp.id, zoom: focusZoom(vp) });
        await nextFrame();
        await nextFrame();
        const metrics = await agents.ask(cardId, { type: 'pageMetrics' }, 'metrics');
        const { positions, partial } = slicePositions(metrics.scrollHeight, metrics.viewportHeight);
        const slices: { image: Blob; y: number }[] = [];
        for (const [index, y] of positions.entries()) {
          toast({
            message: t('capture.fullPageProgress', { current: index + 1, total: positions.length }),
            tone: 'info',
            key: 'sheet',
          });
          const done = await agents.ask(cardId, { type: 'captureScroll', y, hideFixed: index > 0 }, 'scrolled');
          // Lazy content and images get a moment to appear.
          await new Promise((resolve) => setTimeout(resolve, 150));
          const stage = stageOf(cardId);
          const shot = stage ? await captureElementImage(stage) : null;
          if (shot) slices.push({ image: shot.blob, y: done.y });
        }
        agents.send(cardId, { type: 'captureEnd' });
        agents.send(cardId, { type: 'captureScroll', y: metrics.scrollY, hideFixed: false });
        const image = await stitchSlices(
          slices,
          metrics.viewportHeight,
          stitchedHeight(positions, metrics.viewportHeight),
        );
        if (!image) throw new Error('Nothing captured');
        const parts = [
          'breakpointer-fullpage',
          displayHost(currentUrl),
          card.compare ? `${vp.name} B` : vp.name,
          `${vp.width}x${vp.height}`,
        ];
        const fileName = `${parts.map(fileNamePart).join('_')}_${timestamp()}.png`;
        downloadBlob(image, fileName);
        toast(
          partial
            ? {
                message: t('capture.fullPagePartial', { count: positions.length, file: fileName }),
                tone: 'info',
                key: 'sheet',
              }
            : { message: t('capture.saved', { file: fileName }), tone: 'success', key: 'sheet' },
        );
      } catch (error) {
        console.warn('[Breakpointer] Full-page screenshot failed.', error);
        agents.send(cardId, { type: 'captureEnd' });
        toast({ message: t('capture.failed'), tone: 'error', key: 'sheet' });
      } finally {
        setFocus(previousFocus);
        setBusy(null);
      }
    });

  /* ---------- Floating preview ---------- */

  const openFloating = async () => {
    if (floating) {
      floating.pip.focus();
      return;
    }
    const api = (window as PictureInPictureHost).documentPictureInPicture;
    if (!api) {
      toast({ message: t('floating.unsupported'), tone: 'info', key: 'floating' });
      return;
    }
    // The focused viewport, else the narrowest one (a phone, usually).
    const target =
      (focused && visible.find((vp) => vp.id === focused.id)) ?? [...visible].sort((a, b) => a.width - b.width)[0];
    if (!target) return;
    const scale = Math.min(
      1,
      (window.screen.availHeight * 0.75) / (target.height + FLOATING_TOOLBAR),
      (window.screen.availWidth * 0.5) / target.width,
    );
    try {
      const pip = await api.requestWindow({
        width: Math.max(260, Math.round(target.width * scale)),
        height: Math.round(target.height * scale) + FLOATING_TOOLBAR,
      });
      adoptStyles(document, pip.document);
      // Its frames don't belong to the workspace's tab: they get the rule for Breakpointer's own frames.
      await enableEmbeddingForExtensionFrames().catch(() => {});
      pip.addEventListener('pagehide', () => setFloating(null), { once: true });
      setFloating({ pip, viewportId: target.id });
    } catch (error) {
      console.warn('[Breakpointer] The floating preview could not open.', error);
      toast({ message: t('floating.failed'), tone: 'error', key: 'floating' });
    }
  };

  const closeFloating = () => {
    floating?.pip.close();
    setFloating(null);
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
    const list = cards;
    setBusy('report');
    try {
      if (focused) {
        setFocus(null);
        await nextFrame();
      }
      const reportCards: ReportCard[] = [];
      for (const [index, card] of list.entries()) {
        const vp = card.viewport;
        toast({
          message: t('report.progress', { current: index + 1, total: list.length }),
          tone: 'info',
          key: 'report',
        });
        const stage = stageOf(card.id);
        const shot = stage ? await captureElementImage(stage, 'image/jpeg') : null;
        const stats = agents.frameOf(card.id)
          ? await agents
              .ask(card.id, { type: 'getStats' }, 'stats', 2000)
              .then((reply) => reply.stats)
              .catch(() => null)
          : null;
        reportCards.push({
          name: cardTitle(card),
          width: vp.width,
          height: vp.height,
          zoom: vp.zoom,
          breakpoint: breakpointFor(settings.breakpoints, vp.width, settings.customBreakpoints, siteBreakpoints ?? []),
          image: shot ? await blobToDataUrl(shot.blob) : null,
          checks: checksOf(card.id),
          stats,
        });
      }
      // The last width scan of this page, and the element being inspected, if any.
      const coverage = scanResult && scanCoverage(scanResult.options, scanResult.samples);
      const scan =
        scanResult && coverage && scanResult.page === currentUrl.href
          ? {
              from: scanResult.options.from,
              to: scanResult.options.to,
              checkedTo: coverage.to,
              notes: coverageNotes(scanResult.options, coverage, t),
              findings: scanFindings(scanResult.samples).map(({ kind, ranges }) => ({
                name: t(CHECK_KIND_KEYS[kind]),
                widths: ranges.map((range) => rangeText(range, t)).join(', '),
              })),
            }
          : null;
      const propertyNames = {
        size: t('inspector.prop.size'),
        display: t('inspector.prop.display'),
        font: t('inspector.prop.font'),
        margin: t('inspector.prop.margin'),
        padding: t('inspector.prop.padding'),
        layout: t('inspector.prop.layout'),
        position: t('inspector.prop.position'),
      };
      const inspected = inspector.selector
        ? {
            selector: inspector.selector,
            header: [t('inspector.tableViewport'), ...INSPECTED_PROPERTIES.map((property) => propertyNames[property])],
            rows: inspectorRows.map((row) => [
              `${row.name} (${row.width}px)`,
              ...INSPECTED_PROPERTIES.map((property, index) =>
                row.info?.visible
                  ? propertyValue(row.info, property) || '—'
                  : index === 0
                    ? row.info === null
                      ? t('inspector.missing')
                      : row.info
                        ? t('inspector.hidden')
                        : t('inspector.waiting')
                    : '',
              ),
            ]),
          }
        : null;
      const title = visible.map((vp) => agents.frameOf(vp.id)?.title).find(Boolean) ?? displayHost(currentUrl);
      const html = buildReportHtml(
        {
          url: currentUrl.href,
          title,
          created: new Date(),
          version,
          language,
          cards: reportCards,
          scan,
          inspector: inspected,
        },
        t,
      );
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
    if (!currentUrl || capturing) return;
    if (visible.length === 0) {
      toast({ message: t('report.nothing'), tone: 'info' });
      return;
    }
    void withCapture(runReport);
  };

  /* ---------- Shortcuts and gestures ---------- */

  useShortcuts({
    focusAddress: () => addressRef.current?.focus(),
    reload: reloadKeepingPlace,
    add: () => setDialog('add'),
    groups: () => document.querySelector<HTMLButtonElement>('[data-groups-trigger]')?.click(),
    fit,
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
    layout: () => dispatch({ type: 'setLayout', layout: settings.layout === 'wrap' ? 'row' : 'wrap' }),
    rulers: () => dispatch({ type: 'setShowRulers', showRulers: !settings.showRulers }),
    capture: () => void capture(workspaceRef.current, ['workspace']),
    theme: toggleTheme,
    help: openHelp,
    palette: () => (dialog === 'palette' ? setDialog(null) : openPalette()),
    inspect: toggleInspector,
    audit: () => toggleAudit(),
    scan: openScan,
    visual: openVisual,
    measure: toggleMeasure,
    contrast: () => setDialog('contrast'),
    outlines: () => toggleTool('outlines'),
    prevViewport: () => cycleFocus(-1),
    nextViewport: () => cycleFocus(1),
    actualSize: () => visible.length > 0 && zoomTo(1),
    floating: () => void openFloating(),
    escape: onEscape,
    // 1–8 show that viewport on its own (again: all of them).
    viewportAt: (index) => {
      const vp = visible[index];
      if (vp) toggleFocus(vp.id);
    },
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
        annotate,
        liveCss: Boolean(liveCss),
        inspecting: inspector.open,
        auditing: audit.open,
        measuring,
        comparing: compare !== null,
        simulate: simulateState,
        windowsOpen: realWindows.length > 0,
        autoReload,
        actions: {
          reloadAll: reloadKeepingPlace,
          autoReload: setAutoReload,
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
          audit: toggleAudit,
          scan: openScan,
          visual: openVisual,
          visualSave: () => void saveBaseline(),
          visualCompare: () => void compareBaseline(),
          capture: onCapture,
          report: exportReport,
          setTheme: (theme) => dispatch({ type: 'setTheme', theme }),
          setLanguage: (lang) => dispatch({ type: 'setLanguage', language: lang }),
          openSettings: () => setDialog('settings'),
          siteAccess: () => setDialog('access'),
          help: openHelp,
          exportSettings,
          scrollBottom: scrollAllToBottom,
          copyAddress,
          copyLink: copyWorkspaceLink,
          cycleFocus,
          measure: toggleMeasure,
          contrast: () => setDialog('contrast'),
          compare: () => setDialog('compare'),
          stopCompare,
          swapCompare: swapSides,
          setVision,
          toggleSimulate,
          pageColors: setAllColorSchemes,
          applySnippet: applyLiveCss,
          openWindows: () => void openRealWindows(),
          closeWindows: closeRealWindows,
          captureWindows: () => void captureRealWindows(),
          floating: () => void openFloating(),
          fullPage: (id) => void captureFullPage(id),
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

  const inspectorRows: InspectorRow[] = cards.map((card) => {
    const result = inspector.results[card.id];
    const { width, height } = card.viewport;
    return {
      id: card.id,
      name: cardTitle(card),
      width,
      height,
      sizeClass: sizeClassOf(width, height),
      info: result && result.generation === generations[card.id] ? result.info : undefined,
    };
  });

  /** The inspector's comparison as a Markdown table, for a ticket or a pull request. */
  const copyComparison = () => {
    if (!inspector.selector) return;
    const markdown = comparisonMarkdown(inspector.selector, inspectorRows, {
      viewport: t('inspector.tableViewport'),
      missing: t('inspector.missing'),
      hidden: t('inspector.hidden'),
      waiting: t('inspector.waiting'),
      size: t('inspector.prop.size'),
      display: t('inspector.prop.display'),
      font: t('inspector.prop.font'),
      margin: t('inspector.prop.margin'),
      padding: t('inspector.prop.padding'),
      layout: t('inspector.prop.layout'),
      position: t('inspector.prop.position'),
    });
    void copyText(markdown).then((copied) =>
      toast(
        copied
          ? { message: t('inspector.tableCopied'), tone: 'success', key: 'copy' }
          : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
      ),
    );
  };

  // Every preview's checks, page stats and type, for the audit panel.
  const auditRows: AuditRow[] = cards.map((card) => ({
    id: card.id,
    name: cardTitle(card),
    width: card.viewport.width,
    height: card.viewport.height,
    report: checksOf(card.id),
    stats: auditData.statsOf(card.id),
    type: auditData.typeOf(card.id),
  }));
  // Kinds of issue found in any preview (shown on the toolbar's Audit button).
  const issueKinds = groupIssues(auditRows).length;

  /** What the audit's tab shows, as a Markdown table for a ticket or a pull request. */
  const copyAudit = () => {
    const page = currentUrl?.href ?? '';
    const markdown =
      audit.tab === 'issues'
        ? issuesMarkdown(
            page,
            auditRows,
            CHECK_KINDS.filter((kind) => !settings.disabledChecks.includes(kind)),
            t,
          )
        : audit.tab === 'performance'
          ? statsMarkdown(
              page,
              auditRows.map((row) => ({ ...row, stats: row.stats ?? null })),
              t,
              language,
            )
          : typeMarkdown(
              page,
              auditRows.map((row) => ({ ...row, samples: row.type ?? null })),
              t,
            );
    void copyText(markdown).then((copied) =>
      toast(
        copied
          ? { message: t('audit.copied'), tone: 'success', key: 'copy' }
          : { message: t('capture.copyFailed'), tone: 'error', key: 'copy' },
      ),
    );
  };

  /**
   * The inspected element cut out of every preview (each one shown on its own and
   * scrolled to the element), side by side in one labelled image.
   */
  const captureElementEverywhere = () =>
    withCapture(async () => {
      const selector = inspector.selector;
      if (!selector || !currentUrl || capturing) return;
      const list = cards.filter((card) => agents.frameOf(card.id));
      const previousFocus = focused;
      const label = inspectorRows.find((row) => row.info)?.info?.label ?? selector;
      setBusy('sheet');
      // The element as the page shows it, without the inspector's outline.
      broadcast({ type: 'select', selector: null });
      try {
        const shots: { card: CardEntry; image: Blob; rect: ElementRect; scale: number }[] = [];
        for (const [index, card] of list.entries()) {
          toast({
            message: t('inspector.captureProgress', { current: index + 1, total: list.length }),
            tone: 'info',
            key: 'sheet',
          });
          const vp = card.viewport;
          setFocus({ id: vp.id, zoom: focusZoom(vp) });
          await nextFrame();
          await nextFrame();
          const reply = await agents
            .ask(card.id, { type: 'getElementRect', selector, reveal: true }, 'elementRect')
            .catch(() => null);
          if (!reply?.rect) continue;
          const stage = stageOf(card.id);
          const shot = stage ? await captureElementImage(stage) : null;
          if (shot)
            shots.push({ card, image: shot.blob, rect: reply.rect, scale: await captureScale(shot.blob, vp.width) });
        }
        // Every crop at the same scale (the smallest captured), so sizes compare at a glance.
        const scale = Math.min(...shots.map((shot) => shot.scale));
        const entries: SheetEntry[] = [];
        for (const { card, image, rect } of shots) {
          const crop = await cropToRect(image, rect, card.viewport.width, { scale });
          if (crop)
            entries.push({
              image: crop,
              title: cardTitle(card),
              subtitle: `${card.viewport.width} × ${card.viewport.height} · ${Math.round(rect.width)} × ${Math.round(rect.height)}`,
            });
        }
        if (entries.length === 0) {
          toast({ message: t('inspector.captureNone'), tone: 'info', key: 'sheet' });
          return;
        }
        const sheet = await composeSheet(entries, {
          heading: label,
          url: currentUrl.href,
          footer: `Breakpointer · ${new Date().toLocaleString(language)}`,
        });
        if (!sheet) throw new Error('Nothing captured');
        const fileName = `breakpointer-element_${fileNamePart(displayHost(currentUrl))}_${fileNamePart(label)}_${timestamp()}.png`;
        downloadBlob(sheet, fileName);
        toast({ message: t('capture.saved', { file: fileName }), tone: 'success', key: 'sheet' });
      } catch (error) {
        console.warn('[Breakpointer] Capturing the element failed.', error);
        toast({ message: t('capture.failed'), tone: 'error', key: 'sheet' });
      } finally {
        setFocus(previousFocus);
        setBusy(null);
        // The outline back on the element inspected now (the selection may have changed meanwhile).
        broadcast({ type: 'select', selector: inspectedNow.current });
      }
    });

  const revealCard = (id: string) => {
    if (focused && focused.id !== viewportIdOf(id)) setFocus(null);
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-card-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }),
    );
  };

  const renderCards = () => (
    <div className={styles.cards} data-layout={settings.layout} data-focus={focused ? '' : undefined} data-cards>
      {domOrder.map((id) => {
        const index = cards.findIndex((item) => item.id === id);
        const card = cards[index];
        if (!card) return null;
        const vp = card.viewport;
        const zoom = focused?.id === vp.id ? focused.zoom : vp.zoom;
        return (
          <ViewportCard
            key={card.id}
            cardId={card.id}
            order={index}
            viewport={vp}
            src={cardSrc(card.id)}
            reloadKey={cardReloadKey(card.id)}
            frameName={generations[card.id] === undefined ? undefined : frameName(card.id, generations[card.id]!)}
            navigatedAway={agents.frameOf(card.id) ? strays[card.id] === true : undefined}
            index={visible.findIndex((item) => item.id === vp.id)}
            count={visible.length}
            canDuplicate={canAddViewport(viewports)}
            breakpointSet={settings.breakpoints}
            customBreakpoints={settings.customBreakpoints}
            siteBreakpoints={siteBreakpoints ?? undefined}
            snapWidths={snapWidths}
            grid={settings.grid}
            checks={checksOf(card.id)}
            httpStatus={agents.frameOf(card.id)?.status}
            onFullPage={() => void captureFullPage(card.id)}
            highlighted={highlights[card.id] ?? null}
            onHighlight={(kind) => highlight(card.id, kind)}
            showRulers={settings.showRulers}
            focused={focused?.id === vp.id}
            concealed={Boolean(focused && focused.id !== vp.id)}
            zoomOverride={focused?.id === vp.id ? focused.zoom : undefined}
            filter={visionFilter(vision)}
            measuring={measuring}
            overlay={overlays[card.id]}
            overlayScroll={overlayScroll[card.id]}
            onOverlayFile={(file) => addOverlay(card.id, cardTitle(card), file)}
            onOverlayChange={(patch) => updateOverlay(card.id, patch)}
            onOverlayRemove={() => removeOverlay(card.id)}
            compare={
              compare
                ? { side: card.compare ? 'b' : 'a', target: card.compare ? compareLabel(compare) : (host ?? '') }
                : undefined
            }
            onStopCompare={stopCompare}
            onRename={(name) => dispatch({ type: 'updateViewport', id: vp.id, patch: { name } })}
            onResize={(size) => dispatch({ type: 'updateViewport', id: vp.id, patch: size })}
            onZoom={(value) => dispatch({ type: 'updateViewport', id: vp.id, patch: { zoom: value } })}
            onRotate={() => dispatch({ type: 'rotateViewport', id: vp.id })}
            onMove={(delta) => moveVisible(vp, delta)}
            onReload={() => reloadCardKeepingPlace(card.id)}
            onCapture={(stage) =>
              // The image is taken as shown on screen, so the name says at which zoom.
              void capture(stage, [
                card.compare ? `${vp.name} B` : vp.name,
                `${vp.width}x${vp.height}`,
                `${Math.round(zoom * 100)}pct`,
              ])
            }
            onCopy={(stage) => void copyCapture(stage)}
            // The page this preview shows now (it may have followed a link on its own).
            onOpenInTab={() => {
              const shown = cardSrc(card.id);
              const page = agents.frameOf(card.id)?.href ?? shown;
              if (page) void adapter.openInTab(toSafeHref(page) ?? shown ?? page);
            }}
            onOpenInWindow={async () => {
              const page = cardSrc(card.id);
              if (!page) return;
              const size = await adapter.openInWindow(page, { width: vp.width, height: vp.height }).catch(() => null);
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
        );
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
      <VisionFilters />
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
        onReloadAll={reloadKeepingPlace}
        autoReload={autoReload}
        onAutoReload={setAutoReload}
        onOpenInTab={() => currentUrl && void adapter.openInTab(currentUrl.href)}
        onOpenWindows={() => void openRealWindows()}
        onFloating={() => void openFloating()}
        onPalette={openPalette}
        paletteShortcut={paletteShortcut}
        onCapture={onCapture}
        onSiteAccess={() => setDialog('access')}
        onToggleTheme={toggleTheme}
        resolvedTheme={resolvedTheme}
        onSettings={() => setDialog('settings')}
        onHelp={openHelp}
        helpNews={news}
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
        auditing={audit.open}
        issueKinds={issueKinds}
        onAudit={() => toggleAudit()}
        onScan={openScan}
        onVisual={openVisual}
        measuring={measuring}
        comparing={compare !== null}
        simulate={simulateState}
        onMeasure={toggleMeasure}
        onContrast={() => setDialog('contrast')}
        onCompare={() => setDialog('compare')}
        onStopCompare={stopCompare}
        onVision={setVision}
        onSimulate={toggleSimulate}
        pageColors={pageColors}
        onPageColors={setAllColorSchemes}
        windowsOpen={realWindows.length > 0}
        onOpenWindows={() => void openRealWindows()}
        onCloseWindows={closeRealWindows}
        onFloating={() => void openFloating()}
        tools={{
          syncScroll: settings.sync.scroll,
          syncNavigation: settings.sync.navigation,
          checks: settings.checks,
          outlines,
          scrollbars: hideScrollbars,
          grid: settings.grid.show,
          imageSizes: annotate.images,
          tabOrder: annotate.tabOrder,
          gridFlex: annotate.layout,
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
        onCopyLink={copyWorkspaceLink}
        onAllowSite={() => void allowSite()}
      />
      {compare && currentUrl && (
        <Banner
          tone="info"
          icon="split"
          testId="compare-banner"
          actions={
            <>
              <Button size="sm" icon="swap" onClick={swapSides}>
                {t('compare.swap')}
              </Button>
              <Button size="sm" icon="pencil" onClick={() => setDialog('compare')}>
                {t('compare.change')}
              </Button>
              <Button size="sm" variant="ghost" icon="close" onClick={stopCompare}>
                {t('compare.stop')}
              </Button>
            </>
          }
        >
          {compare.mode === 'mirror'
            ? t('compare.bannerMirror', { target: compareLabel(compare) })
            : t('compare.bannerFixed', { target: compareLabel(compare) })}
        </Banner>
      )}
      {realWindows.length > 0 && (
        <Banner
          tone="info"
          icon="window"
          testId="windows-banner"
          actions={
            <>
              <Button
                size="sm"
                icon="window"
                onClick={() => void focusWindows(realWindows.map((item) => item.windowId))}
              >
                {t('windows.focus')}
              </Button>
              <Button size="sm" icon="camera" onClick={() => void captureRealWindows()}>
                {t('windows.capture')}
              </Button>
              <Button size="sm" variant="ghost" icon="close" onClick={closeRealWindows}>
                {t('windows.close')}
              </Button>
            </>
          }
        >
          {realWindows.length === 1 ? t('windows.bannerOne') : t('windows.banner', { count: realWindows.length })}
        </Banner>
      )}
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
          onAllowSession={() => void allowSiteForSession()}
          onOpenInTab={() => void adapter.openInTab(currentUrl.href)}
          onOpenWindows={() => void openRealWindows()}
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
                ) : measuring ? (
                  <DockStatus
                    icon="measure"
                    testId="measure-status"
                    action={t('measure.done')}
                    onAction={() => setMeasuring(false)}
                  >
                    {t('measure.status')}
                  </DockStatus>
                ) : vision !== 'none' ? (
                  <DockStatus
                    icon="eye"
                    testId="vision-status"
                    action={t('vision.off')}
                    onAction={() => setVision('none')}
                  >
                    {t('vision.status')} <strong>{t(VISION_KEYS[vision])}</strong>
                  </DockStatus>
                ) : autoReload && currentUrl ? (
                  <DockStatus
                    icon="reload"
                    testId="auto-reload-status"
                    action={t('reload.stop')}
                    onAction={() => setAutoReload(0)}
                  >
                    {t('reload.status', { seconds: autoReload })}
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
            onCopyTable={copyComparison}
            onCaptureAll={() => void captureElementEverywhere()}
            onAllowSite={() => void allowSite()}
          />
        )}
        {audit.open && (
          <AuditPanel
            tab={audit.tab}
            onTab={(tab) => setAudit((state) => ({ ...state, tab }))}
            rows={auditRows}
            checksOn={settings.checks}
            highlights={highlights}
            needsAccess={Boolean(currentUrl && siteAccess.site === false)}
            host={host}
            busy={requesting}
            measuring={auditData.measuring}
            locale={language}
            onHighlight={(cardId, kind) => {
              highlight(cardId, kind);
              if (kind) revealCard(cardId);
            }}
            onReveal={revealCard}
            onRefresh={auditData.refresh}
            onCopy={copyAudit}
            onTurnOnChecks={() => setChecks(true)}
            onAllowSite={() => void allowSite()}
            onClose={closeAudit}
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
        session={siteAccess.session}
        busy={requesting}
        onAllowSite={() => void allowSite()}
        onAllowSession={() => void allowSiteForSession()}
        onKeep={(pattern) =>
          void siteAccess.keep(pattern).then(() => toast({ message: t('access.kept'), tone: 'success' }))
        }
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
        onCheckKind={(kind, enabled) => dispatch({ type: 'setCheckKind', kind, enabled })}
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
        snapshots={snapshotList}
        onDeleteSnapshots={(page) =>
          void deletePageSnapshots(page)
            .then(snapshotPages)
            .then(setSnapshotList)
            .catch(() => toast({ message: t('visual.storageFailed'), tone: 'error' }))
        }
        onClearSnapshots={() =>
          void clearSnapshots()
            .then(() => {
              setSnapshotList([]);
              toast({ message: t('settings.snapshotsCleared'), tone: 'success' });
            })
            .catch(() => toast({ message: t('visual.storageFailed'), tone: 'error' }))
        }
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
        snippets={settings.cssSnippets}
        onSaveSnippet={saveSnippet}
        onDeleteSnippet={deleteSnippet}
      />
      {floating && (
        <FloatingPreview
          pipWindow={floating.pip}
          src={src}
          viewports={visible.map(({ id, name, width, height }) => ({ id, name, width, height }))}
          viewportId={floating.viewportId}
          theme={resolvedTheme}
          onViewport={(id) => setFloating((current) => current && { ...current, viewportId: id })}
          onWorkspace={() => void focusOwnWindow()}
          onClose={closeFloating}
        />
      )}
      <ContrastDialog
        open={dialog === 'contrast'}
        colors={contrastColors}
        onChange={setContrastColors}
        onClose={() => setDialog(null)}
      />
      <VisualDialog
        open={dialog === 'visual'}
        concealed={visualConcealed}
        hasPage={Boolean(currentUrl)}
        rows={visualRows}
        busy={visualBusy}
        onSave={() => void saveBaseline()}
        onCompare={() => void compareBaseline()}
        onAccept={(key) =>
          void visualCheck
            .accept(key)
            .then((name) => name && toast({ message: t('visual.accepted', { name }), tone: 'success', key: 'visual' }))
            .catch(() => toast({ message: t('visual.storageFailed'), tone: 'error', key: 'visual' }))
        }
        onDelete={() =>
          void visualCheck
            .removePage()
            .then(() => toast({ message: t('visual.deleted'), tone: 'success', key: 'visual' }))
            .catch(() => toast({ message: t('visual.storageFailed'), tone: 'error', key: 'visual' }))
        }
        onClose={() => {
          if (!visualBusy) setDialog(null);
        }}
      />
      <ScanDialog
        open={dialog === 'scan'}
        src={src}
        frameName={
          generations[SCAN_CARD_ID] === undefined ? undefined : frameName(SCAN_CARD_ID, generations[SCAN_CARD_ID]!)
        }
        connected={Boolean(agents.frameOf(SCAN_CARD_ID))}
        siteBreakpoints={agents.frameOf(SCAN_CARD_ID)?.media?.breakpoints ?? siteBreakpoints ?? []}
        viewports={visible.map(({ id, name, width, height }) => ({ id, name, width, height }))}
        result={scanResult}
        onResult={setScanResult}
        probe={probeScan}
        needsAccess={Boolean(currentUrl && siteAccess.site === false)}
        host={host}
        busy={requesting}
        onAllowSite={() => void allowSite()}
        onAddViewport={(width, height) => addViewport({ name: `${width}px`, width, height })}
        onCopy={copyScan}
        onClose={() => setDialog(null)}
      />
      <CompareDialog
        open={dialog === 'compare'}
        target={compare}
        current={currentUrl?.href ?? null}
        onCompare={(target) => void startCompare(target)}
        onStop={stopCompare}
        onClose={() => setDialog(null)}
      />
      <HelpDialog
        open={dialog === 'help'}
        version={version}
        onClose={() => setDialog(null)}
        commandShortcuts={commandShortcuts}
        paletteShortcut={paletteShortcut}
      />
    </div>
  );
}
