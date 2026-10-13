export type Orientation = 'portrait' | 'landscape';

export type ThemePreference = 'light' | 'dark' | 'system';

export type LanguagePreference = 'auto' | 'en' | 'vi';

export type WorkspaceLayout = 'wrap' | 'row';

export type BreakpointSetId = 'none' | 'tailwind' | 'bootstrap';

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
};

/** A viewport inside a saved group, without identity or visibility. */
export type ViewportTemplate = Pick<ViewportConfig, 'name' | 'width' | 'height' | 'zoom'>;

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
  showRulers: boolean;
  /** Show the tip with fixes when the current site may block previews. */
  embedHints: boolean;
  viewports: ViewportConfig[];
  /** Groups saved by the user. Built-in groups live in data/groups.ts. */
  groups: ViewportGroup[];
  /** Opt-in: keep recently previewed addresses on this device. */
  rememberRecent: boolean;
  recentUrls: string[];
  activeUrl?: string;
};

export type PresetCategory = 'mobile' | 'tablet' | 'laptop' | 'desktop';

export type ViewportPreset = {
  id: string;
  category: PresetCategory;
  width: number;
  height: number;
};
