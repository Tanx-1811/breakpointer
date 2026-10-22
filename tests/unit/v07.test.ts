import { describe, expect, it } from 'vitest';
import type { CheckIssue, CheckKind } from '../../src/agent/protocol';
import { CHECK_KINDS } from '../../src/agent/protocol';
import { FRAMEWORK_BREAKPOINTS, FRAMEWORK_SET_IDS, breakpointEdges, breakpointFor } from '../../src/data/breakpoints';
import { BUILT_IN_GROUPS } from '../../src/data/groups';
import { findPreset } from '../../src/data/presets';
import { createTranslator } from '../../src/i18n/translate';
import { createSettingsExport, defaultSettings, parseSettings, parseSettingsImport } from '../../src/services/storage';
import { batchMarkdown, newRun, pageScore, setCell } from '../../src/state/batch';
import { newNote, notePosition, notesMarkdown, notesOf, type Note } from '../../src/state/notes';
import {
  FREE_PROJECTS,
  MAX_PROJECTS,
  canSaveProject,
  createProject,
  deleteProject,
  projectNamed,
  projectViewports,
  renameProject,
  restoreProject,
  saveProject,
} from '../../src/state/projects';
import { buildReportHtml } from '../../src/state/report';
import { SCORE_WEIGHTS, gradeOf, responsiveScore, scoreIssues } from '../../src/state/score';
import { settingsReducer } from '../../src/state/settings-reducer';
import { createViewport } from '../../src/state/viewports';

const t = createTranslator('en');
const issue = (kind: CheckKind, count = 1): CheckIssue => ({ kind, count, samples: [] });

describe('responsive score', () => {
  it('starts at 100 and costs each kind by its weight and share of sizes', () => {
    expect(scoreIssues([])).toBeNull();
    expect(scoreIssues([[], [], []])).toEqual({ score: 100, grade: 'A', sizes: 3, costs: [] });
    // Overflow at 1 of 4 sizes (25 / 4) and small text at all of them (8).
    const score = scoreIssues([
      [issue('overflow'), issue('small-text')],
      [issue('small-text')],
      [issue('small-text')],
      [issue('small-text', 9)],
    ])!;
    expect(score.costs).toEqual([
      { kind: 'small-text', points: 8, sizes: 4 },
      { kind: 'overflow', points: 6.3, sizes: 1 },
    ]);
    expect(score.score).toBe(86);
    expect(score.grade).toBe('B');
  });

  it('never goes below zero, and grades by bands', () => {
    const everything = CHECK_KINDS.map((kind) => issue(kind));
    expect(scoreIssues([everything])!.score).toBe(0);
    expect(Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBeGreaterThan(100);
    expect([100, 90, 89, 75, 74, 60, 59, 40, 39, 0].map(gradeOf)).toEqual([
      'A',
      'A',
      'B',
      'B',
      'C',
      'C',
      'D',
      'D',
      'F',
      'F',
    ]);
  });

  it('leaves out previews that were not checked', () => {
    expect(responsiveScore([null, undefined])).toBeNull();
    expect(responsiveScore([{ width: 375, issues: [issue('overflow')] }, null])).toMatchObject({ score: 75, sizes: 1 });
  });

  it('is in reports and Check pages', () => {
    const html = buildReportHtml(
      {
        url: 'https://example.com/',
        title: 'Example',
        created: new Date(0),
        version: '0.7.0',
        language: 'en',
        cards: [
          {
            name: 'Phone',
            width: 375,
            height: 667,
            zoom: 1,
            breakpoint: null,
            image: null,
            checks: { width: 375, issues: [issue('overflow')] },
          },
          {
            name: 'Laptop',
            width: 1366,
            height: 768,
            zoom: 1,
            breakpoint: null,
            image: null,
            checks: { width: 1366, issues: [] },
          },
        ],
      },
      t,
    );
    // Overflow at one of two sizes: 100 − 12.5 = 87.5 → 88.
    expect(html).toContain('Responsive score: 88/100</strong> <span class="tag">B</span>');

    const sizes = [
      { key: 'a', name: 'Phone', width: 375, height: 667, colorScheme: null },
      { key: 'b', name: 'Laptop', width: 1366, height: 768, colorScheme: null },
    ];
    let run = newRun(['https://example.com/'], sizes, 0);
    run = setCell(run, 0, 0, { status: 'checked', issues: [issue('viewport-meta')] });
    run = setCell(run, 0, 1, { status: 'checked', issues: [] });
    expect(pageScore(run.pages[0]!)).toMatchObject({ score: 90, grade: 'A' });
    expect(batchMarkdown(run, t)).toContain('| Page | Phone (375px) | Laptop (1366px) | Score |');
    expect(batchMarkdown(run, t)).toContain('| 90 · A |');
  });
});

describe('framework breakpoints', () => {
  it('labels widths with every framework’s names', () => {
    expect(FRAMEWORK_SET_IDS).toEqual(['tailwind', 'bootstrap', 'mui', 'chakra', 'antd', 'bulma', 'foundation']);
    expect([375, 600, 899, 900, 1536].map((width) => breakpointFor('mui', width))).toEqual([
      'xs',
      'sm',
      'sm',
      'md',
      'xl',
    ]);
    expect([479, 480, 768, 1280].map((width) => breakpointFor('chakra', width))).toEqual(['base', 'sm', 'md', 'xl']);
    expect([768, 769, 1408].map((width) => breakpointFor('bulma', width))).toEqual(['mobile', 'tablet', 'fullhd']);
    expect([639, 640, 1440].map((width) => breakpointFor('foundation', width))).toEqual(['small', 'medium', 'xxlarge']);
    expect([575, 576, 1600].map((width) => breakpointFor('antd', width))).toEqual(['xs', 'sm', 'xxl']);
    for (const id of FRAMEWORK_SET_IDS) {
      const mins = FRAMEWORK_BREAKPOINTS[id].breakpoints.map((breakpoint) => breakpoint.min);
      expect(mins, id).toEqual([...mins].sort((a, b) => a - b));
    }
  });

  it('tests both sides of a framework’s breakpoints and keeps the set in settings', () => {
    expect(breakpointEdges('mui', [], 2).map((edge) => edge.width)).toEqual([599, 600]);
    expect(parseSettings({ breakpoints: 'chakra' }).breakpoints).toBe('chakra');
    expect(parseSettings({ breakpoints: 'semantic-ui' }).breakpoints).toBe('none');
  });
});

describe('built-in groups', () => {
  it('has the most-used sizes and the WCAG reflow sizes', () => {
    const popular = BUILT_IN_GROUPS.find((group) => group.id === 'popular')!;
    expect(popular.viewports.map((vp) => `${vp.width}×${vp.height}`)).toEqual([
      '360×800',
      '390×844',
      '412×915',
      '768×1024',
      '1366×768',
      '1536×864',
      '1920×1080',
    ]);
    for (const vp of popular.viewports)
      expect(findPreset(vp.preset!), vp.preset).toMatchObject({ width: vp.width, height: vp.height });
    const reflow = BUILT_IN_GROUPS.find((group) => group.id === 'reflow')!;
    expect(reflow.viewports.map((vp) => [vp.width, vp.height])).toEqual([
      [320, 256],
      [640, 512],
      [1280, 1024],
    ]);
  });
});

describe('notes', () => {
  const note = (extra: Partial<Note> = {}): Note => ({
    ...newNote('n1', 'phone', 'https://example.com/a#top', { x: 10.4, y: 20.6 }, 300),
    ...extra,
  });

  it('pins to the page when the scroll is known, else to the screen', () => {
    expect(note()).toEqual({
      id: 'n1',
      cardId: 'phone',
      page: 'https://example.com/a',
      x: 10,
      y: 321,
      anchored: true,
      text: '',
    });
    expect(notePosition(note(), 300)).toEqual({ x: 10, y: 21 });
    expect(notePosition(note(), 0)).toEqual({ x: 10, y: 321 });
    const onScreen = newNote('n2', 'phone', 'https://example.com/a', { x: 5, y: 6 }, null);
    expect(onScreen).toMatchObject({ y: 6, anchored: false });
    expect(notePosition(onScreen, 500)).toEqual({ x: 5, y: 6 });
  });

  it('keeps each page’s notes', () => {
    const notes = [note(), note({ id: 'n2', page: 'https://example.com/b' })];
    expect(notesOf(notes, 'https://example.com/a#x').map((item) => item.id)).toEqual(['n1']);
    expect(notesOf(notes, null)).toEqual([]);
  });

  it('writes a bug report per viewport, numbered as on the previews', () => {
    const notes = [
      note({ text: 'Menu covers  the logo' }),
      note({ id: 'n2', cardId: 'laptop', anchored: false, x: 1, y: 2, text: '' }),
      note({ id: 'n3', cardId: 'gone', text: 'A preview that left' }),
    ];
    const markdown = notesMarkdown(
      notes,
      [
        { id: 'phone', name: 'Phone', width: 375, height: 667, details: ['md'] },
        { id: 'laptop', name: 'Laptop', width: 1366, height: 768, details: [] },
        { id: 'tablet', name: 'Tablet', width: 768, height: 1024, details: [] },
      ],
      {
        page: 'https://example.com/a',
        title: 'Example',
        created: new Date(Date.UTC(2026, 9, 22)),
        language: 'en',
        browser: 'Chrome 141',
        version: '0.7.0',
      },
      t,
    );
    expect(markdown).toContain('**Bug report** · Example');
    expect(markdown).toContain('- Environment: Chrome 141 · Breakpointer 0.7.0');
    expect(markdown).toContain('### Phone (375 × 667) · md\n\n1. Menu covers the logo _(at 10, 321 px on the page)_');
    expect(markdown).toContain('### Laptop (1366 × 768)\n\n2. (no text) _(at 1, 2 px on screen)_');
    expect(markdown).not.toContain('Tablet');
    expect(markdown).not.toContain('A preview that left');
  });
});

describe('projects', () => {
  const state = {
    url: 'https://example.com/shop',
    viewports: [
      createViewport({ name: 'Phone', width: 375, height: 667, zoom: 0.5 }),
      { ...createViewport({ name: 'Wide', width: 1920, height: 1080, zoom: 0.25 }), hidden: true },
    ],
    breakpoints: 'mui' as const,
    customBreakpoints: [{ name: 'sm', min: 600 }],
    grid: { show: true, columns: 12 as const, gutter: 24, margin: 16, baseline: 0 },
    css: 'body { outline: 1px solid red }',
    compare: { mode: 'mirror' as const, origin: 'https://staging.example.com' },
  };

  it('keeps a site’s whole setup and opens it as new viewports', () => {
    const project = createProject('p1', '  Acme   shop ', state, 5);
    expect(project).toMatchObject({
      id: 'p1',
      name: 'Acme shop',
      url: state.url,
      breakpoints: 'mui',
      css: state.css,
      saved: 5,
    });
    expect(project.viewports).toEqual([
      { name: 'Phone', width: 375, height: 667, zoom: 0.5 },
      { name: 'Wide', width: 1920, height: 1080, zoom: 0.25, hidden: true },
    ]);
    const opened = projectViewports(project);
    expect(opened.map((vp) => [vp.name, vp.hidden])).toEqual([
      ['Phone', false],
      ['Wide', true],
    ]);
    expect(opened[0]!.id).not.toBe(state.viewports[0]!.id);
  });

  it('updates a project of the same name, renames, deletes and restores', () => {
    const first = createProject('p1', 'Acme', state);
    let list = saveProject([], first);
    list = saveProject(list, createProject('p2', 'ACME', { ...state, url: 'https://example.com/new' }));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'p1', url: 'https://example.com/new' });
    expect(projectNamed(list, ' acme ')?.id).toBe('p1');
    list = saveProject(list, createProject('p3', 'Beta', state));
    expect(renameProject(list, 'p3', 'acme').map((item) => item.name)).toEqual(['ACME', 'Beta']);
    expect(renameProject(list, 'p3', 'Gamma').map((item) => item.name)).toEqual(['ACME', 'Gamma']);
    const removed = deleteProject(list, 'p1');
    expect(restoreProject(removed, list[0]!, 0).map((item) => item.id)).toEqual(['p1', 'p3']);
  });

  it('lets the free plan keep one project and Pro many', () => {
    const one = [createProject('p1', 'Acme', state)];
    expect(FREE_PROJECTS).toBe(1);
    expect(canSaveProject([], 'Acme', false)).toBe(true);
    expect(canSaveProject(one, 'Beta', false)).toBe(false);
    expect(canSaveProject(one, 'acme', false)).toBe(true);
    expect(canSaveProject(one, 'Beta', true)).toBe(true);
    const full = Array.from({ length: MAX_PROJECTS }, (_, index) => createProject(`p${index}`, `P${index}`, state));
    expect(canSaveProject(full, 'New', true)).toBe(false);
    expect(saveProject(full, createProject('x', 'New', state))).toHaveLength(MAX_PROJECTS);
  });

  it('is validated from storage and shared in exports', () => {
    const project = createProject('p1', 'Acme', state);
    const parsed = parseSettings({
      projects: [
        project,
        { ...project, id: 'p2', name: 'acme' },
        { ...project, id: 'p3', name: 'Bad url', url: 'javascript:alert(1)' },
        { ...project, id: 'p4', name: 'No sizes', viewports: [] },
        {
          ...project,
          id: 'p1',
          name: 'Odd',
          breakpoints: 'unknown',
          css: 42,
          compare: { mode: 'fixed', url: 'ftp://x' },
          saved: 'yesterday',
        },
      ],
    }).projects;
    expect(parsed.map((item) => item.name)).toEqual(['Acme', 'Odd']);
    expect(parsed[0]).toEqual(project);
    expect(parsed[1]).toMatchObject({ breakpoints: 'none', css: '', compare: null, saved: 0 });
    expect(parsed[1]!.id).not.toBe('p1');

    let settings = settingsReducer(defaultSettings(), { type: 'saveProject', project });
    expect(settings.projects).toHaveLength(1);
    const imported = parseSettingsImport(createSettingsExport(settings), defaultSettings());
    expect(imported?.projects[0]).toEqual(project);
    settings = settingsReducer(settings, {
      type: 'setWorkspace',
      workspace: {
        viewports: projectViewports(project),
        breakpoints: 'mui',
        customBreakpoints: [],
        grid: project.grid,
      },
    });
    expect(settings.breakpoints).toBe('mui');
    expect(settings.viewports).toHaveLength(2);
  });
});
