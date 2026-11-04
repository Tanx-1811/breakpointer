import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainLayer } from '../../src/components/Explain/ExplainLayer';
import { HelpDialog } from '../../src/components/HelpDialog/HelpDialog';
import { PresentBar } from '../../src/components/PresentBar/PresentBar';
import { StatusBar } from '../../src/components/StatusBar/StatusBar';
import { Tour } from '../../src/components/Tour/Tour';
import { en } from '../../src/i18n/en';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { EXPLAIN_TOPICS, explainTarget, topicFor } from '../../src/state/explain';
import { GUIDES, guideById, visibleSteps } from '../../src/state/guides';
import {
  EMPTY_LEARN,
  LEARN_TASKS,
  completeTasks,
  learnSummary,
  parseLearnProgress,
  tasksDone,
  type LearnSnapshot,
} from '../../src/state/learn';

const wrap = (ui: ReactNode) => render(<I18nProvider language="en">{ui}</I18nProvider>);

/** An element the size of a toolbar button, at a fixed place (jsdom has no layout). */
function control(attributes: Record<string, string>, tag = 'button') {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.getBoundingClientRect = () =>
    ({ x: 10, y: 10, left: 10, top: 10, width: 40, height: 20, right: 50, bottom: 30, toJSON: () => ({}) }) as DOMRect;
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('guides', () => {
  it('have unique ids, a title, a summary and steps with existing messages', () => {
    expect(new Set(GUIDES.map((guide) => guide.id)).size).toBe(GUIDES.length);
    for (const guide of GUIDES) {
      expect(en[guide.title], guide.id).toBeTruthy();
      expect(en[guide.summary], guide.id).toBeTruthy();
      expect(guide.steps.length, guide.id).toBeGreaterThan(0);
      for (const step of guide.steps) expect(en[step.title] && en[step.body]).toBeTruthy();
    }
    expect(guideById('audit').id).toBe('audit');
  });

  it('leave out the tour’s steps whose control isn’t shown, but keep the others’', () => {
    const shown = new Set(['[data-testid="address-input"]', '[data-testid="help-button"]']);
    expect(visibleSteps(guideById('basics'), (selector) => shown.has(selector))).toHaveLength(2);
    // The audit guide opens the audit first: its later steps point at what appears then.
    expect(visibleSteps(guideById('audit'), () => false)).toHaveLength(guideById('audit').steps.length);
  });
});

describe('getting-started checklist', () => {
  const nothing: LearnSnapshot = {
    hasUrl: false,
    viewportsChanged: false,
    inspected: false,
    auditing: false,
    scanning: false,
    notes: 0,
    captured: false,
    explaining: false,
  };

  it('reads stored progress as untrusted', () => {
    expect(parseLearnProgress(undefined)).toEqual(EMPTY_LEARN);
    expect(parseLearnProgress('done')).toEqual(EMPTY_LEARN);
    expect(parseLearnProgress({ done: ['audit', 'audit', 'nope', 3], hidden: 'yes' })).toEqual({
      done: ['audit'],
      hidden: false,
    });
    expect(parseLearnProgress({ done: ['scan'], hidden: true })).toEqual({ done: ['scan'], hidden: true });
  });

  it('ticks tasks off once and counts them', () => {
    const one = completeTasks(EMPTY_LEARN, ['preview', 'preview']);
    expect(one.done).toEqual(['preview']);
    expect(completeTasks(one, ['preview'])).toBe(one);
    expect(learnSummary(one)).toEqual({ done: 1, total: LEARN_TASKS.length, complete: false });
    const all = completeTasks(
      one,
      LEARN_TASKS.map((task) => task.id),
    );
    expect(learnSummary(all).complete).toBe(true);
  });

  it('knows what the workspace shows was done', () => {
    expect(tasksDone(nothing)).toEqual([]);
    expect(
      tasksDone({ ...nothing, hasUrl: true, auditing: true, notes: 2, captured: true, viewportsChanged: true }),
    ).toEqual(['preview', 'viewport', 'audit', 'notes', 'capture']);
    expect(tasksDone({ ...nothing, inspected: true, scanning: true, explaining: true })).toEqual([
      'inspect',
      'scan',
      'explain',
    ]);
  });
});

describe('“What’s this?” topics', () => {
  it('describe every topic with a message', () => {
    for (const topic of EXPLAIN_TOPICS) expect(en[topic.body], topic.selector).toBeTruthy();
  });

  it('find the control, its name and shortcut, and its topic', () => {
    const button = control({ 'data-testid': 'audit-toggle', 'aria-label': 'Audit', 'data-shortcut': 'E' });
    const icon = document.createElement('span');
    button.append(icon);
    const target = explainTarget(icon);
    expect(target).toMatchObject({ element: button, name: 'Audit', shortcut: 'E' });
    expect(topicFor(button)).toMatchObject({ body: 'explain.audit', guide: 'audit' });
    // A control without a topic still has a name; plain text outside any control has nothing.
    expect(explainTarget(control({ 'data-tooltip': 'Rotate' }))).toMatchObject({ name: 'Rotate' });
    const text = document.createElement('p');
    document.body.append(text);
    expect(explainTarget(text)).toBeNull();
  });
});

describe('Tour with a guide', () => {
  it('opens what a step talks about and offers to start the task at the end', async () => {
    control({ 'data-tools-trigger': '' });
    const onAction = vi.fn();
    const onClose = vi.fn();
    wrap(<Tour open guide="visual" onClose={onClose} onAction={onAction} />);
    const tour = screen.getByTestId('tour');
    expect(tour).toHaveTextContent('Catch visual changes');
    expect(tour).toHaveTextContent('Step 1 of 2');
    await userEvent.click(await within(tour).findByRole('button', { name: 'Next' }));
    // The second step has no control: its card sits in the middle.
    expect(tour).toHaveAttribute('data-placement', 'center');
    await userEvent.click(within(tour).getByRole('button', { name: 'Open Visual check' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledWith('visual');
  });

  it('runs a step’s action before showing it', async () => {
    control({ 'data-testid': 'audit-toggle' });
    const onAction = vi.fn();
    wrap(<Tour open guide="audit" onClose={vi.fn()} onAction={onAction} />);
    await userEvent.click(await within(screen.getByTestId('tour')).findByRole('button', { name: 'Next' }));
    expect(onAction).toHaveBeenCalledWith('audit');
  });
});

describe('Help', () => {
  const learn = { progress: { done: ['preview' as const], hidden: false }, onTask: vi.fn(), onHidden: vi.fn() };

  it('starts on Get started with the checklist and the guides', async () => {
    const onGuide = vi.fn();
    const onExplain = vi.fn();
    wrap(
      <HelpDialog
        open
        version="0.10.0"
        onClose={vi.fn()}
        commandShortcuts={{ open: '', preview: '' }}
        onGuide={onGuide}
        onExplain={onExplain}
        learn={learn}
      />,
    );
    expect(screen.getByRole('tab', { name: /Get started/ })).toHaveAttribute('aria-selected', 'true');
    const checklist = screen.getByTestId('learn-checklist');
    expect(checklist).toHaveTextContent(`1 of ${LEARN_TASKS.length} done`);
    await userEvent.click(within(checklist).getAllByRole('button', { name: 'Show me' })[0]!);
    expect(learn.onTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'viewport' }));
    await userEvent.click(within(checklist).getByRole('button', { name: 'Hide from the status bar' }));
    expect(learn.onHidden).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByTestId('help-tour'));
    expect(onGuide).toHaveBeenCalledWith('basics');
    await userEvent.click(screen.getByTestId('help-explain'));
    expect(onExplain).toHaveBeenCalledOnce();
  });

  it('searches guides and shortcuts, and opens What’s new when asked', async () => {
    wrap(
      <HelpDialog
        open
        version="0.10.0"
        section="news"
        onClose={vi.fn()}
        commandShortcuts={{ open: '', preview: '' }}
        onGuide={vi.fn()}
      />,
    );
    expect(screen.getByTestId('whats-new')).toHaveTextContent('New in Breakpointer 0.10');
    await userEvent.type(screen.getByTestId('help-search'), 'notes');
    expect(screen.getByRole('button', { name: /Report a bug with notes/ })).toBeInTheDocument();
    expect(screen.getByText('Notes on previews')).toBeInTheDocument();
    await userEvent.clear(screen.getByTestId('help-search'));
    await userEvent.type(screen.getByTestId('help-search'), 'zzzz');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing in Help matches “zzzz”');
  });
});

describe('“What’s this?” mode', () => {
  it('explains a control on hover, keeps its card on click without using it, and ends with Escape', async () => {
    const used = vi.fn();
    const button = control({ 'data-testid': 'notes-toggle', 'aria-label': 'Notes', 'data-shortcut': 'N' });
    button.addEventListener('click', used);
    const onClose = vi.fn();
    const onGuide = vi.fn();
    wrap(<ExplainLayer open onClose={onClose} onGuide={onGuide} />);
    expect(document.documentElement).toHaveAttribute('data-explaining');
    await userEvent.hover(button);
    const card = screen.getByTestId('explain-card');
    expect(card).toHaveTextContent('Notes');
    expect(card).toHaveTextContent('Pin numbered notes');
    await userEvent.click(button);
    expect(used).not.toHaveBeenCalled();
    expect(screen.getByTestId('explain-card')).toHaveAttribute('data-pinned');
    await userEvent.click(screen.getByTestId('explain-guide'));
    expect(onGuide).toHaveBeenCalledWith('notes');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('explain-card')).not.toHaveAttribute('data-pinned');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('Status bar and present bar', () => {
  it('shows the checklist’s progress in the status bar', async () => {
    const onLearn = vi.fn();
    wrap(
      <StatusBar
        shown={1}
        total={1}
        hasUrl
        access={null}
        sync={{ scroll: true, navigation: true }}
        issueKinds={null}
        breakpointsName={null}
        widths={null}
        zoom={1}
        layout="wrap"
        sidebar={false}
        minimap={false}
        onSidebar={vi.fn()}
        onSiteAccess={vi.fn()}
        onSync={vi.fn()}
        onAudit={vi.fn()}
        onFit={vi.fn()}
        onMinimap={vi.fn()}
        learn={{ done: 3, total: 8 }}
        onLearn={onLearn}
      />,
    );
    const button = screen.getByTestId('learn-button');
    expect(button).toHaveAccessibleName(/^Get started\s*· 3 of 8 done$/);
    expect(button).toHaveTextContent('3/8');
    await userEvent.click(button);
    expect(onLearn).toHaveBeenCalledOnce();
  });

  it('leaves present mode', async () => {
    const onExit = vi.fn();
    wrap(<PresentBar host="brightside.example" layout="wrap" onLayout={vi.fn()} onFit={vi.fn()} onExit={onExit} />);
    expect(screen.getByTestId('present-bar')).toHaveTextContent('Presenting brightside.example');
    await userEvent.click(screen.getByTestId('present-exit'));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
