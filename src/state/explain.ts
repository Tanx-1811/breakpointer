import type { MessageKey } from '../i18n/en';
import type { GuideId } from './guides';

/**
 * “What's this?” mode: what the controls of the workspace do, found by
 * selector. The first topic whose selector matches the control (or one of its
 * containers) wins, so controls come before the panels they sit in.
 */
export type ExplainTopic = { selector: string; body: MessageKey; guide?: GuideId };

export const EXPLAIN_TOPICS: readonly ExplainTopic[] = [
  // Top bar.
  { selector: '[data-testid="address-input"]', body: 'explain.address', guide: 'basics' },
  { selector: '[data-testid="reload-menu"]', body: 'explain.autoReload' },
  { selector: '[data-help="reload"]', body: 'explain.reload' },
  { selector: '[data-help="open-tab"]', body: 'explain.openTab' },
  { selector: '[data-testid="open-windows"]', body: 'explain.windows' },
  { selector: '[data-testid="open-floating"]', body: 'explain.floating' },
  { selector: '[data-testid="pro-button"]', body: 'explain.pro' },
  { selector: '[data-palette-trigger]', body: 'explain.palette' },
  { selector: '[data-help="capture"]', body: 'explain.capture', guide: 'share' },
  { selector: '[data-help="present"]', body: 'explain.present', guide: 'share' },
  { selector: '[data-help="access"]', body: 'explain.access' },
  { selector: '[data-help="theme"]', body: 'explain.theme' },
  { selector: '[data-help="settings"]', body: 'explain.settings' },
  { selector: '[data-testid="help-button"]', body: 'explain.help' },
  // Workspace bar.
  { selector: '[data-testid="sidebar-toggle"]', body: 'explain.sidebar' },
  { selector: '[data-projects-trigger]', body: 'explain.projects' },
  { selector: '[data-groups-trigger]', body: 'explain.groups' },
  { selector: '[data-add-viewport]', body: 'explain.add', guide: 'breaks' },
  { selector: '[data-testid="viewport-chip"]', body: 'explain.chip' },
  { selector: '[data-tour="breakpoints"]', body: 'explain.breakpoints', guide: 'breaks' },
  { selector: '[data-testid="rulers-toggle"]', body: 'explain.rulers' },
  { selector: '[data-testid="grid-toggle"]', body: 'explain.grid' },
  { selector: '[data-testid="sync-toggle"]', body: 'explain.sync' },
  { selector: '[data-testid="inspect-toggle"]', body: 'explain.inspect', guide: 'inspect' },
  { selector: '[data-testid="audit-toggle"]', body: 'explain.audit', guide: 'audit' },
  { selector: '[data-testid="measure-toggle"]', body: 'explain.measure' },
  { selector: '[data-testid="notes-toggle"]', body: 'explain.notes', guide: 'notes' },
  { selector: '[data-simulate-trigger]', body: 'explain.simulate' },
  { selector: '[data-tools-trigger]', body: 'explain.tools' },
  // Preview cards.
  { selector: '[data-testid="breakpoint-badge"]', body: 'explain.badge', guide: 'breaks' },
  { selector: '[data-testid="resize-size"]', body: 'explain.size' },
  { selector: '[data-testid="resize-width"], [data-testid="resize-height"]', body: 'explain.resize', guide: 'breaks' },
  { selector: '[data-testid="viewport-card"]', body: 'explain.card' },
  // Controls inside panels (before the panels themselves).
  { selector: '[data-testid="badge-copy"]', body: 'explain.scoreBadge' },
  { selector: '[data-testid="score-history"]', body: 'explain.scoreHistory', guide: 'progress' },
  { selector: '[data-testid="image-tips"]', body: 'explain.imageTips', guide: 'images' },
  { selector: '[data-testid="visibility-tab"]', body: 'visibility.explain', guide: 'audit' },
  { selector: '[data-testid="present-autoscroll"]', body: 'explain.autoScroll', guide: 'demo' },
  // Around the workspace.
  { selector: '[data-testid="learn-button"]', body: 'explain.learn' },
  { selector: '[data-testid="zoom-dock"]', body: 'explain.zoom' },
  { selector: '[data-testid="status-bar"]', body: 'explain.status' },
  { selector: '[data-testid="viewport-sidebar"]', body: 'explain.sidebarPanel' },
  { selector: '[data-testid="audit"]', body: 'explain.auditPanel', guide: 'audit' },
  { selector: '[data-testid="inspector"]', body: 'explain.inspector', guide: 'inspect' },
  { selector: '[data-testid="qa-panel"]', body: 'explain.qa', guide: 'qa' },
  { selector: '[data-testid="elements-panel"]', body: 'explain.elements', guide: 'elements' },
];

/** What a control or one of its containers is about, if anything. */
export function topicFor(element: Element): ExplainTopic | null {
  for (const topic of EXPLAIN_TOPICS) if (element.closest(topic.selector)) return topic;
  return null;
}

const CONTROL = 'button, a[href], input, select, textarea, summary, [role="tab"], [role="button"], [data-tooltip]';

/**
 * The control under the pointer (or focused) worth explaining, and what to
 * call it: its tooltip, else its accessible name, else its text. Null outside
 * any control or topic.
 */
export function explainTarget(node: EventTarget | null): { element: Element; name: string; shortcut?: string } | null {
  if (!(node instanceof Element)) return null;
  let owner = node.closest(CONTROL);
  if (!owner) {
    const topic = topicFor(node);
    if (!topic) return null;
    owner = node.closest(topic.selector)!;
  }
  const name = (
    ((owner instanceof HTMLElement ? owner.dataset.tooltip : undefined) ||
      owner.getAttribute('aria-label') ||
      owner.getAttribute('title') ||
      owner.getAttribute('title')) ??
    owner.textContent ??
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const shortcut = owner instanceof HTMLElement ? owner.dataset.shortcut || undefined : undefined;
  return { element: owner, name, shortcut };
}
