import type { DomNode, DomSummary, ElementStyles, StyleDeclaration } from '../agent/protocol';

/**
 * The Elements panel (v0.13): a preview's HTML as a tree that loads as it is
 * opened, and the CSS of the element selected — like a browser's developer
 * tools, inside the workspace.
 */

/** The tree with `node` in place of the element of the same selector (its children loaded). */
export function mergeNode(root: DomNode, node: DomNode): DomNode {
  if (root.selector === node.selector) return node;
  if (!root.children) return root;
  let changed = false;
  const children = root.children.map((child) => {
    const next = mergeNode(child, node);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export function findNode(root: DomNode | null, selector: string): DomNode | null {
  if (!root) return null;
  if (root.selector === selector) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, selector);
    if (found) return found;
  }
  return null;
}

/** The selectors from the root down to the element (both included); empty when it isn't in the tree. */
export function pathTo(root: DomNode | null, selector: string): string[] {
  if (!root) return [];
  if (root.selector === selector) return [root.selector];
  for (const child of root.children ?? []) {
    const path = pathTo(child, selector);
    if (path.length) return [root.selector, ...path];
  }
  return [];
}

export type TreeRow = { node: DomNode; level: number; expanded: boolean; parent: string | null };

/** The rows the tree shows: each node, and the children of the expanded ones (when loaded). */
export function visibleRows(root: DomNode | null, expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (node: DomNode, level: number, parent: string | null) => {
    const open = expanded.has(node.selector) && node.childCount > 0;
    rows.push({ node, level, expanded: open, parent });
    if (open) for (const child of node.children ?? []) walk(child, level + 1, node.selector);
  };
  if (root) walk(root, 0, null);
  return rows;
}

/** Selectors of every node whose children are loaded (to open the tree as it came). */
export function loadedSelectors(root: DomNode | null): string[] {
  if (!root?.children) return [];
  return [root.selector, ...root.children.flatMap(loadedSelectors)];
}

/** An attribute value shortened for the tree. */
export const shortValue = (value: string, max = 60) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** Computed properties shown before “Show all”: the ones that shape a responsive layout. */
export const KEY_COMPUTED = [
  'display',
  'position',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'overflow-x',
  'overflow-y',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column-start',
  'grid-column-end',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'white-space',
  'color',
  'background-color',
  'opacity',
  'visibility',
  'transform',
] as const;

/** The computed properties to list: the key ones (or all), filtered by a search over names and values. */
export function computedRows(
  computed: readonly [string, string][],
  showAll: boolean,
  query: string,
): [string, string][] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const key = new Set<string>(KEY_COMPUTED);
  const base = showAll || words.length ? computed : computed.filter(([name]) => key.has(name));
  if (!words.length) return [...base];
  return base.filter(([name, value]) =>
    words.every((word) => name.includes(word) || value.toLowerCase().includes(word)),
  );
}

const declarationText = (declaration: StyleDeclaration) =>
  `  ${declaration.name}: ${declaration.value}${declaration.important ? ' !important' : ''};`;

/** The element's matching rules as CSS, winners first (overridden declarations as comments). */
export function stylesCss(styles: ElementStyles): string {
  const block = (selector: string, declarations: StyleDeclaration[], header: string[]) => {
    const lines = declarations.map((declaration) =>
      declaration.overridden
        ? `  /* ${declarationText(declaration).trim()} (overridden) */`
        : declarationText(declaration),
    );
    return [...header, `${selector} {`, ...lines, '}'].join('\n');
  };
  const parts: string[] = [];
  if (styles.inline.length) parts.push(block('element.style', styles.inline, []));
  for (const rule of styles.rules)
    parts.push(
      block(rule.selector, rule.declarations, [
        `/* ${rule.source}${rule.conditions.map((condition) => ` · ${condition}`).join('')} */`,
      ]),
    );
  return parts.join('\n\n');
}

/** A starting point for live CSS: a rule for the element, with its winning declarations from the page. */
export function liveCssFor(selector: string, styles: ElementStyles | null): string {
  const winning = new Map<string, StyleDeclaration>();
  for (const declaration of [...(styles?.inline ?? []), ...(styles?.rules ?? []).flatMap((rule) => rule.declarations)])
    if (!declaration.overridden && !winning.has(declaration.name)) winning.set(declaration.name, declaration);
  const lines = [...winning.values()]
    .slice(0, 12)
    .map((declaration) => `  /* ${declaration.name}: ${declaration.value}; */`);
  return [`${selector} {`, ...lines, '}'].join('\n');
}

/** Lighthouse flags a DOM with more than 1,500 elements or deeper than 32 levels. */
export const LARGE_DOM = 1500;
export const DEEP_DOM = 32;

export type SummaryFinding = {
  kind: 'size' | 'depth' | 'duplicateIds' | 'obsolete' | 'inline' | 'important' | 'alt';
  warn: boolean;
};

/** What the summary says about the page, each item flagged when it is worth a look. */
export function summaryFindings(summary: DomSummary): SummaryFinding[] {
  return [
    { kind: 'size', warn: summary.elements > LARGE_DOM },
    { kind: 'depth', warn: summary.depth > DEEP_DOM },
    { kind: 'duplicateIds', warn: summary.duplicateIds.length > 0 },
    { kind: 'obsolete', warn: summary.obsolete.length > 0 },
    { kind: 'alt', warn: summary.imagesWithoutAlt > 0 },
    { kind: 'inline', warn: summary.inlineStyles > 50 },
    { kind: 'important', warn: summary.important > 100 },
  ];
}

/** The summary as Markdown, for a ticket. */
export function summaryMarkdown(
  summary: DomSummary,
  page: string,
  labels: {
    title: string;
    elements: string;
    depth: string;
    duplicateIds: string;
    obsolete: string;
    inline: string;
    important: string;
    alt: string;
    tags: string;
  },
): string {
  const list = (items: [string, number][]) =>
    items.length ? items.map(([name, count]) => `${name} (${count})`).join(', ') : '—';
  return [
    `**${labels.title}** · ${page}`,
    '',
    `- ${labels.elements}: ${summary.elements}`,
    `- ${labels.depth}: ${summary.depth}`,
    `- ${labels.duplicateIds}: ${list(summary.duplicateIds)}`,
    `- ${labels.obsolete}: ${list(summary.obsolete)}`,
    `- ${labels.alt}: ${summary.imagesWithoutAlt}`,
    `- ${labels.inline}: ${summary.inlineStyles}`,
    `- ${labels.important}: ${summary.important} / ${summary.rules}`,
    `- ${labels.tags}: ${list(summary.tags.slice(0, 12))}`,
  ].join('\n');
}
