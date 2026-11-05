import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  overriddenDeclarations,
  selectorSpecificity,
  splitDeclarations,
  splitTopLevel,
} from '../../src/agent/page-utils';
import type { DomNode, DomSummary, ElementStyles } from '../../src/agent/protocol';
import { ElementsPanel } from '../../src/components/ElementsPanel/ElementsPanel';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import {
  computedRows,
  findNode,
  liveCssFor,
  loadedSelectors,
  mergeNode,
  pathTo,
  stylesCss,
  summaryFindings,
  summaryMarkdown,
  visibleRows,
} from '../../src/state/elements';

describe('CSS cascade helpers', () => {
  it('computes specificity like browsers do', () => {
    expect(selectorSpecificity('#nav .item > a:hover')).toEqual([1, 2, 1]);
    expect(selectorSpecificity('ul li::before')).toEqual([0, 0, 3]);
    expect(selectorSpecificity('a:before')).toEqual([0, 0, 2]);
    expect(selectorSpecificity('*')).toEqual([0, 0, 0]);
    expect(selectorSpecificity('[type="text"].field')).toEqual([0, 2, 0]);
    expect(selectorSpecificity(':where(#a, .b) p')).toEqual([0, 0, 1]);
    expect(selectorSpecificity(':is(#a, .b) p')).toEqual([1, 0, 1]);
    expect(selectorSpecificity('button:not(.primary, #go)')).toEqual([1, 0, 1]);
    expect(selectorSpecificity('li:nth-child(2n of .x)')).toEqual([0, 2, 1]);
  });

  it('splits selector lists and declaration blocks at the top level only', () => {
    expect(splitTopLevel('a, :is(b, c), d[x=","]')).toEqual(['a', ':is(b, c)', 'd[x=","]']);
    expect(splitDeclarations('color: red; background: url("a;b.png") no-repeat; margin: 0 !important;')).toEqual([
      { name: 'color', value: 'red', important: false },
      { name: 'background', value: 'url("a;b.png") no-repeat', important: false },
      { name: 'margin', value: '0', important: true },
    ]);
    expect(splitDeclarations('')).toEqual([]);
  });

  it('marks declarations that lose for every property they set', () => {
    const flags = overriddenDeclarations([
      // Inline style.
      { inline: true, specificity: [0, 0, 0], order: 99, declarations: [{ important: false, longhands: ['color'] }] },
      // .a { color: blue !important; margin: 0 }
      {
        inline: false,
        specificity: [0, 1, 0],
        order: 2,
        declarations: [
          { important: true, longhands: ['color'] },
          { important: false, longhands: ['margin-top', 'margin-bottom'] },
        ],
      },
      // p { margin-top: 4px; margin-top: 8px }
      {
        inline: false,
        specificity: [0, 0, 1],
        order: 3,
        declarations: [
          { important: false, longhands: ['margin-top'] },
          { important: false, longhands: ['margin-top'] },
        ],
      },
    ]);
    // !important beats inline style; the class beats the type selector; a later declaration beats an earlier one.
    expect(flags).toEqual([[true], [false, false], [true, true]]);
  });
});

const node = (selector: string, tag: string, children?: DomNode[], childCount = children?.length ?? 0): DomNode => ({
  selector,
  tag,
  attributes: tag === 'div' ? [['class', 'card wide']] : [],
  childCount,
  text: children || childCount ? '' : 'Hello',
  hidden: false,
  children,
});

const TREE = node('html', 'html', [
  node('head', 'head', undefined, 3),
  node('body', 'body', [node('body > div', 'div', undefined, 2), node('body > p', 'p')]),
]);

describe('the tree', () => {
  it('finds nodes, their path, and merges children loaded later', () => {
    expect(findNode(TREE, 'body > p')?.tag).toBe('p');
    expect(pathTo(TREE, 'body > p')).toEqual(['html', 'body', 'body > p']);
    expect(pathTo(TREE, 'nothing')).toEqual([]);
    const loaded = node('body > div', 'div', [node('body > div > span', 'span'), node('body > div > em', 'em')]);
    const merged = mergeNode(TREE, loaded);
    expect(findNode(merged, 'body > div > em')).not.toBeNull();
    expect(merged.children![0]).toBe(TREE.children![0]);
    expect(loadedSelectors(merged)).toEqual(['html', 'body', 'body > div']);
  });

  it('lists the rows of expanded nodes only', () => {
    const rows = visibleRows(TREE, new Set(['html', 'body']));
    expect(rows.map((row) => [row.node.tag, row.level, row.expanded])).toEqual([
      ['html', 0, true],
      ['head', 1, false],
      ['body', 1, true],
      ['div', 2, false],
      ['p', 2, false],
    ]);
    expect(visibleRows(null, new Set())).toEqual([]);
  });
});

const STYLES: ElementStyles = {
  selector: 'body > p',
  inline: [{ name: 'color', value: 'red', important: false, overridden: false }],
  rules: [
    {
      selector: '.intro',
      conditions: ['@media (min-width: 768px)'],
      source: 'site.css',
      specificity: [0, 1, 0],
      declarations: [
        { name: 'color', value: 'blue', important: false, overridden: true },
        { name: 'font-size', value: '18px', important: false, overridden: false },
      ],
    },
  ],
  computed: [
    ['color', 'rgb(255, 0, 0)'],
    ['display', 'block'],
    ['font-size', '18px'],
    ['tab-size', '8'],
  ],
  box: { margin: [0, 0, 16, 0], border: [0, 0, 0, 0], padding: [4, 8, 4, 8], width: 300, height: 40 },
  unreadable: 1,
};

const SUMMARY: DomSummary = {
  elements: 2400,
  depth: 12,
  tags: [
    ['div', 900],
    ['span', 400],
  ],
  duplicateIds: [['main', 2]],
  obsolete: [],
  inlineStyles: 3,
  imagesWithoutAlt: 0,
  stylesheets: 4,
  unreadable: 1,
  rules: 800,
  important: 12,
};

describe('styles as text', () => {
  it('writes the rules as CSS with overridden declarations as comments', () => {
    const css = stylesCss(STYLES);
    expect(css).toContain('element.style {\n  color: red;\n}');
    expect(css).toContain('/* site.css · @media (min-width: 768px) */');
    expect(css).toContain('/* color: blue; (overridden) */');
    expect(css).toContain('  font-size: 18px;');
  });

  it('starts live CSS from the winning declarations', () => {
    expect(liveCssFor('body > p', STYLES)).toBe('body > p {\n  /* color: red; */\n  /* font-size: 18px; */\n}');
    expect(liveCssFor('p', null)).toBe('p {\n}');
  });

  it('filters computed properties: the key ones, all, or a search', () => {
    expect(computedRows(STYLES.computed, false, '').map(([name]) => name)).toEqual(['color', 'display', 'font-size']);
    expect(computedRows(STYLES.computed, true, '')).toHaveLength(4);
    expect(computedRows(STYLES.computed, false, 'tab')).toEqual([['tab-size', '8']]);
    expect(computedRows(STYLES.computed, false, 'rgb')).toEqual([['color', 'rgb(255, 0, 0)']]);
  });

  it('flags what is worth a look in the summary', () => {
    const warned = summaryFindings(SUMMARY)
      .filter((finding) => finding.warn)
      .map((finding) => finding.kind);
    expect(warned).toEqual(['size', 'duplicateIds']);
    const markdown = summaryMarkdown(SUMMARY, 'https://example.com/', {
      title: 'Summary',
      elements: 'Elements',
      depth: 'Depth',
      duplicateIds: 'Duplicate ids',
      obsolete: 'Obsolete',
      inline: 'Inline',
      important: 'Important',
      alt: 'Alt',
      tags: 'Tags',
    });
    expect(markdown).toContain('- Duplicate ids: main (2)');
    expect(markdown).toContain('- Obsolete: —');
    expect(markdown).toContain('- Important: 12 / 800');
  });
});

const wrap = (ui: ReactNode) => render(<I18nProvider language="en">{ui}</I18nProvider>);

const props = (patch: Partial<Parameters<typeof ElementsPanel>[0]> = {}) => ({
  cards: [
    { id: 'phone', name: 'Phone', width: 375 },
    { id: 'desktop', name: 'Desktop', width: 1440 },
  ],
  card: 'phone',
  onCard: vi.fn(),
  tree: TREE,
  loading: false,
  unavailable: false,
  expanded: new Set(['html', 'body']),
  onExpand: vi.fn(),
  selected: null,
  onSelect: vi.fn(),
  elementStyles: null,
  summary: SUMMARY,
  tab: 'styles' as const,
  onTab: vi.fn(),
  picking: false,
  onPick: vi.fn(),
  onRefresh: vi.fn(),
  onClose: vi.fn(),
  onCopyText: vi.fn(),
  onEditCss: vi.fn(),
  onCompare: vi.fn(),
  page: 'https://example.com/',
  ...patch,
});

describe('Elements panel', () => {
  it('shows the tree, expands with the keyboard and selects', async () => {
    const onExpand = vi.fn();
    const onSelect = vi.fn();
    wrap(<ElementsPanel {...props({ onExpand, onSelect })} />);
    const tree = screen.getByRole('tree', { name: 'The page’s HTML' });
    const items = within(tree).getAllByRole('treeitem');
    expect(items).toHaveLength(5);
    expect(items[3]).toHaveTextContent('<div class="card wide">…</div>');
    expect(items[4]).toHaveTextContent('<p>Hello</p>');
    items[0]!.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowRight}');
    expect(onExpand).toHaveBeenCalledWith('body > div', true);
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('body > div');
    expect(screen.getByText('Select an element in the tree, or pick one in a preview.')).toBeInTheDocument();
  });

  it('shows the styles of the element with overridden declarations', async () => {
    const onCopyText = vi.fn();
    const onCompare = vi.fn();
    wrap(<ElementsPanel {...props({ selected: 'body > p', elementStyles: STYLES, onCopyText, onCompare })} />);
    const rule = screen.getByTestId('elements-rule');
    expect(rule).toHaveTextContent('@media (min-width: 768px)');
    expect(rule).toHaveTextContent('site.css');
    expect(within(rule).getByText('blue').closest('li')).toHaveAttribute('data-overridden');
    expect(screen.getByText(/1 stylesheet from another site/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy CSS' }));
    expect(onCopyText).toHaveBeenCalledWith(expect.stringContaining('.intro {'));
    await userEvent.click(screen.getByRole('button', { name: 'Compare at every size' }));
    expect(onCompare).toHaveBeenCalledWith('body > p');
  });

  it('filters computed values, draws the box and summarises the page', () => {
    const { rerender } = wrap(
      <ElementsPanel {...props({ selected: 'body > p', elementStyles: STYLES, tab: 'computed' })} />,
    );
    expect(screen.getByTestId('elements-computed')).toHaveTextContent('display');
    rerender(
      <I18nProvider language="en">
        <ElementsPanel {...props({ selected: 'body > p', elementStyles: STYLES, tab: 'box' })} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('elements-box')).toHaveAccessibleName(/content 300 × 40, padding 4 8 4 8/);
    rerender(
      <I18nProvider language="en">
        <ElementsPanel {...props({ tab: 'summary' })} />
      </I18nProvider>,
    );
    const summary = screen.getByTestId('elements-summary');
    expect(summary).toHaveTextContent('2400');
    expect(summary).toHaveTextContent('main (2)');
    expect(summary).toHaveTextContent('Over 1,500 elements');
  });

  it('says when the preview can’t be read', () => {
    wrap(<ElementsPanel {...props({ tree: null, unavailable: true })} />);
    expect(screen.getByText(/can’t be read/)).toBeInTheDocument();
  });
});
