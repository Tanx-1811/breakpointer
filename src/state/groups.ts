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

/** `name`, or `name (2)`, `name (3)`… if another group already uses it (case-insensitive). */
export function uniqueGroupName(name: string, groups: ViewportGroup[], ignoreId?: string): string {
  const taken = new Set(groups.filter((group) => group.id !== ignoreId).map((group) => group.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = normalizeGroupName(`${name.slice(0, MAX_NAME_LENGTH - 5)} (${n})`);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function saveGroup(groups: ViewportGroup[], group: ViewportGroup): ViewportGroup[] {
  if (!canSaveGroup(groups) || !group.name || group.viewports.length === 0) return groups;
  return [...groups, { ...group, name: uniqueGroupName(group.name, groups) }];
}

export function renameGroup(groups: ViewportGroup[], id: string, name: string): ViewportGroup[] {
  const value = normalizeGroupName(name);
  if (!value) return groups;
  const unique = uniqueGroupName(value, groups, id);
  return groups.map((group) => (group.id === id ? { ...group, name: unique } : group));
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

/** Puts a deleted group back at its old position without touching other groups. */
export function restoreGroup(groups: ViewportGroup[], group: ViewportGroup, index: number): ViewportGroup[] {
  if (groups.some((item) => item.id === group.id) || !canSaveGroup(groups)) return groups;
  const next = [...groups];
  next.splice(Math.min(Math.max(0, index), next.length), 0, group);
  return next;
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
