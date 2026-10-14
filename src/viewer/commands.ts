import type { PaletteCommand } from '../components/CommandPalette/CommandPalette';
import type { ToolToggle } from '../components/WorkspaceBar/WorkspaceBar';
import { BUILT_IN_GROUPS } from '../data/groups';
import { PRESETS } from '../data/presets';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';
import { builtInGroupName } from '../state/groups';
import type {
  BreakpointSetId,
  BreakpointerSettings,
  LanguagePreference,
  ThemePreference,
  ViewportConfig,
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
  liveCss: boolean;
  inspecting: boolean;
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
  };
  const add = (command: Omit<PaletteCommand, 'title' | 'keywords'> & { title: string; keywords?: string }) =>
    commands.push(command);
  /** A command named by a message key, findable by its English name too. */
  const named = (
    key: MessageKey,
    command: Omit<PaletteCommand, 'title' | 'keywords'> & { keywords?: string },
    params?: Record<string, string | number>,
  ) => add({ ...command, title: t(key, params), keywords: [en(key, params), command.keywords].filter(Boolean).join(' ') });

  /* ---------- Page ---------- */
  named('address.reloadAll', { id: 'reload', section: section.page, icon: 'reload', shortcut: 'R', disabled: !ctx.hasUrl, run: actions.reloadAll });
  named('address.openInTab', { id: 'open-tab', section: section.page, icon: 'external', disabled: !ctx.hasUrl, run: actions.openInTab });
  named('palette.scrollTop', { id: 'scroll-top', section: section.page, icon: 'chevronUp', disabled: !ctx.hasUrl, run: actions.scrollTop });

  /* ---------- Viewports ---------- */
  named('workspace.fit', { id: 'fit', section: section.viewports, icon: 'fit', shortcut: 'F', keywords: en('workspace.fitHint'), run: actions.fit });
  for (const vp of settings.viewports) {
    const size = `${vp.width} × ${vp.height}`;
    if (!vp.hidden)
      add({
        id: `focus-${vp.id}`,
        section: section.viewports,
        icon: ctx.focusedId === vp.id ? 'minimize' : 'maximize',
        title: ctx.focusedId === vp.id ? t('palette.unfocus', { name: vp.name }) : t('palette.focus', { name: vp.name }),
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
  named('tools.rotateAll', { id: 'rotate-all', section: section.viewports, icon: 'rotate', run: actions.rotateAll });
  named('tools.sortByWidth', { id: 'sort', section: section.viewports, icon: 'sort', run: actions.sortByWidth });
  named('tools.edges', { id: 'edges', section: section.viewports, icon: 'ruler', run: actions.edges });

  /* ---------- Add viewport ---------- */
  named('toolbar.addViewport', { id: 'add', section: section.add, icon: 'plus', shortcut: 'A', disabled: !ctx.canAdd, run: actions.openAdd });
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
  named('groups.manage', { id: 'group-manage', section: section.groups, icon: 'settings', disabled: settings.groups.length === 0, run: actions.manageGroups });

  /* ---------- Tools ---------- */
  named('tools.inspect', { id: 'inspect', section: section.tools, icon: 'inspect', shortcut: 'I', checked: ctx.inspecting, run: actions.inspect });
  const toggle = (id: ToolToggle, key: MessageKey, checked: boolean) =>
    named(key, { id: `tool-${id}`, section: section.tools, icon: TOOL_ICONS[id], checked, run: () => actions.toggleTool(id) });
  toggle('syncScroll', 'tools.syncScroll', settings.sync.scroll);
  toggle('syncNavigation', 'tools.syncNavigation', settings.sync.navigation);
  toggle('checks', 'tools.checks', settings.checks);
  toggle('outlines', 'tools.outlines', ctx.outlines);
  toggle('grid', 'tools.grid', settings.grid.show);
  named('workspace.rulers', { id: 'rulers', section: section.tools, icon: 'ruler', shortcut: 'M', checked: settings.showRulers, run: actions.toggleRulers });
  named('tools.liveCss', { id: 'live-css', section: section.tools, icon: 'code', checked: ctx.liveCss || undefined, run: actions.liveCss });
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

  /* ---------- View ---------- */
  for (const zoom of ZOOM_OPTIONS) {
    named('palette.zoomTo', { id: `zoom-${zoom}`, section: section.view, icon: 'search', run: () => actions.zoomTo(zoom) }, { zoom: formatZoom(zoom) });
  }
  named('palette.layoutWrap', { id: 'layout-wrap', section: section.view, icon: 'wrap', checked: settings.layout === 'wrap' || undefined, run: () => actions.setLayout('wrap') });
  named('palette.layoutRow', { id: 'layout-row', section: section.view, icon: 'row', checked: settings.layout === 'row' || undefined, run: () => actions.setLayout('row') });
  named('palette.themeLight', { id: 'theme-light', section: section.view, icon: 'sun', run: () => actions.setTheme('light') });
  named('palette.themeDark', { id: 'theme-dark', section: section.view, icon: 'moon', run: () => actions.setTheme('dark') });
  named('palette.themeSystem', { id: 'theme-system', section: section.view, icon: 'system', run: () => actions.setTheme('system') });

  /* ---------- Capture & export ---------- */
  named('capture.workspace', { id: 'capture', section: section.capture, icon: 'camera', shortcut: 'S', disabled: !ctx.hasUrl, run: () => actions.capture('workspace') });
  named('capture.all', { id: 'capture-all', section: section.capture, icon: 'gallery', disabled: !ctx.hasUrl, run: () => actions.capture('all') });
  named('capture.copy', { id: 'capture-copy', section: section.capture, icon: 'clipboard', disabled: !ctx.hasUrl, run: () => actions.capture('copy') });
  named('tools.report', { id: 'report', section: section.capture, icon: 'report', disabled: !ctx.hasUrl, run: actions.report });
  named('settings.export', { id: 'export', section: section.capture, icon: 'download', run: actions.exportSettings });

  /* ---------- Saved and recent pages ---------- */
  const recent = settings.recentUrls.filter((url) => !settings.savedPages.includes(url));
  for (const url of settings.savedPages)
    add({ id: `saved-${url}`, section: section.pages, icon: 'star', title: shortUrl(url), keywords: url, run: () => actions.navigate(url) });
  for (const url of recent)
    add({ id: `recent-${url}`, section: section.pages, icon: 'clock', title: shortUrl(url), keywords: url, run: () => actions.navigate(url) });

  /* ---------- Preferences ---------- */
  named('toolbar.settings', { id: 'settings', section: section.preferences, icon: 'settings', run: actions.openSettings });
  named('toolbar.siteAccess', { id: 'site-access', section: section.preferences, icon: 'shield', run: actions.siteAccess });
  named('toolbar.help', { id: 'help', section: section.preferences, icon: 'help', shortcut: '?', run: actions.help });
  add({ id: 'lang-en', section: section.preferences, icon: 'globe', title: 'English', keywords: 'language ngon ngu', run: () => actions.setLanguage('en') });
  add({ id: 'lang-vi', section: section.preferences, icon: 'globe', title: 'Tiếng Việt', keywords: 'language ngon ngu vietnamese', run: () => actions.setLanguage('vi') });

  return commands;
}

const TOOL_ICONS: Record<ToolToggle, PaletteCommand['icon']> = {
  syncScroll: 'link',
  syncNavigation: 'link',
  checks: 'check',
  outlines: 'outline',
  grid: 'columns',
};
