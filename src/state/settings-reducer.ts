import { addRecentUrl } from '../services/storage';
import type {
  BreakpointSetId,
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
  | { type: 'replaceSettings'; settings: BreakpointerSettings };

export function settingsReducer(state: BreakpointerSettings, action: SettingsAction): BreakpointerSettings {
  switch (action.type) {
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'setLanguage':
      return { ...state, language: action.language };
    case 'setLayout':
      return { ...state, layout: action.layout };
    case 'setBreakpoints':
      return { ...state, breakpoints: action.breakpoints };
    case 'setShowRulers':
      return { ...state, showRulers: action.showRulers };
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
    case 'restoreGroup':
      return { ...state, groups: restoreGroup(state.groups, action.group, action.index) };
    case 'replaceSettings':
      return action.settings;
  }
}
