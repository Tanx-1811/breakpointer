import type { Breakpoint, BreakpointSetId, GridSettings, Project, ProjectViewport, ViewportConfig } from '../types';
import { MAX_NAME_LENGTH } from '../utils/constants';
import type { CompareTarget } from './compare';
import { createViewport, toTemplate } from './viewports';

/**
 * Projects: a site's whole setup — the page, the viewports (shown and hidden),
 * breakpoint labels, the column grid, live CSS and the address compared with —
 * saved under a name, to switch between clients or sites in one click. Kept in
 * the settings (so exports share them with a team). One project is free; more
 * come with Breakpointer Pro.
 */

export const MAX_PROJECTS = 50;
/** Projects the free plan can save (any number saved before stays usable). */
export const FREE_PROJECTS = 1;

export const normalizeProjectName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);

/** What a project keeps of the workspace. */
export type ProjectState = {
  url: string;
  viewports: ViewportConfig[];
  breakpoints: BreakpointSetId;
  customBreakpoints: Breakpoint[];
  grid: GridSettings;
  css: string;
  compare: CompareTarget | null;
};

export function createProject(id: string, name: string, state: ProjectState, saved = Date.now()): Project {
  return {
    id,
    name: normalizeProjectName(name),
    url: state.url,
    viewports: state.viewports.map((viewport): ProjectViewport => ({
      ...toTemplate(viewport),
      ...(viewport.hidden ? { hidden: true } : {}),
    })),
    breakpoints: state.breakpoints,
    customBreakpoints: state.customBreakpoints.map((breakpoint) => ({ ...breakpoint })),
    grid: { ...state.grid },
    css: state.css,
    compare: state.compare,
    saved,
  };
}

/** The viewports of a project, as new viewports of the workspace. */
export function projectViewports(project: Project): ViewportConfig[] {
  return project.viewports.map(({ hidden, ...template }) => ({ ...createViewport(template), hidden: hidden === true }));
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** The project already saved under this name (saving again updates it). */
export const projectNamed = (projects: readonly Project[], name: string) =>
  projects.find((project) => sameName(project.name, normalizeProjectName(name)));

/** Whether a project can be saved under `name`: updating one is always fine, a new one needs room. */
export function canSaveProject(projects: readonly Project[], name: string, pro: boolean): boolean {
  if (projectNamed(projects, name)) return true;
  return projects.length < (pro ? MAX_PROJECTS : FREE_PROJECTS);
}

/** Saves a project; one with the same name is updated in place (keeping its id). */
export function saveProject(projects: readonly Project[], project: Project): Project[] {
  if (!project.name) return [...projects];
  const index = projects.findIndex((item) => sameName(item.name, project.name));
  if (index >= 0) {
    const next = [...projects];
    next[index] = { ...project, id: projects[index]!.id };
    return next;
  }
  if (projects.length >= MAX_PROJECTS) return [...projects];
  return [...projects, project];
}

/** Renames a project, unless the name is empty or another project has it. */
export function renameProject(projects: readonly Project[], id: string, name: string): Project[] {
  const value = normalizeProjectName(name);
  if (!value || projects.some((project) => project.id !== id && sameName(project.name, value))) return [...projects];
  return projects.map((project) => (project.id === id ? { ...project, name: value } : project));
}

export function deleteProject(projects: readonly Project[], id: string): Project[] {
  return projects.filter((project) => project.id !== id);
}

/** Puts a deleted project back where it was. */
export function restoreProject(projects: readonly Project[], project: Project, index: number): Project[] {
  if (projects.some((item) => item.id === project.id)) return [...projects];
  const next = [...projects];
  next.splice(Math.min(Math.max(0, index), next.length), 0, project);
  return next;
}
