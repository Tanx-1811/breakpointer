import type { CheckKind } from '../agent/protocol';
import { addRecentUrl } from '../services/storage';
import { MAX_CSS_SNIPPETS, MAX_SAVED_PAGES } from '../utils/constants';
import type {
  Breakpoint,
  BreakpointSetId,
  BrandingSettings,
  CssSnippet,
  GridSettings,
  SyncSettings,
  LanguagePreference,
  ThemePreference,
  ViewportConfig,
  ViewportGroup,
  BreakpointerSettings,
  WorkspaceLayout,
} from '../types';
import { deleteGroup, renameGroup, replaceGroupViewports, restoreGroup, saveGroup } from './groups';
import {
  addViewport,
  duplicateViewport,
  moveViewport,
  moveViewportTo,
  removeViewport,
  restoreViewport,
  rotateViewport,
  setZoomForAll,
  showAll,
  updateViewport,
  type NewViewport,
  type ViewportPatch,
} from './viewports';

export type SettingsAction =
  | { type: 'setTheme'; theme: ThemePreference }
  | { type: 'setLanguage'; language: LanguagePreference }
  | { type: 'setLayout'; layout: WorkspaceLayout }
  | { type: 'setBreakpoints'; breakpoints: BreakpointSetId }
  | { type: 'setShowRulers'; showRulers: boolean }
  | { type: 'setSync'; sync: Partial<SyncSettings> }
  | { type: 'setChecks'; checks: boolean }
  /** Switches one kind of check on or off. */
  | { type: 'setCheckKind'; kind: CheckKind; enabled: boolean }
  | { type: 'setGrid'; grid: Partial<GridSettings> }
  | { type: 'setCustomBreakpoints'; breakpoints: Breakpoint[] }
  | { type: 'toggleSavedPage'; url: string }
  | { type: 'removeSavedPage'; url: string }
  | { type: 'setEmbedHints'; embedHints: boolean }
  | { type: 'setRememberRecent'; rememberRecent: boolean }
  | { type: 'clearRecent' }
  | { type: 'visitUrl'; url: string }
  | { type: 'addViewport'; viewport: NewViewport }
  | { type: 'duplicateViewport'; id: string }
  | { type: 'removeViewport'; id: string }
  | { type: 'restoreViewport'; viewport: ViewportConfig; index: number }
  | { type: 'updateViewport'; id: string; patch: ViewportPatch }
  | { type: 'rotateViewport'; id: string }
  | { type: 'moveViewport'; id: string; delta: -1 | 1 }
  | { type: 'moveViewportTo'; id: string; index: number }
  | { type: 'setZoomForAll'; zoom: number }
  | { type: 'showAll' }
  | { type: 'replaceViewports'; viewports: ViewportConfig[] }
  | { type: 'saveGroup'; group: ViewportGroup }
  | { type: 'renameGroup'; id: string; name: string }
  | { type: 'updateGroupViewports'; id: string }
  | { type: 'deleteGroup'; id: string }
  | { type: 'restoreGroup'; group: ViewportGroup; index: number }
  | { type: 'replaceGroup'; group: ViewportGroup }
  /** Saves a snippet; one with the same name is replaced. */
  | { type: 'saveCssSnippet'; snippet: CssSnippet }
  | { type: 'deleteCssSnippet'; id: string }
  | { type: 'restoreCssSnippet'; snippet: CssSnippet; index: number }
  /** Changes the brand on reports and images (values already validated, see state/branding.ts). */
  | { type: 'setBranding'; branding: Partial<BrandingSettings> }
  | { type: 'replaceSettings'; settings: BreakpointerSettings };

export function settingsReducer(state: BreakpointerSettings, action: SettingsAction): BreakpointerSettings {
  switch (action.type) {
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'setBranding':
      return { ...state, branding: { ...state.branding, ...action.branding } };
    case 'setLanguage':
      return { ...state, language: action.language };
    case 'setLayout':
      return { ...state, layout: action.layout };
    case 'setBreakpoints':
      return { ...state, breakpoints: action.breakpoints };
    case 'setShowRulers':
      return { ...state, showRulers: action.showRulers };
    case 'setSync':
      return { ...state, sync: { ...state.sync, ...action.sync } };
    case 'setChecks':
      return { ...state, checks: action.checks };
    case 'setCheckKind': {
      const disabled = state.disabledChecks.filter((kind) => kind !== action.kind);
      return { ...state, disabledChecks: action.enabled ? disabled : [...disabled, action.kind] };
    }
    case 'setGrid':
      return { ...state, grid: { ...state.grid, ...action.grid } };
    case 'setCustomBreakpoints':
      return { ...state, customBreakpoints: action.breakpoints };
    case 'toggleSavedPage':
      return {
        ...state,
        savedPages: state.savedPages.includes(action.url)
          ? state.savedPages.filter((url) => url !== action.url)
          : [action.url, ...state.savedPages].slice(0, MAX_SAVED_PAGES),
      };
    case 'removeSavedPage':
      return { ...state, savedPages: state.savedPages.filter((url) => url !== action.url) };
    case 'setEmbedHints':
      return { ...state, embedHints: action.embedHints };
    case 'setRememberRecent':
      return {
        ...state,
        rememberRecent: action.rememberRecent,
        recentUrls: action.rememberRecent ? state.recentUrls : [],
      };
    case 'clearRecent':
      return { ...state, recentUrls: [] };
    case 'visitUrl':
      return {
        ...state,
        activeUrl: action.url,
        recentUrls: state.rememberRecent ? addRecentUrl(state.recentUrls, action.url) : state.recentUrls,
      };
    case 'addViewport':
      return { ...state, viewports: addViewport(state.viewports, action.viewport) };
    case 'duplicateViewport':
      return { ...state, viewports: duplicateViewport(state.viewports, action.id) };
    case 'removeViewport':
      return { ...state, viewports: removeViewport(state.viewports, action.id) };
    case 'restoreViewport':
      return { ...state, viewports: restoreViewport(state.viewports, action.viewport, action.index) };
    case 'updateViewport':
      return { ...state, viewports: updateViewport(state.viewports, action.id, action.patch) };
    case 'rotateViewport':
      return { ...state, viewports: rotateViewport(state.viewports, action.id) };
    case 'moveViewport':
      return { ...state, viewports: moveViewport(state.viewports, action.id, action.delta) };
    case 'moveViewportTo':
      return { ...state, viewports: moveViewportTo(state.viewports, action.id, action.index) };
    case 'setZoomForAll':
      return { ...state, viewports: setZoomForAll(state.viewports, action.zoom) };
    case 'showAll':
      return { ...state, viewports: showAll(state.viewports) };
    case 'replaceViewports':
      return { ...state, viewports: action.viewports };
    case 'saveGroup':
      return { ...state, groups: saveGroup(state.groups, action.group) };
    case 'renameGroup':
      return { ...state, groups: renameGroup(state.groups, action.id, action.name) };
    case 'updateGroupViewports':
      return { ...state, groups: replaceGroupViewports(state.groups, action.id, state.viewports) };
    case 'deleteGroup':
      return { ...state, groups: deleteGroup(state.groups, action.id) };
    case 'replaceGroup':
      return {
        ...state,
        groups: state.groups.map((group) => (group.id === action.group.id ? action.group : group)),
      };
    case 'restoreGroup':
      return { ...state, groups: restoreGroup(state.groups, action.group, action.index) };
    case 'saveCssSnippet': {
      const name = action.snippet.name.toLocaleLowerCase();
      const index = state.cssSnippets.findIndex((snippet) => snippet.name.toLocaleLowerCase() === name);
      if (index >= 0) {
        const cssSnippets = [...state.cssSnippets];
        cssSnippets[index] = { ...action.snippet, id: state.cssSnippets[index]!.id };
        return { ...state, cssSnippets };
      }
      if (state.cssSnippets.length >= MAX_CSS_SNIPPETS) return state;
      return { ...state, cssSnippets: [...state.cssSnippets, action.snippet] };
    }
    case 'deleteCssSnippet':
      return { ...state, cssSnippets: state.cssSnippets.filter((snippet) => snippet.id !== action.id) };
    case 'restoreCssSnippet': {
      if (state.cssSnippets.some((snippet) => snippet.id === action.snippet.id)) return state;
      const cssSnippets = [...state.cssSnippets];
      cssSnippets.splice(Math.min(action.index, cssSnippets.length), 0, action.snippet);
      return { ...state, cssSnippets: cssSnippets.slice(0, MAX_CSS_SNIPPETS) };
    }
    case 'replaceSettings':
      return action.settings;
  }
}
