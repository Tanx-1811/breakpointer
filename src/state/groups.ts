import { BUILT_IN_GROUPS, type BuiltInGroup } from '../data/groups';
import type { Translate } from '../i18n/translate';
import type { MessageKey } from '../i18n/en';
import type { ViewportConfig, ViewportGroup, ViewportTemplate } from '../types';
import { MAX_GROUPS, MAX_NAME_LENGTH } from '../utils/constants';
import { createId } from '../utils/id';
import { toTemplate } from './viewports';

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
}

export function canSaveGroup(groups: ViewportGroup[]): boolean {
  return groups.length < MAX_GROUPS;
}

export function createGroup(name: string, viewports: ViewportConfig[]): ViewportGroup {
  return { id: createId(), name: normalizeGroupName(name), viewports: viewports.map(toTemplate) };
}

export function saveGroup(groups: ViewportGroup[], group: ViewportGroup): ViewportGroup[] {
  if (!canSaveGroup(groups) || !group.name || group.viewports.length === 0) return groups;
  return [...groups, group];
}

export function renameGroup(groups: ViewportGroup[], id: string, name: string): ViewportGroup[] {
  const value = normalizeGroupName(name);
  if (!value) return groups;
  return groups.map((group) => (group.id === id ? { ...group, name: value } : group));
}

export function replaceGroupViewports(
  groups: ViewportGroup[],
  id: string,
  viewports: ViewportConfig[],
): ViewportGroup[] {
  if (viewports.length === 0) return groups;
  return groups.map((group) => (group.id === id ? { ...group, viewports: viewports.map(toTemplate) } : group));
}

export function deleteGroup(groups: ViewportGroup[], id: string): ViewportGroup[] {
  return groups.filter((group) => group.id !== id);
}

/** Resolves a built-in group into templates with names in the current language. */
export function builtInTemplates(group: BuiltInGroup, t: Translate): ViewportTemplate[] {
  return group.viewports.map(({ preset, label, width, height, zoom }) => ({
    name: preset ? t(`preset.${preset}` as MessageKey) : (label ?? `${width} × ${height}`),
    width,
    height,
    zoom,
  }));
}

export function builtInGroupName(group: BuiltInGroup, t: Translate): string {
  return t(`group.${group.id}` as MessageKey);
}

/** Looks up a group by id: built-in ids are prefixed with "builtin:". */
export function findGroupTemplates(
  id: string,
  groups: ViewportGroup[],
  t: Translate,
): { name: string; viewports: ViewportTemplate[] } | null {
  if (id.startsWith('builtin:')) {
    const group = BUILT_IN_GROUPS.find((candidate) => `builtin:${candidate.id}` === id);
    return group ? { name: builtInGroupName(group, t), viewports: builtInTemplates(group, t) } : null;
  }
  const group = groups.find((candidate) => candidate.id === id);
  return group ? { name: group.name, viewports: group.viewports } : null;
}
