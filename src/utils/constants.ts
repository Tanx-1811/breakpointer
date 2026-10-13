export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 3840;

/** Each visible preview is a full page load; keep the workspace responsive. */
export const MAX_VIEWPORTS = 8;

export const MAX_NAME_LENGTH = 40;
export const MAX_GROUPS = 20;
export const MAX_RECENT_URLS = 10;
export const MAX_SAVED_PAGES = 30;
export const MAX_CUSTOM_BREAKPOINTS = 8;
export const MAX_BREAKPOINT_NAME = 12;
export const GRID_COLUMN_OPTIONS = ['auto', 4, 6, 8, 12, 16] as const;
export const MAX_GRID_SPACING = 200;
export const MAX_LIVE_CSS = 20_000;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 1;
export const ZOOM_OPTIONS = [0.25, 0.33, 0.5, 0.67, 0.75, 1];
export const DEFAULT_ZOOM = 0.5;

/** Keyword registered for Chrome's address bar (manifest `omnibox.keyword`). */
export const OMNIBOX_KEYWORD = 'bpt';
