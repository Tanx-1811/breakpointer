/**
 * Messages between the workspace and the small agent script that runs inside
 * preview frames of sites the user has allowed (see docs/ARCHITECTURE.md).
 * Shared by both sides, so it holds only types and constants: the agent is
 * bundled on its own and must stay small.
 */

export const AGENT_SOURCE = 'breakpointer-agent';
export const AGENT_SCRIPT_ID = 'breakpointer-agent';

export type CheckKind = 'overflow' | 'viewport-meta' | 'small-text' | 'tap-targets';

export type CheckSample = {
  /** A short CSS-like description, e.g. "div.hero > img". */
  selector: string;
  /** Extra detail, e.g. "+184px" or "11px". */
  detail?: string;
};

export type CheckIssue = {
  kind: CheckKind;
  /** How many elements are affected (1 for page-level issues). */
  count: number;
  /** Page-level detail, e.g. the overflow amount or the viewport meta content. */
  detail?: string;
  samples: CheckSample[];
};

export type CheckReport = {
  width: number;
  issues: CheckIssue[];
};

/** Agent → workspace. `name` identifies the preview frame (its iframe `name`). */
export type AgentEvent =
  | { type: 'hello'; href: string; title: string }
  /** The address changed without a new page (single-page app routes, history.replaceState). */
  | { type: 'location'; href: string; title: string }
  /** The page is unloading (the next page may be on a site without an agent). */
  | { type: 'bye' }
  /** The user clicked or typed in the page (sent at most once a second). */
  | { type: 'input' }
  | { type: 'scroll'; ratio: number }
  /** Ctrl + wheel (or a pinch) over the page: zoom the workspace instead of the browser tab. */
  | { type: 'zoom'; direction: 1 | -1 }
  | { type: 'checks'; report: CheckReport };

export type AgentMessage = AgentEvent & { source: typeof AGENT_SOURCE; name: string };

/** Workspace → agent. */
export type AgentCommand =
  /** Say hello again (the workspace started listening after the page loaded). */
  | { type: 'ping' }
  | { type: 'scrollTo'; ratio: number }
  | { type: 'outlines'; on: boolean }
  | { type: 'css'; css: string }
  | { type: 'highlight'; kind: CheckKind | null }
  | { type: 'checks'; enabled: boolean };
