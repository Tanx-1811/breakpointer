import type { IconName } from '../components/Icon/Icon';
import type { MessageKey } from '../i18n/en';

/**
 * Guides: short walks through one task each, shown as a card next to the
 * controls involved (components/Tour). A step may first open what it talks
 * about (the audit, the inspector…); the last one may offer to start the task.
 */

/** What a guide can open in the workspace (Viewer runs it; it never closes anything). */
export type GuideAction =
  | 'audit'
  | 'audit-media'
  | 'inspect'
  | 'notes'
  | 'qa'
  | 'scan'
  | 'batch'
  | 'visual'
  | 'showcase'
  | 'present'
  | 'explain';

export type GuideStep = {
  /**
   * The control the card points at (a selector). Without one, or when it isn't
   * shown, the card sits in the middle of the window.
   */
  target?: string;
  title: MessageKey;
  body: MessageKey;
  /** Opened before the step shows (its control may appear only then). */
  action?: GuideAction;
};

export type GuideId =
  | 'basics'
  | 'breaks'
  | 'audit'
  | 'media'
  | 'inspect'
  | 'notes'
  | 'qa'
  | 'visual'
  | 'site'
  | 'share';

export type Guide = {
  id: GuideId;
  icon: IconName;
  title: MessageKey;
  summary: MessageKey;
  steps: readonly GuideStep[];
  /** The last step's main button: starts the task (else it says Done). */
  finish?: { label: MessageKey; action: GuideAction };
};

const AUDIT = '[data-testid="audit"]';

export const GUIDES: readonly Guide[] = [
  {
    id: 'basics',
    icon: 'sparkle',
    title: 'guide.basics.title',
    summary: 'guide.basics.summary',
    // The tour of v0.8: steps whose control isn't shown are left out.
    steps: [
      { target: '[data-testid="address-input"]', title: 'tour.addressTitle', body: 'tour.addressBody' },
      { target: '[data-tour="viewports"]', title: 'tour.viewportsTitle', body: 'tour.viewportsBody' },
      { target: '[data-tour="breakpoints"]', title: 'tour.breakpointsTitle', body: 'tour.breakpointsBody' },
      { target: '[data-testid="sync-toggle"]', title: 'tour.syncTitle', body: 'tour.syncBody' },
      { target: '[data-testid="inspect-toggle"]', title: 'tour.inspectTitle', body: 'tour.inspectBody' },
      { target: '[data-testid="audit-toggle"]', title: 'tour.auditTitle', body: 'tour.auditBody' },
      { target: '[data-testid="notes-toggle"]', title: 'tour.notesTitle', body: 'tour.notesBody' },
      { target: '[data-tools-trigger]', title: 'tour.toolsTitle', body: 'tour.toolsBody' },
      { target: '[data-testid="help-button"]', title: 'tour.helpTitle', body: 'tour.helpBody' },
    ],
  },
  {
    id: 'breaks',
    icon: 'scan',
    title: 'guide.breaks.title',
    summary: 'guide.breaks.summary',
    steps: [
      { target: '[data-tour="viewports"]', title: 'guide.breaks.sizesTitle', body: 'guide.breaks.sizesBody' },
      { target: '[data-testid="viewport-card"]', title: 'guide.breaks.resizeTitle', body: 'guide.breaks.resizeBody' },
      { target: '[data-tour="breakpoints"]', title: 'guide.breaks.labelsTitle', body: 'guide.breaks.labelsBody' },
      { target: '[data-tools-trigger]', title: 'guide.breaks.scanTitle', body: 'guide.breaks.scanBody' },
    ],
    finish: { label: 'guide.breaks.finish', action: 'scan' },
  },
  {
    id: 'audit',
    icon: 'report',
    title: 'guide.audit.title',
    summary: 'guide.audit.summary',
    steps: [
      { target: '[data-testid="audit-toggle"]', title: 'guide.audit.openTitle', body: 'guide.audit.openBody' },
      {
        target: `${AUDIT} [role="tablist"]`,
        title: 'guide.audit.tabsTitle',
        body: 'guide.audit.tabsBody',
        action: 'audit',
      },
      { target: `${AUDIT} [role="tabpanel"]`, title: 'guide.audit.issuesTitle', body: 'guide.audit.issuesBody' },
      { target: `${AUDIT} header`, title: 'guide.audit.shareTitle', body: 'guide.audit.shareBody' },
    ],
  },
  {
    id: 'media',
    icon: 'ruler',
    title: 'guide.media.title',
    summary: 'guide.media.summary',
    steps: [
      { target: AUDIT, title: 'guide.media.listTitle', body: 'guide.media.listBody', action: 'audit-media' },
      { target: `${AUDIT} [role="tabpanel"]`, title: 'guide.media.gapsTitle', body: 'guide.media.gapsBody' },
    ],
  },
  {
    id: 'inspect',
    icon: 'inspect',
    title: 'guide.inspect.title',
    summary: 'guide.inspect.summary',
    steps: [
      { target: '[data-testid="inspect-toggle"]', title: 'guide.inspect.pickTitle', body: 'guide.inspect.pickBody' },
      {
        target: '[data-testid="inspector"]',
        title: 'guide.inspect.compareTitle',
        body: 'guide.inspect.compareBody',
        action: 'inspect',
      },
      {
        target: '[data-testid="inspector-distance-pick"]',
        title: 'guide.inspect.distanceTitle',
        body: 'guide.inspect.distanceBody',
      },
      { target: '[data-testid="inspector-capture"]', title: 'guide.inspect.captureTitle', body: 'guide.inspect.captureBody' },
    ],
  },
  {
    id: 'notes',
    icon: 'pencil',
    title: 'guide.notes.title',
    summary: 'guide.notes.summary',
    steps: [
      { target: '[data-testid="notes-toggle"]', title: 'guide.notes.onTitle', body: 'guide.notes.onBody' },
      {
        target: '[data-testid="notes-status"]',
        title: 'guide.notes.pinTitle',
        body: 'guide.notes.pinBody',
        action: 'notes',
      },
      { target: '[data-testid="notes-status"]', title: 'guide.notes.copyTitle', body: 'guide.notes.copyBody' },
    ],
  },
  {
    id: 'qa',
    icon: 'check',
    title: 'guide.qa.title',
    summary: 'guide.qa.summary',
    steps: [
      { title: 'guide.qa.introTitle', body: 'guide.qa.introBody' },
      { target: '[data-testid="qa-panel"]', title: 'guide.qa.cellsTitle', body: 'guide.qa.cellsBody', action: 'qa' },
      { target: '[data-testid="qa-panel"] header', title: 'guide.qa.copyTitle', body: 'guide.qa.copyBody' },
    ],
  },
  {
    id: 'visual',
    icon: 'split',
    title: 'guide.visual.title',
    summary: 'guide.visual.summary',
    steps: [
      { target: '[data-tools-trigger]', title: 'guide.visual.baselineTitle', body: 'guide.visual.baselineBody' },
      { title: 'guide.visual.compareTitle', body: 'guide.visual.compareBody' },
    ],
    finish: { label: 'guide.visual.finish', action: 'visual' },
  },
  {
    id: 'site',
    icon: 'pages',
    title: 'guide.site.title',
    summary: 'guide.site.summary',
    steps: [
      { target: '[data-tools-trigger]', title: 'guide.site.listTitle', body: 'guide.site.listBody' },
      { title: 'guide.site.tableTitle', body: 'guide.site.tableBody' },
    ],
    finish: { label: 'guide.site.finish', action: 'batch' },
  },
  {
    id: 'share',
    icon: 'camera',
    title: 'guide.share.title',
    summary: 'guide.share.summary',
    steps: [
      { target: '[data-help="capture"]', title: 'guide.share.captureTitle', body: 'guide.share.captureBody' },
      { target: '[data-help="capture"]', title: 'guide.share.showcaseTitle', body: 'guide.share.showcaseBody' },
      { target: '[data-help="present"]', title: 'guide.share.presentTitle', body: 'guide.share.presentBody' },
    ],
    finish: { label: 'guide.share.finish', action: 'showcase' },
  },
];

export const guideById = (id: GuideId): Guide => GUIDES.find((guide) => guide.id === id) ?? GUIDES[0]!;

/**
 * The steps a guide shows: a step that opens nothing is left out when its
 * control isn't on screen when the guide starts (and has nothing to say without
 * it), unless it has no control at all. Steps after an action keep theirs.
 */
export function visibleSteps(guide: Guide, isShown: (selector: string) => boolean): GuideStep[] {
  let opened = false;
  return guide.steps.filter((step) => {
    if (step.action) opened = true;
    // Only the workspace tour drops steps: the others explain things that may appear later.
    if (guide.id !== 'basics' || opened || !step.target) return true;
    return isShown(step.target);
  });
}
