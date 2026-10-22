import { CHECK_KINDS, type CheckKind } from '../agent/protocol';
import { FRAMEWORK_SET_IDS } from '../data/breakpoints';
import { DEFAULT_PRESET_IDS, findPreset } from '../data/presets';
import { en, type MessageKey } from '../i18n/en';
import { EMPTY_BRANDING, parseBranding } from '../state/branding';
import type { CompareTarget } from '../state/compare';
import { MAX_PROJECTS, normalizeProjectName } from '../state/projects';
import { normalizeGroupName } from '../state/groups';
import {
  clampDimension,
  clampZoom,
  createViewport,
  normalizeName,
  orientationOf,
  suggestedZoom,
} from '../state/viewports';
import type {
  Breakpoint,
  BreakpointSetId,
  ColorScheme,
  CssSnippet,
  SidePanelSettings,
  GridColumns,
  GridSettings,
  LanguagePreference,
  ThemePreference,
  Project,
  ProjectViewport,
  ViewportConfig,
  ViewportGroup,
  BreakpointerSettings,
  ViewportTemplate,
  WorkspaceLayout,
} from '../types';
import {
  DEFAULT_ZOOM,
  BASELINE_OPTIONS,
  GRID_COLUMN_OPTIONS,
  MAX_BREAKPOINT_NAME,
  MAX_CSS_SNIPPETS,
  MAX_CUSTOM_BREAKPOINTS,
  MAX_GRID_SPACING,
  MAX_GROUPS,
  MAX_LIVE_CSS,
  MAX_RECENT_URLS,
  MAX_SAVED_PAGES,
  MAX_SNIPPET_NAME,
  MAX_VIEWPORTS,
} from '../utils/constants';
import { createId } from '../utils/id';
import { toSafeHref } from '../utils/url';

export const STORAGE_KEY = 'breakpointer.settings';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const LANGUAGES: readonly LanguagePreference[] = ['auto', 'en', 'vi', 'es', 'pt-BR', 'fr', 'de', 'ja', 'id'];
const LAYOUTS: readonly WorkspaceLayout[] = ['wrap', 'row'];
const BREAKPOINT_SETS: readonly BreakpointSetId[] = ['none', ...FRAMEWORK_SET_IDS, 'custom', 'site'];
const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark'];

/** Names default viewports; lets callers create them in the user's language. */
export type PresetNamer = (presetId: string) => string;

const englishNamer: PresetNamer = (id) => en[`preset.${id}` as MessageKey] ?? id;

/**
 * The first-run viewports. Their ids are fixed, so two workspace tabs opened
 * on a fresh install create the same workspace instead of replacing each
 * other's (which would reload every preview).
 */
export function defaultViewports(name: PresetNamer = englishNamer): ViewportConfig[] {
  return DEFAULT_PRESET_IDS.map((id) => {
    const preset = findPreset(id)!;
    const viewport = createViewport({
      name: name(id),
      width: preset.width,
      height: preset.height,
      zoom: suggestedZoom(preset.width, preset.height),
    });
    return { ...viewport, id: `default-${id}` };
  });
}

export function defaultSettings(name?: PresetNamer): BreakpointerSettings {
  return {
    version: 1,
    theme: 'system',
    language: 'auto',
    layout: 'wrap',
    breakpoints: 'none',
    customBreakpoints: DEFAULT_CUSTOM_BREAKPOINTS.map((breakpoint) => ({ ...breakpoint })),
    showRulers: false,
    grid: { ...DEFAULT_GRID },
    sync: { scroll: true, navigation: true, interactions: false },
    checks: true,
    disabledChecks: [],
    embedHints: true,
    viewports: defaultViewports(name),
    groups: [],
    rememberRecent: false,
    recentUrls: [],
    savedPages: [],
    cssSnippets: [],
    sidePanel: { ...DEFAULT_SIDE_PANEL },
    branding: { ...EMPTY_BRANDING },
    projects: [],
  };
}

export const DEFAULT_SIDE_PANEL: SidePanelSettings = { preset: 'mobile-m', landscape: false };

function parseSidePanel(raw: unknown): SidePanelSettings {
  if (!isRecord(raw)) return { ...DEFAULT_SIDE_PANEL };
  return {
    preset: typeof raw.preset === 'string' && findPreset(raw.preset) ? raw.preset : DEFAULT_SIDE_PANEL.preset,
    landscape: raw.landscape === true,
  };
}

export const DEFAULT_GRID: GridSettings = { show: false, columns: 'auto', gutter: 24, margin: 16, baseline: 0 };
export const DEFAULT_CUSTOM_BREAKPOINTS: Breakpoint[] = [
  { name: 'sm', min: 640 },
  { name: 'md', min: 768 },
  { name: 'lg', min: 1024 },
  { name: 'xl', min: 1280 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseTemplate(raw: unknown): ViewportTemplate | null {
  if (!isRecord(raw) || !isFiniteNumber(raw.width) || !isFiniteNumber(raw.height)) return null;
  const width = clampDimension(raw.width);
  const height = clampDimension(raw.height);
  const colorScheme = COLOR_SCHEMES.find((scheme) => scheme === raw.colorScheme);
  return {
    name: normalizeName(typeof raw.name === 'string' ? raw.name : '', width, height),
    width,
    height,
    zoom: isFiniteNumber(raw.zoom) ? clampZoom(raw.zoom) : DEFAULT_ZOOM,
    ...(colorScheme ? { colorScheme } : {}),
  };
}

/** Ids end up in DOM attributes, selectors and frame names: letters, digits, _ and - only. */
const SAFE_ID = /^[\w-]{1,64}$/;
const safeId = (value: unknown) => (typeof value === 'string' && SAFE_ID.test(value) ? value : '');

function parseViewport(raw: unknown, seenIds: Set<string>): ViewportConfig | null {
  const template = parseTemplate(raw);
  if (!template || !isRecord(raw)) return null;

  let id = safeId(raw.id);
  if (!id || seenIds.has(id)) id = createId();
  seenIds.add(id);

  return {
    id,
    ...template,
    orientation: orientationOf(template.width, template.height),
    hidden: raw.hidden === true,
  };
}

function parseGroups(raw: unknown): ViewportGroup[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const groups: ViewportGroup[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.name !== 'string' || !Array.isArray(item.viewports)) continue;
    const name = normalizeGroupName(item.name);
    const viewports = item.viewports
      .map(parseTemplate)
      .filter((vp): vp is ViewportTemplate => vp !== null)
      .slice(0, MAX_VIEWPORTS);
    if (!name || viewports.length === 0) continue;
    let id = safeId(item.id);
    if (!id || seenIds.has(id)) id = createId();
    seenIds.add(id);
    groups.push({ id, name, viewports });
    if (groups.length === MAX_GROUPS) break;
  }
  return groups;
}

function parseUrlList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const urls = raw.map(toSafeHref).filter((url): url is string => url !== undefined);
  return [...new Set(urls)].slice(0, max);
}

function parseRecentUrls(raw: unknown): string[] {
  return parseUrlList(raw, MAX_RECENT_URLS);
}

/** Valid, de-duplicated breakpoints sorted by width; null if the value isn't a list. */
export function parseBreakpoints(raw: unknown): Breakpoint[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<number>();
  const names = new Set<string>();
  const list: Breakpoint[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !isFiniteNumber(item.min) || typeof item.name !== 'string') continue;
    const name = item.name.trim().slice(0, MAX_BREAKPOINT_NAME);
    const min = clampDimension(item.min);
    if (!name || seen.has(min) || names.has(name.toLowerCase())) continue;
    seen.add(min);
    names.add(name.toLowerCase());
    list.push({ name, min });
  }
  return list.sort((a, b) => a.min - b.min).slice(0, MAX_CUSTOM_BREAKPOINTS);
}

/** A snippet name: one line, trimmed, at most MAX_SNIPPET_NAME characters. */
export function normalizeSnippetName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_NAME);
}

function parseSnippets(raw: unknown): CssSnippet[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const snippets: CssSnippet[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.css !== 'string') continue;
    const name = normalizeSnippetName(item.name);
    const css = item.css.trim().slice(0, MAX_LIVE_CSS);
    if (!name || !css) continue;
    let id = safeId(item.id);
    if (!id || seenIds.has(id)) id = createId();
    seenIds.add(id);
    snippets.push({ id, name, css });
    if (snippets.length === MAX_CSS_SNIPPETS) break;
  }
  return snippets;
}

function parseCompareTarget(raw: unknown): CompareTarget | null {
  if (!isRecord(raw)) return null;
  if (raw.mode === 'fixed') {
    const url = toSafeHref(raw.url);
    return url ? { mode: 'fixed', url } : null;
  }
  if (raw.mode === 'mirror' && typeof raw.origin === 'string') {
    const href = toSafeHref(raw.origin);
    return href ? { mode: 'mirror', origin: new URL(href).origin } : null;
  }
  return null;
}

/** Saved projects: each one checked field by field; names are unique (the first wins). */
function parseProjects(raw: unknown): Project[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const names = new Set<string>();
  const projects: Project[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.name !== 'string' || !Array.isArray(item.viewports)) continue;
    const name = normalizeProjectName(item.name);
    const url = toSafeHref(item.url);
    const viewports = item.viewports
      .map((vp): ProjectViewport | null => {
        const template = parseTemplate(vp);
        if (!template) return null;
        return isRecord(vp) && vp.hidden === true ? { ...template, hidden: true } : template;
      })
      .filter((vp): vp is ProjectViewport => vp !== null)
      .slice(0, MAX_VIEWPORTS);
    if (!name || !url || viewports.length === 0 || names.has(name.toLocaleLowerCase())) continue;
    let id = safeId(item.id);
    if (!id || seenIds.has(id)) id = createId();
    seenIds.add(id);
    names.add(name.toLocaleLowerCase());
    projects.push({
      id,
      name,
      url,
      viewports,
      breakpoints: oneOf(item.breakpoints, BREAKPOINT_SETS, 'none'),
      customBreakpoints: parseBreakpoints(item.customBreakpoints) ?? [],
      grid: parseGrid(item.grid),
      css: typeof item.css === 'string' ? item.css.slice(0, MAX_LIVE_CSS) : '',
      compare: parseCompareTarget(item.compare),
      saved: isFiniteNumber(item.saved) && item.saved > 0 ? item.saved : 0,
    });
    if (projects.length === MAX_PROJECTS) break;
  }
  return projects;
}

/** Known check ids only, each once, in the order the checks are shown. */
function parseDisabledChecks(raw: unknown): CheckKind[] {
  if (!Array.isArray(raw)) return [];
  return CHECK_KINDS.filter((kind) => raw.includes(kind));
}

function parseGrid(raw: unknown): GridSettings {
  if (!isRecord(raw)) return { ...DEFAULT_GRID };
  const columns = GRID_COLUMN_OPTIONS.includes(raw.columns as GridColumns)
    ? (raw.columns as GridColumns)
    : DEFAULT_GRID.columns;
  const spacing = (value: unknown, fallback: number) =>
    isFiniteNumber(value) ? Math.min(MAX_GRID_SPACING, Math.max(0, Math.round(value))) : fallback;
  return {
    show: raw.show === true,
    columns,
    gutter: spacing(raw.gutter, DEFAULT_GRID.gutter),
    margin: spacing(raw.margin, DEFAULT_GRID.margin),
    baseline: (BASELINE_OPTIONS as readonly unknown[]).includes(raw.baseline) ? (raw.baseline as number) : 0,
  };
}

/**
 * Validates settings read from storage or an imported file. Stored data is
 * untrusted: it may be missing, malformed, or written by another version.
 * Every field falls back to a safe default independently.
 */
export function parseSettings(raw: unknown, name?: PresetNamer): BreakpointerSettings {
  const defaults = defaultSettings(name);
  if (!isRecord(raw)) return defaults;

  const seenIds = new Set<string>();
  const viewports = Array.isArray(raw.viewports)
    ? raw.viewports
        .map((vp) => parseViewport(vp, seenIds))
        .filter((vp): vp is ViewportConfig => vp !== null)
        .slice(0, MAX_VIEWPORTS)
    : defaults.viewports;

  const rememberRecent = raw.rememberRecent === true;
  const settings: BreakpointerSettings = {
    version: 1,
    theme: oneOf(raw.theme, THEMES, defaults.theme),
    language: oneOf(raw.language, LANGUAGES, defaults.language),
    layout: oneOf(raw.layout, LAYOUTS, defaults.layout),
    breakpoints: oneOf(raw.breakpoints, BREAKPOINT_SETS, defaults.breakpoints),
    customBreakpoints: parseBreakpoints(raw.customBreakpoints) ?? defaults.customBreakpoints,
    showRulers: raw.showRulers === true,
    grid: parseGrid(raw.grid),
    sync: {
      scroll: isRecord(raw.sync) ? raw.sync.scroll !== false : true,
      navigation: isRecord(raw.sync) ? raw.sync.navigation !== false : true,
      interactions: isRecord(raw.sync) && raw.sync.interactions === true,
    },
    checks: raw.checks !== false,
    disabledChecks: parseDisabledChecks(raw.disabledChecks),
    embedHints: raw.embedHints !== false,
    viewports,
    groups: parseGroups(raw.groups),
    rememberRecent,
    recentUrls: rememberRecent ? parseRecentUrls(raw.recentUrls) : [],
    savedPages: parseUrlList(raw.savedPages, MAX_SAVED_PAGES),
    cssSnippets: parseSnippets(raw.cssSnippets),
    sidePanel: parseSidePanel(raw.sidePanel),
    branding: parseBranding(raw.branding),
    projects: parseProjects(raw.projects),
  };
  const activeUrl = toSafeHref(raw.activeUrl);
  if (activeUrl) settings.activeUrl = activeUrl;
  return settings;
}

export async function readStoredSettings(): Promise<unknown> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY];
}

export async function loadSettings(name?: PresetNamer): Promise<BreakpointerSettings> {
  try {
    return parseSettings(await readStoredSettings(), name);
  } catch (error) {
    console.warn('[Breakpointer] Could not read settings, using defaults.', error);
    return defaultSettings(name);
  }
}

export async function saveSettings(settings: BreakpointerSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

/** Changes stored settings from a page without its own copy (the side panel); open workspaces follow. */
export async function updateStoredSettings(
  update: (settings: BreakpointerSettings) => BreakpointerSettings,
): Promise<void> {
  await saveSettings(update(await loadSettings()));
}

/** Calls back with the raw stored value whenever settings change in storage (e.g. from another tab). */
export function onStoredSettingsChanged(callback: (raw: unknown) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && STORAGE_KEY in changes) callback(changes[STORAGE_KEY]?.newValue);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/* ---------- Export / import ---------- */

const EXPORT_APP = 'Breakpointer';
/** Exports made before the product was renamed are accepted too. */
const IMPORTABLE_APPS: readonly unknown[] = [EXPORT_APP, 'ViewportLab'];
const EXPORT_KIND = 'settings';

export type SettingsExport = {
  app: typeof EXPORT_APP;
  kind: typeof EXPORT_KIND;
  version: 1;
  exportedAt: string;
  settings: Omit<BreakpointerSettings, 'recentUrls' | 'activeUrl' | 'rememberRecent'>;
};

/** Browsing data (recent and last address) is never included in exports. */
export function createSettingsExport(settings: BreakpointerSettings, now = new Date()): SettingsExport {
  const { recentUrls: _recent, activeUrl: _active, rememberRecent: _remember, ...shareable } = settings;
  return { app: EXPORT_APP, kind: EXPORT_KIND, version: 1, exportedAt: now.toISOString(), settings: shareable };
}

/** Parses the text of an exported file (tolerating a byte order mark); null if it isn't one. */
export function parseSettingsFile(text: string, current: BreakpointerSettings): BreakpointerSettings | null {
  try {
    return parseSettingsImport(JSON.parse(text.replace(/^\uFEFF/, '')), current);
  } catch {
    return null;
  }
}

/**
 * Validates an imported file and merges it with the current settings. Local
 * browsing preferences (recent addresses) are kept, and so is anything the
 * file doesn't contain. Returns null if the data isn't a Breakpointer export.
 */
export function parseSettingsImport(raw: unknown, current: BreakpointerSettings): BreakpointerSettings | null {
  if (!isRecord(raw) || !IMPORTABLE_APPS.includes(raw.app) || raw.kind !== EXPORT_KIND || !isRecord(raw.settings)) {
    return null;
  }
  const provided = raw.settings;
  const imported = parseSettings({ ...provided, rememberRecent: false });
  const merged: BreakpointerSettings = {
    ...imported,
    rememberRecent: current.rememberRecent,
    recentUrls: current.recentUrls,
  };
  // A file from an older version lacks newer settings (e.g. saved pages): keep the current ones.
  const keep = merged as Record<keyof BreakpointerSettings, unknown>;
  for (const key of Object.keys(current) as (keyof BreakpointerSettings)[]) {
    if (!(key in provided) && key !== 'activeUrl') keep[key] = current[key];
  }
  if (current.activeUrl) merged.activeUrl = current.activeUrl;
  return merged;
}

export function addRecentUrl(list: string[], url: string): string[] {
  return [url, ...list.filter((item) => item !== url)].slice(0, MAX_RECENT_URLS);
}
