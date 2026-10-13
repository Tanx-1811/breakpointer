import { DEFAULT_PRESET_IDS, findPreset } from '../data/presets';
import { en, type MessageKey } from '../i18n/en';
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
  BreakpointSetId,
  LanguagePreference,
  ThemePreference,
  ViewportConfig,
  ViewportGroup,
  ViewportLabSettings,
  ViewportTemplate,
  WorkspaceLayout,
} from '../types';
import { DEFAULT_ZOOM, MAX_GROUPS, MAX_RECENT_URLS, MAX_VIEWPORTS } from '../utils/constants';
import { createId } from '../utils/id';
import { toSafeHref } from '../utils/url';

export const STORAGE_KEY = 'viewportlab.settings';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const LANGUAGES: readonly LanguagePreference[] = ['auto', 'en', 'vi'];
const LAYOUTS: readonly WorkspaceLayout[] = ['wrap', 'row'];
const BREAKPOINT_SETS: readonly BreakpointSetId[] = ['none', 'tailwind', 'bootstrap'];

/** Names default viewports; lets callers create them in the user's language. */
export type PresetNamer = (presetId: string) => string;

const englishNamer: PresetNamer = (id) => en[`preset.${id}` as MessageKey] ?? id;

export function defaultViewports(name: PresetNamer = englishNamer): ViewportConfig[] {
  return DEFAULT_PRESET_IDS.map((id) => {
    const preset = findPreset(id)!;
    return createViewport({
      name: name(id),
      width: preset.width,
      height: preset.height,
      zoom: suggestedZoom(preset.width, preset.height),
    });
  });
}

export function defaultSettings(name?: PresetNamer): ViewportLabSettings {
  return {
    version: 1,
    theme: 'system',
    language: 'auto',
    layout: 'wrap',
    breakpoints: 'none',
    showRulers: false,
    embedHints: true,
    viewports: defaultViewports(name),
    groups: [],
    rememberRecent: false,
    recentUrls: [],
  };
}

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
  return {
    name: normalizeName(typeof raw.name === 'string' ? raw.name : '', width, height),
    width,
    height,
    zoom: isFiniteNumber(raw.zoom) ? clampZoom(raw.zoom) : DEFAULT_ZOOM,
  };
}

function parseViewport(raw: unknown, seenIds: Set<string>): ViewportConfig | null {
  const template = parseTemplate(raw);
  if (!template || !isRecord(raw)) return null;

  let id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64 ? raw.id : '';
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
    let id = typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 64 ? item.id : '';
    if (!id || seenIds.has(id) || id.startsWith('builtin:')) id = createId();
    seenIds.add(id);
    groups.push({ id, name, viewports });
    if (groups.length === MAX_GROUPS) break;
  }
  return groups;
}

function parseRecentUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const urls = raw.map(toSafeHref).filter((url): url is string => url !== undefined);
  return [...new Set(urls)].slice(0, MAX_RECENT_URLS);
}

/**
 * Validates settings read from storage or an imported file. Stored data is
 * untrusted: it may be missing, malformed, or written by another version.
 * Every field falls back to a safe default independently.
 */
export function parseSettings(raw: unknown, name?: PresetNamer): ViewportLabSettings {
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
  const settings: ViewportLabSettings = {
    version: 1,
    theme: oneOf(raw.theme, THEMES, defaults.theme),
    language: oneOf(raw.language, LANGUAGES, defaults.language),
    layout: oneOf(raw.layout, LAYOUTS, defaults.layout),
    breakpoints: oneOf(raw.breakpoints, BREAKPOINT_SETS, defaults.breakpoints),
    showRulers: raw.showRulers === true,
    embedHints: raw.embedHints !== false,
    viewports,
    groups: parseGroups(raw.groups),
    rememberRecent,
    recentUrls: rememberRecent ? parseRecentUrls(raw.recentUrls) : [],
  };
  const activeUrl = toSafeHref(raw.activeUrl);
  if (activeUrl) settings.activeUrl = activeUrl;
  return settings;
}

export async function readStoredSettings(): Promise<unknown> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY];
}

export async function loadSettings(name?: PresetNamer): Promise<ViewportLabSettings> {
  try {
    return parseSettings(await readStoredSettings(), name);
  } catch (error) {
    console.warn('[ViewportLab] Could not read settings, using defaults.', error);
    return defaultSettings(name);
  }
}

export async function saveSettings(settings: ViewportLabSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

/* ---------- Export / import ---------- */

const EXPORT_APP = 'ViewportLab';
const EXPORT_KIND = 'settings';

export type SettingsExport = {
  app: typeof EXPORT_APP;
  kind: typeof EXPORT_KIND;
  version: 1;
  exportedAt: string;
  settings: Omit<ViewportLabSettings, 'recentUrls' | 'activeUrl' | 'rememberRecent'>;
};

/** Browsing data (recent and last address) is never included in exports. */
export function createSettingsExport(settings: ViewportLabSettings, now = new Date()): SettingsExport {
  const { recentUrls: _recent, activeUrl: _active, rememberRecent: _remember, ...shareable } = settings;
  return { app: EXPORT_APP, kind: EXPORT_KIND, version: 1, exportedAt: now.toISOString(), settings: shareable };
}

/**
 * Validates an imported file and merges it with the current settings. Local
 * browsing preferences (recent addresses) are kept. Returns null if the data
 * isn't a ViewportLab export.
 */
export function parseSettingsImport(raw: unknown, current: ViewportLabSettings): ViewportLabSettings | null {
  if (!isRecord(raw) || raw.app !== EXPORT_APP || raw.kind !== EXPORT_KIND || !isRecord(raw.settings)) return null;
  const imported = parseSettings({ ...raw.settings, rememberRecent: false });
  const merged: ViewportLabSettings = {
    ...imported,
    rememberRecent: current.rememberRecent,
    recentUrls: current.recentUrls,
  };
  if (current.activeUrl) merged.activeUrl = current.activeUrl;
  return merged;
}

export function addRecentUrl(list: string[], url: string): string[] {
  return [url, ...list.filter((item) => item !== url)].slice(0, MAX_RECENT_URLS);
}
