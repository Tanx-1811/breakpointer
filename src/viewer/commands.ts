import type { AuditTab } from '../components/AuditPanel/AuditPanel';
import type { PaletteCommand } from '../components/CommandPalette/CommandPalette';
import {
  VISION_KEYS,
  type SimulateState,
  type SimulateToggle,
  type ToolToggle,
} from '../components/WorkspaceBar/WorkspaceBar';
import { BUILT_IN_GROUPS } from '../data/groups';
import { PRESETS } from '../data/presets';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';
import { builtInGroupName } from '../state/groups';
import { VISION_MODES, type VisionMode } from '../state/vision';
import type {
  BreakpointSetId,
  BreakpointerSettings,
  LanguagePreference,
  ThemePreference,
  ViewportPreset,
  WorkspaceLayout,
} from '../types';
import { ZOOM_OPTIONS } from '../utils/constants';
import { formatZoom } from '../utils/format';
import type { CaptureKind } from './TopBar';

export type CommandActions = {
  reloadAll: () => void;
  openInTab: () => void;
  scrollTop: () => void;
  /* v0.4 utilities: their commands are listed when the action is given. */
  scrollBottom?: () => void;
  copyAddress?: () => void;
  cycleFocus?: (delta: 1 | -1) => void;
  measure?: () => void;
  contrast?: () => void;
  compare?: () => void;
  stopCompare?: () => void;
  swapCompare?: () => void;
  setVision?: (mode: VisionMode) => void;
  toggleSimulate?: (toggle: SimulateToggle) => void;
  applySnippet?: (css: string) => void;
  openWindows?: () => void;
  closeWindows?: () => void;
  captureWindows?: () => void;
  floating?: () => void;
  fullPage?: (cardId: string) => void;
  /** Opens (or closes) the audit panel, on a given tab. */
  audit?: (tab?: AuditTab) => void;
  /** Opens the width scanner. */
  scan?: () => void;
  navigate: (url: string) => void;
  addPreset: (preset: ViewportPreset, name: string) => void;
  openAdd: () => void;
  applyGroup: (id: string) => void;
  saveGroup: () => void;
  manageGroups: () => void;
  toggleVisible: (id: string) => void;
  showAll: () => void;
  focus: (id: string) => void;
  fit: () => void;
  zoomTo: (zoom: number) => void;
  setLayout: (layout: WorkspaceLayout) => void;
  rotateAll: () => void;
  sortByWidth: () => void;
  edges: () => void;
  toggleTool: (tool: ToolToggle) => void;
  toggleRulers: () => void;
  setBreakpoints: (set: BreakpointSetId) => void;
  liveCss: () => void;
  inspect: () => void;
  capture: (kind: CaptureKind) => void;
  report: () => void;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: LanguagePreference) => void;
  openSettings: () => void;
  siteAccess: () => void;
  help: () => void;
  exportSettings: () => void;
};

export type CommandContext = {
  t: Translate;
  /** English names too, so commands can be found by their English name in any language. */
  en: Translate;
  settings: BreakpointerSettings;
  hasUrl: boolean;
  canAdd: boolean;
  focusedId: string | null;
  outlines: boolean;
  hideScrollbars: boolean;
  /** Image size and tab order labels in the previews. */
  annotate?: { images: boolean; tabOrder: boolean; layout?: boolean };
  liveCss: boolean;
  inspecting: boolean;
  /** The audit panel is open. */
  auditing?: boolean;
  measuring?: boolean;
  comparing?: boolean;
  simulate?: SimulateState;
  /** Viewports are open as real windows. */
  windowsOpen?: boolean;
  actions: CommandActions;
};

const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function buildCommands(ctx: CommandContext): PaletteCommand[] {
  const { t, en, settings, actions } = ctx;
  const commands: PaletteCommand[] = [];
  const section = {
    page: t('palette.section.page'),
    viewports: t('palette.section.viewports'),
    add: t('palette.section.add'),
    groups: t('palette.section.groups'),
    tools: t('palette.section.tools'),
    view: t('palette.section.view'),
    capture: t('palette.section.capture'),
    pages: t('palette.section.pages'),
    preferences: t('palette.section.preferences'),
    simulate: t('palette.section.simulate'),
  };
  const add = (command: Omit<PaletteCommand, 'title' | 'keywords'> & { title: string; keywords?: string }) =>
    commands.push(command);
  /** A command named by a message key, findable by its English name too. */
  const named = (
    key: MessageKey,
    command: Omit<PaletteCommand, 'title' | 'keywords'> & { keywords?: string },
    params?: Record<string, string | number>,
  ) =>
    add({ ...command, title: t(key, params), keywords: [en(key, params), command.keywords].filter(Boolean).join(' ') });

  /* ---------- Page ---------- */
  named('address.reloadAll', {
    id: 'reload',
    section: section.page,
    icon: 'reload',
    shortcut: 'R',
    disabled: !ctx.hasUrl,
    run: actions.reloadAll,
  });
  named('address.openInTab', {
    id: 'open-tab',
    section: section.page,
    icon: 'external',
    disabled: !ctx.hasUrl,
    run: actions.openInTab,
  });
  named('palette.scrollTop', {
    id: 'scroll-top',
    section: section.page,
    icon: 'chevronUp',
    disabled: !ctx.hasUrl,
    run: actions.scrollTop,
  });
  if (actions.scrollBottom)
    named('palette.scrollBottom', {
      id: 'scroll-bottom',
      section: section.page,
      icon: 'chevronDown',
      disabled: !ctx.hasUrl,
      run: actions.scrollBottom,
    });
  if (actions.copyAddress)
    named('palette.copyAddress', {
      id: 'copy-address',
      section: section.page,
      icon: 'link',
      disabled: !ctx.hasUrl,
      run: actions.copyAddress,
    });
  if (ctx.windowsOpen && actions.closeWindows && actions.captureWindows) {
    named('windows.capture', {
      id: 'windows-capture',
      section: section.page,
      icon: 'camera',
      run: actions.captureWindows,
    });
    named('windows.close', { id: 'windows-close', section: section.page, icon: 'window', run: actions.closeWindows });
  } else if (actions.openWindows)
    named('windows.open', {
      id: 'windows-open',
      section: section.page,
      icon: 'window',
      keywords: 'real window popup sign in login',
      disabled: !ctx.hasUrl,
      run: actions.openWindows,
    });
  if (actions.floating)
    named('floating.open', {
      id: 'floating',
      section: section.page,
      icon: 'pip',
      shortcut: 'P',
      keywords: 'picture in picture always on top float pip',
      run: actions.floating,
    });
  if (ctx.comparing && actions.swapCompare && actions.compare && actions.stopCompare) {
    named('compare.swap', { id: 'compare-swap', section: section.page, icon: 'swap', run: actions.swapCompare });
    named('compare.change', { id: 'compare-change', section: section.page, icon: 'split', run: actions.compare });
    named('compare.stop', { id: 'compare-stop', section: section.page, icon: 'close', run: actions.stopCompare });
  } else if (actions.compare)
    named('tools.compare', {
      id: 'compare',
      section: section.page,
      icon: 'split',
      keywords: 'A/B staging production',
      disabled: !ctx.hasUrl,
      run: actions.compare,
    });

  /* ---------- Viewports ---------- */
  named('workspace.fit', {
    id: 'fit',
    section: section.viewports,
    icon: 'fit',
    shortcut: 'F',
    keywords: en('workspace.fitHint'),
    run: actions.fit,
  });
  for (const vp of settings.viewports) {
    const size = `${vp.width} × ${vp.height}`;
    if (!vp.hidden)
      add({
        id: `focus-${vp.id}`,
        section: section.viewports,
        icon: ctx.focusedId === vp.id ? 'minimize' : 'maximize',
        title:
          ctx.focusedId === vp.id ? t('palette.unfocus', { name: vp.name }) : t('palette.focus', { name: vp.name }),
        keywords: `${en('palette.focus', { name: vp.name })} ${vp.width}`,
        hint: size,
        run: () => actions.focus(vp.id),
      });
    add({
      id: `visible-${vp.id}`,
      section: section.viewports,
      icon: vp.hidden ? 'eye' : 'eyeOff',
      title: vp.hidden ? t('palette.show', { name: vp.name }) : t('palette.hide', { name: vp.name }),
      keywords: `${vp.hidden ? en('palette.show', { name: vp.name }) : en('palette.hide', { name: vp.name })} ${vp.width}`,
      hint: size,
      run: () => actions.toggleVisible(vp.id),
    });
  }
  if (settings.viewports.some((vp) => vp.hidden))
    named('empty.showAll', { id: 'show-all', section: section.viewports, icon: 'eye', run: actions.showAll });
  const { cycleFocus } = actions;
  if (cycleFocus) {
    named('palette.prevViewport', {
      id: 'focus-prev',
      section: section.viewports,
      icon: 'chevronLeft',
      shortcut: '[',
      run: () => cycleFocus(-1),
    });
    named('palette.nextViewport', {
      id: 'focus-next',
      section: section.viewports,
      icon: 'chevronRight',
      shortcut: ']',
      run: () => cycleFocus(1),
    });
  }
  named('tools.rotateAll', { id: 'rotate-all', section: section.viewports, icon: 'rotate', run: actions.rotateAll });
  named('tools.sortByWidth', { id: 'sort', section: section.viewports, icon: 'sort', run: actions.sortByWidth });
  named('tools.edges', { id: 'edges', section: section.viewports, icon: 'ruler', run: actions.edges });

  /* ---------- Add viewport ---------- */
  named('toolbar.addViewport', {
    id: 'add',
    section: section.add,
    icon: 'plus',
    shortcut: 'A',
    disabled: !ctx.canAdd,
    run: actions.openAdd,
  });
  for (const preset of PRESETS) {
    const name = t(`preset.${preset.id}` as MessageKey);
    add({
      id: `preset-${preset.id}`,
      section: section.add,
      icon: preset.category === 'mobile' ? 'phone' : preset.category === 'foldable' ? 'foldable' : preset.category,
      title: t('palette.addPreset', { name }),
      keywords: [
        en('palette.addPreset', { name: en(`preset.${preset.id}` as MessageKey) }),
        t(`hint.${preset.id}` as MessageKey),
        t(`category.${preset.category}` as MessageKey),
        `${preset.width}x${preset.height}`,
      ].join(' '),
      hint: `${preset.width} × ${preset.height}`,
      disabled: !ctx.canAdd,
      run: () => actions.addPreset(preset, name),
    });
  }

  /* ---------- Groups ---------- */
  for (const group of BUILT_IN_GROUPS) {
    add({
      id: `group-${group.id}`,
      section: section.groups,
      icon: 'layers',
      title: t('palette.applyGroup', { name: builtInGroupName(group, t) }),
      keywords: en('palette.applyGroup', { name: builtInGroupName(group, en) }),
      hint: String(group.viewports.length),
      run: () => actions.applyGroup(`builtin:${group.id}`),
    });
  }
  for (const group of settings.groups) {
    add({
      id: `group-${group.id}`,
      section: section.groups,
      icon: 'layers',
      title: t('palette.applyGroup', { name: group.name }),
      keywords: en('palette.applyGroup', { name: group.name }),
      hint: String(group.viewports.length),
      run: () => actions.applyGroup(group.id),
    });
  }
  named('groups.save', { id: 'group-save', section: section.groups, icon: 'save', run: actions.saveGroup });
  named('groups.manage', {
    id: 'group-manage',
    section: section.groups,
    icon: 'settings',
    disabled: settings.groups.length === 0,
    run: actions.manageGroups,
  });

  /* ---------- Tools ---------- */
  named('tools.inspect', {
    id: 'inspect',
    section: section.tools,
    icon: 'inspect',
    shortcut: 'I',
    checked: ctx.inspecting,
    run: actions.inspect,
  });
  const { audit, scan } = actions;
  if (scan)
    named('scan.title', {
      id: 'scan',
      section: section.tools,
      icon: 'scan',
      shortcut: 'W',
      keywords: 'sweep every width breakpoints find where layout breaks overflow range',
      disabled: !ctx.hasUrl,
      run: scan,
    });
  if (audit) {
    named('audit.open', {
      id: 'audit',
      section: section.tools,
      icon: 'report',
      shortcut: 'E',
      checked: Boolean(ctx.auditing),
      keywords: 'issues problems checks summary dashboard',
      run: () => audit(),
    });
    named('palette.auditPerformance', {
      id: 'audit-performance',
      section: section.tools,
      icon: 'clock',
      keywords: 'page weight bytes requests lcp cls web vitals speed images',
      run: () => audit('performance'),
    });
    named('palette.auditType', {
      id: 'audit-type',
      section: section.tools,
      icon: 'text',
      keywords: 'typography font size line height headings scale',
      run: () => audit('type'),
    });
  }
  const toggle = (id: ToolToggle, key: MessageKey, checked: boolean) =>
    named(key, {
      id: `tool-${id}`,
      section: section.tools,
      icon: TOOL_ICONS[id],
      checked,
      run: () => actions.toggleTool(id),
    });
  toggle('syncScroll', 'tools.syncScroll', settings.sync.scroll);
  toggle('syncNavigation', 'tools.syncNavigation', settings.sync.navigation);
  toggle('checks', 'tools.checks', settings.checks);
  toggle('outlines', 'tools.outlines', ctx.outlines);
  toggle('scrollbars', 'tools.scrollbars', ctx.hideScrollbars);
  toggle('grid', 'tools.grid', settings.grid.show);
  if (ctx.annotate) {
    toggle('imageSizes', 'tools.imageSizes', ctx.annotate.images);
    toggle('tabOrder', 'tools.tabOrder', ctx.annotate.tabOrder);
    toggle('gridFlex', 'tools.gridFlex', Boolean(ctx.annotate.layout));
  }
  named('workspace.rulers', {
    id: 'rulers',
    section: section.tools,
    icon: 'ruler',
    shortcut: 'M',
    checked: settings.showRulers,
    run: actions.toggleRulers,
  });
  named('tools.liveCss', {
    id: 'live-css',
    section: section.tools,
    icon: 'code',
    checked: ctx.liveCss || undefined,
    run: actions.liveCss,
  });
  const { applySnippet } = actions;
  if (applySnippet)
    for (const snippet of settings.cssSnippets)
      add({
        id: `snippet-${snippet.id}`,
        section: section.tools,
        icon: 'code',
        title: t('palette.applySnippet', { name: snippet.name }),
        keywords: `${en('palette.applySnippet', { name: snippet.name })} css`,
        run: () => applySnippet(snippet.css),
      });
  if (actions.measure)
    named('tools.measure', {
      id: 'measure',
      section: section.tools,
      icon: 'measure',
      shortcut: 'X',
      checked: Boolean(ctx.measuring),
      keywords: 'ruler distance pixels',
      run: actions.measure,
    });
  if (actions.contrast)
    named('tools.contrast', {
      id: 'contrast',
      section: section.tools,
      icon: 'eyedropper',
      shortcut: 'C',
      keywords: 'colour color wcag eyedropper picker accessibility',
      run: actions.contrast,
    });
  for (const set of ['tailwind', 'bootstrap', 'custom', 'site', 'none'] as const) {
    named(
      'palette.breakpoints',
      {
        id: `breakpoints-${set}`,
        section: section.tools,
        icon: 'tag',
        checked: settings.breakpoints === set || undefined,
        run: () => actions.setBreakpoints(set),
      },
      { set: t(set === 'none' ? 'breakpoints.noneLabel' : (`breakpoints.${set}` as MessageKey)) },
    );
  }

  /* ---------- Simulate ---------- */
  const { setVision, toggleSimulate } = actions;
  const state = ctx.simulate;
  if (state && setVision)
    for (const mode of ['none', ...VISION_MODES] as VisionMode[])
      named(
        'palette.vision',
        {
          id: `vision-${mode}`,
          section: section.simulate,
          icon: 'eye',
          checked: state.vision === mode || undefined,
          keywords: 'colour blind color blindness simulate',
          run: () => setVision(mode),
        },
        { mode: t(VISION_KEYS[mode]) },
      );
  const simulate = (id: SimulateToggle, key: MessageKey, icon: PaletteCommand['icon'], keywords: string) => {
    if (!state || !toggleSimulate) return;
    named(key, {
      id: `simulate-${id}`,
      section: section.simulate,
      icon,
      checked: state[id],
      keywords,
      run: () => toggleSimulate(id),
    });
  };
  simulate('reduceMotion', 'motion.reduce', 'pause', 'prefers-reduced-motion accessibility');
  simulate('moreContrast', 'prefs.moreContrast', 'contrast', 'prefers-contrast high contrast accessibility');
  simulate('print', 'prefs.print', 'report', 'print media printer');
  simulate('pauseAnimations', 'animations.pause', 'pause', 'freeze transition');
  simulate('pseudo', 'stress.pseudo', 'text', 'pseudo localization translation i18n');
  simulate('rtl', 'stress.rtl', 'arrowLeft', 'rtl arabic hebrew direction');
  simulate('spacing', 'stress.spacing', 'text', 'wcag text spacing letter word line height');

  /* ---------- View ---------- */
  for (const zoom of ZOOM_OPTIONS) {
    named(
      'palette.zoomTo',
      { id: `zoom-${zoom}`, section: section.view, icon: 'search', run: () => actions.zoomTo(zoom) },
      { zoom: formatZoom(zoom) },
    );
  }
  named('palette.layoutWrap', {
    id: 'layout-wrap',
    section: section.view,
    icon: 'wrap',
    checked: settings.layout === 'wrap' || undefined,
    run: () => actions.setLayout('wrap'),
  });
  named('palette.layoutRow', {
    id: 'layout-row',
    section: section.view,
    icon: 'row',
    checked: settings.layout === 'row' || undefined,
    run: () => actions.setLayout('row'),
  });
  named('palette.themeLight', {
    id: 'theme-light',
    section: section.view,
    icon: 'sun',
    run: () => actions.setTheme('light'),
  });
  named('palette.themeDark', {
    id: 'theme-dark',
    section: section.view,
    icon: 'moon',
    run: () => actions.setTheme('dark'),
  });
  named('palette.themeSystem', {
    id: 'theme-system',
    section: section.view,
    icon: 'system',
    run: () => actions.setTheme('system'),
  });

  /* ---------- Capture & export ---------- */
  named('capture.workspace', {
    id: 'capture',
    section: section.capture,
    icon: 'camera',
    shortcut: 'S',
    disabled: !ctx.hasUrl,
    run: () => actions.capture('workspace'),
  });
  const { fullPage } = actions;
  if (fullPage)
    for (const vp of settings.viewports.filter((item) => !item.hidden))
      add({
        id: `full-page-${vp.id}`,
        section: section.capture,
        icon: 'image',
        title: t('palette.fullPage', { name: vp.name }),
        keywords: `${en('palette.fullPage', { name: vp.name })} ${vp.width} screenshot long scroll`,
        hint: `${vp.width} × ${vp.height}`,
        disabled: !ctx.hasUrl,
        run: () => fullPage(vp.id),
      });
  named('capture.all', {
    id: 'capture-all',
    section: section.capture,
    icon: 'gallery',
    disabled: !ctx.hasUrl,
    run: () => actions.capture('all'),
  });
  named('capture.copy', {
    id: 'capture-copy',
    section: section.capture,
    icon: 'clipboard',
    disabled: !ctx.hasUrl,
    run: () => actions.capture('copy'),
  });
  named('tools.report', {
    id: 'report',
    section: section.capture,
    icon: 'report',
    disabled: !ctx.hasUrl,
    run: actions.report,
  });
  named('settings.export', { id: 'export', section: section.capture, icon: 'download', run: actions.exportSettings });

  /* ---------- Saved and recent pages ---------- */
  const recent = settings.recentUrls.filter((url) => !settings.savedPages.includes(url));
  for (const url of settings.savedPages)
    add({
      id: `saved-${url}`,
      section: section.pages,
      icon: 'star',
      title: shortUrl(url),
      keywords: url,
      run: () => actions.navigate(url),
    });
  for (const url of recent)
    add({
      id: `recent-${url}`,
      section: section.pages,
      icon: 'clock',
      title: shortUrl(url),
      keywords: url,
      run: () => actions.navigate(url),
    });

  /* ---------- Preferences ---------- */
  named('toolbar.settings', {
    id: 'settings',
    section: section.preferences,
    icon: 'settings',
    run: actions.openSettings,
  });
  named('toolbar.siteAccess', {
    id: 'site-access',
    section: section.preferences,
    icon: 'shield',
    run: actions.siteAccess,
  });
  named('toolbar.help', { id: 'help', section: section.preferences, icon: 'help', shortcut: '?', run: actions.help });
  add({
    id: 'lang-en',
    section: section.preferences,
    icon: 'globe',
    title: 'English',
    keywords: 'language ngon ngu',
    run: () => actions.setLanguage('en'),
  });
  add({
    id: 'lang-vi',
    section: section.preferences,
    icon: 'globe',
    title: 'Tiếng Việt',
    keywords: 'language ngon ngu vietnamese',
    run: () => actions.setLanguage('vi'),
  });

  return commands;
}

const TOOL_ICONS: Record<ToolToggle, PaletteCommand['icon']> = {
  syncScroll: 'link',
  syncNavigation: 'link',
  checks: 'check',
  outlines: 'outline',
  scrollbars: 'eyeOff',
  grid: 'columns',
  imageSizes: 'image',
  tabOrder: 'keyboard',
  gridFlex: 'columns',
};
