import type { CheckKind } from '../agent/protocol';

export type Orientation = 'portrait' | 'landscape';

export type ThemePreference = 'light' | 'dark' | 'system';

export type LanguagePreference = 'auto' | 'en' | 'vi';

export type WorkspaceLayout = 'wrap' | 'row';

/** `site`: the widths found in the previewed page's own media queries (sites you allow). */
export type BreakpointSetId = 'none' | 'tailwind' | 'bootstrap' | 'custom' | 'site';

/** Forces a preview to the page's light or dark styles (on sites you allow). */
export type ColorScheme = 'light' | 'dark';

/** A min-width breakpoint, e.g. { name: 'md', min: 768 }. */
export type Breakpoint = { name: string; min: number };

/** "auto" = 4 columns on phones, 8 on tablets, 12 from 1024px. */
export type GridColumns = 'auto' | 4 | 6 | 8 | 12 | 16;

export type GridSettings = {
  show: boolean;
  columns: GridColumns;
  /** Space between columns, in CSS pixels. */
  gutter: number;
  /** Outer margin on each side, in CSS pixels. */
  margin: number;
  /** Horizontal lines every this many CSS pixels (a baseline grid); 0 = none. */
  baseline: number;
};

/** Features that need the in-frame agent (only on sites the user allowed). */
export type SyncSettings = {
  /** Scrolling one preview scrolls the others to the same relative position. */
  scroll: boolean;
  /** Following a link in one preview loads that page in all of them. */
  navigation: boolean;
};

export type ViewportConfig = {
  id: string;
  name: string;
  /** Layout viewport width in CSS pixels. */
  width: number;
  /** Layout viewport height in CSS pixels. */
  height: number;
  /** Always derived from width and height; stored for readability. */
  orientation: Orientation;
  /** Visual scale of the preview card (1 = 100%). Does not affect layout. */
  zoom: number;
  /** Hidden viewports keep their settings but don't load a preview. */
  hidden: boolean;
  /** Show the page's light or dark styles whatever the browser prefers; absent = follow the browser. */
  colorScheme?: ColorScheme;
};

/** A viewport inside a saved group, without identity or visibility. */
export type ViewportTemplate = Pick<ViewportConfig, 'name' | 'width' | 'height' | 'zoom' | 'colorScheme'>;

/** The side panel shows one preset size, portrait or landscape. */
export type SidePanelSettings = { preset: string; landscape: boolean };

/** A piece of live CSS the user saved to use again. */
export type CssSnippet = {
  id: string;
  name: string;
  css: string;
};

export type ViewportGroup = {
  id: string;
  name: string;
  viewports: ViewportTemplate[];
};

export type BreakpointerSettings = {
  version: 1;
  theme: ThemePreference;
  language: LanguagePreference;
  layout: WorkspaceLayout;
  breakpoints: BreakpointSetId;
  /** Used when `breakpoints` is "custom"; sorted by `min`. */
  customBreakpoints: Breakpoint[];
  showRulers: boolean;
  grid: GridSettings;
  sync: SyncSettings;
  /** Run responsive checks (overflow, viewport meta, small text, small targets…) where possible. */
  checks: boolean;
  /** Checks the user switched off one by one. */
  disabledChecks: CheckKind[];
  /** Show the tip with fixes when the current site may block previews. */
  embedHints: boolean;
  viewports: ViewportConfig[];
  /** Groups saved by the user. Built-in groups live in data/groups.ts. */
  groups: ViewportGroup[];
  /** Opt-in: keep recently previewed addresses on this device. */
  rememberRecent: boolean;
  recentUrls: string[];
  /** Addresses the user saved explicitly (star in the address bar). */
  savedPages: string[];
  /** Live CSS saved by the user, to apply again in one click. */
  cssSnippets: CssSnippet[];
  /** The size shown in Chrome's side panel. */
  sidePanel: SidePanelSettings;
  activeUrl?: string;
};

export type PresetCategory = 'mobile' | 'foldable' | 'tablet' | 'laptop' | 'desktop';

export type ViewportPreset = {
  id: string;
  category: PresetCategory;
  width: number;
  height: number;
};
