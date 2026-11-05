import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { DomNode, DomSummary, ElementStyles, StyleDeclaration } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import {
  computedRows,
  shortValue,
  stylesCss,
  summaryFindings,
  summaryMarkdown,
  visibleRows,
  type SummaryFinding,
  type TreeRow,
} from '../../state/elements';
import { Button, IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Select } from '../Select/Select';
import styles from './ElementsPanel.module.css';

export type ElementsTab = 'styles' | 'computed' | 'box' | 'summary';

type Props = {
  /** The previews that can be read (card id, name, width). */
  cards: { id: string; name: string; width: number }[];
  card: string | null;
  onCard: (cardId: string) => void;
  tree: DomNode | null;
  /** Reading the page right now. */
  loading: boolean;
  /** No agent answered (a site not allowed, or not a web page). */
  unavailable: boolean;
  expanded: ReadonlySet<string>;
  onExpand: (selector: string, open: boolean) => void;
  selected: string | null;
  onSelect: (selector: string) => void;
  elementStyles: ElementStyles | null;
  summary: DomSummary | null;
  tab: ElementsTab;
  onTab: (tab: ElementsTab) => void;
  picking: boolean;
  onPick: () => void;
  onRefresh: () => void;
  onClose: () => void;
  onCopyText: (text: string) => void;
  /** Live CSS with a rule for the selected element. */
  onEditCss: (selector: string) => void;
  /** The inspector, comparing the selected element at every size. */
  onCompare: (selector: string) => void;
  page: string | null;
};

const TABS: { id: ElementsTab; key: MessageKey }[] = [
  { id: 'styles', key: 'elements.tab.styles' },
  { id: 'computed', key: 'elements.tab.computed' },
  { id: 'box', key: 'elements.tab.box' },
  { id: 'summary', key: 'elements.tab.summary' },
];

/** The page's HTML as a tree and the CSS of the element selected, like a browser's developer tools. */
export function ElementsPanel(props: Props) {
  const { t } = useI18n();
  const id = useId();
  const tabRefs = useRef<Partial<Record<ElementsTab, HTMLButtonElement | null>>>({});

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length]!.id;
    props.onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside className={styles.panel} aria-labelledby={`${id}-title`} data-testid="elements-panel">
      <header className={styles.header}>
        <Icon name="code" size={16} />
        <h2 id={`${id}-title`} className={styles.title}>
          {t('elements.title')}
        </h2>
        <IconButton
          icon="inspect"
          size="sm"
          label={props.picking ? t('elements.picking') : t('elements.pick')}
          pressed={props.picking}
          onClick={props.onPick}
          data-testid="elements-pick"
        />
        <IconButton icon="reload" size="sm" label={t('elements.refresh')} onClick={props.onRefresh} />
        <IconButton icon="close" size="sm" label={t('elements.close')} shortcut="J" onClick={props.onClose} />
      </header>

      {props.cards.length > 1 && (
        <div className={styles.toolbar}>
          <label className={styles.label} htmlFor={`${id}-card`}>
            {t('elements.preview')}
          </label>
          <Select
            id={`${id}-card`}
            size="sm"
            value={props.card ?? ''}
            onChange={(event) => props.onCard(event.target.value)}
            data-testid="elements-card"
          >
            {props.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} · {card.width}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Tree {...props} />

      <div className={styles.tabs} role="tablist" aria-label={t('elements.tabs')}>
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.id}`}
            aria-selected={props.tab === tab.id}
            aria-controls={`${id}-details`}
            tabIndex={props.tab === tab.id ? 0 : -1}
            className={styles.tab}
            data-testid={`elements-tab-${tab.id}`}
            onClick={() => props.onTab(tab.id)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>
      <div
        className={styles.details}
        role="tabpanel"
        id={`${id}-details`}
        aria-labelledby={`${id}-tab-${props.tab}`}
        tabIndex={0}
      >
        {props.tab === 'summary' ? (
          <Summary {...props} />
        ) : !props.selected ? (
          <p className={styles.empty}>{t('elements.empty')}</p>
        ) : !props.elementStyles ? (
          <p className={styles.empty} role="status">
            {t('elements.loading')}
          </p>
        ) : props.tab === 'styles' ? (
          <Styles {...props} elementStyles={props.elementStyles} />
        ) : props.tab === 'computed' ? (
          <Computed computed={props.elementStyles.computed} />
        ) : (
          <Box elementStyles={props.elementStyles} />
        )}
      </div>
    </aside>
  );
}

/* ---------- The tree ---------- */

function Tree(props: Props) {
  const { t } = useI18n();
  const rows = useMemo(() => visibleRows(props.tree, props.expanded), [props.tree, props.expanded]);
  const refs = useRef(new Map<string, HTMLDivElement>());
  const [focus, setFocus] = useState<string | null>(null);
  const current = props.selected && rows.some((row) => row.node.selector === props.selected) ? props.selected : null;
  const tabStop =
    focus && rows.some((row) => row.node.selector === focus) ? focus : (current ?? rows[0]?.node.selector);

  // The selected element scrolls into view (a pick in a preview may select one far down).
  useEffect(() => {
    if (current) refs.current.get(current)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const move = (selector: string | undefined) => {
    if (!selector) return;
    setFocus(selector);
    refs.current.get(selector)?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>, row: TreeRow, index: number) => {
    const { node } = row;
    switch (event.key) {
      case 'ArrowDown':
        move(rows[index + 1]?.node.selector);
        break;
      case 'ArrowUp':
        move(rows[index - 1]?.node.selector);
        break;
      case 'ArrowRight':
        if (node.childCount > 0 && !row.expanded) props.onExpand(node.selector, true);
        else move(rows[index + 1]?.level === row.level + 1 ? rows[index + 1]!.node.selector : undefined);
        break;
      case 'ArrowLeft':
        if (row.expanded) props.onExpand(node.selector, false);
        else move(row.parent ?? undefined);
        break;
      case 'Home':
        move(rows[0]?.node.selector);
        break;
      case 'End':
        move(rows.at(-1)?.node.selector);
        break;
      case 'Enter':
      case ' ':
        props.onSelect(node.selector);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  if (!props.tree)
    return (
      <div className={styles.treeEmpty} role="status">
        {props.loading ? t('elements.loading') : props.unavailable ? t('elements.noAgent') : t('elements.loading')}
      </div>
    );

  return (
    <div className={styles.tree} role="tree" aria-label={t('elements.tree')} data-testid="elements-tree">
      {rows.map((row, index) => {
        const { node } = row;
        const selected = node.selector === current;
        return (
          <div
            key={node.selector}
            ref={(element) => {
              if (element) refs.current.set(node.selector, element);
              else refs.current.delete(node.selector);
            }}
            role="treeitem"
            aria-level={row.level + 1}
            aria-expanded={node.childCount > 0 ? row.expanded : undefined}
            aria-selected={selected}
            tabIndex={node.selector === tabStop ? 0 : -1}
            className={styles.row}
            data-hidden={node.hidden || undefined}
            data-testid="elements-node"
            style={{ paddingLeft: 6 + row.level * 14 }}
            onClick={() => {
              setFocus(node.selector);
              props.onSelect(node.selector);
            }}
            onKeyDown={(event) => onKey(event, row, index)}
          >
            <span
              className={styles.caret}
              aria-hidden="true"
              data-open={row.expanded || undefined}
              onClick={(event) => {
                if (node.childCount === 0) return;
                event.stopPropagation();
                props.onExpand(node.selector, !row.expanded);
              }}
            >
              {node.childCount > 0 && <Icon name="chevronRight" size={12} />}
            </span>
            <code className={styles.markup}>
              <span className={styles.punct}>&lt;</span>
              <span className={styles.tag}>{node.tag}</span>
              {node.attributes.slice(0, 6).map(([name, value]) => (
                <span key={name}>
                  {' '}
                  <span className={styles.attr}>{name}</span>
                  {value !== '' && (
                    <>
                      <span className={styles.punct}>=&quot;</span>
                      <span className={styles.value}>{shortValue(value)}</span>
                      <span className={styles.punct}>&quot;</span>
                    </>
                  )}
                </span>
              ))}
              {node.attributes.length > 6 && <span className={styles.punct}> …</span>}
              <span className={styles.punct}>&gt;</span>
              {node.text && <span className={styles.text}>{node.text}</span>}
              {node.childCount > 0 && !row.expanded && <span className={styles.punct}>…</span>}
              {(node.text || (node.childCount > 0 && !row.expanded)) && (
                <span className={styles.punct}>
                  &lt;/<span className={styles.tag}>{node.tag}</span>&gt;
                </span>
              )}
            </code>
            {node.hidden && (
              <span className={styles.hiddenMark} title={t('elements.hidden')}>
                <Icon name="eyeOff" size={12} />
                <span className="visually-hidden">{t('elements.hidden')}</span>
              </span>
            )}
          </div>
        );
      })}
      {rows.some((row) => row.node.truncated && row.expanded) && <p className={styles.note}>{t('elements.more')}</p>}
    </div>
  );
}

/* ---------- Styles ---------- */

function Declarations({ list }: { list: StyleDeclaration[] }) {
  const { t } = useI18n();
  return (
    <ul className={styles.declarations}>
      {list.map((declaration, index) => (
        <li
          key={`${declaration.name}-${index}`}
          className={styles.declaration}
          data-overridden={declaration.overridden || undefined}
          title={declaration.overridden ? t('elements.overridden') : undefined}
        >
          <span className={styles.property}>{declaration.name}</span>
          <span className={styles.punct}>: </span>
          <span className={styles.declValue}>{declaration.value}</span>
          {declaration.important && <span className={styles.important}> !important</span>}
          <span className={styles.punct}>;</span>
          {declaration.overridden && <span className="visually-hidden"> ({t('elements.overridden')})</span>}
        </li>
      ))}
    </ul>
  );
}

function Styles(props: Props & { elementStyles: ElementStyles }) {
  const { t } = useI18n();
  const { elementStyles: data } = props;
  return (
    <div className={styles.stylesTab} data-testid="elements-styles">
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" icon="copy" onClick={() => props.onCopyText(stylesCss(data))}>
          {t('elements.copyCss')}
        </Button>
        <Button size="sm" variant="ghost" icon="code" onClick={() => props.onEditCss(data.selector)}>
          {t('elements.editCss')}
        </Button>
        <Button size="sm" variant="ghost" icon="columns" onClick={() => props.onCompare(data.selector)}>
          {t('elements.compare')}
        </Button>
      </div>
      {data.inline.length > 0 && (
        <section className={styles.rule}>
          <div className={styles.ruleHead}>
            <code className={styles.selector}>element.style</code>
          </div>
          <Declarations list={data.inline} />
        </section>
      )}
      {data.rules.map((rule, index) => (
        <section key={`${rule.selector}-${index}`} className={styles.rule} data-testid="elements-rule">
          {rule.conditions.map((condition, conditionIndex) => (
            <code key={conditionIndex} className={styles.condition}>
              {condition}
            </code>
          ))}
          <div className={styles.ruleHead}>
            <code className={styles.selector} title={t('elements.specificity', { value: rule.specificity.join(',') })}>
              {rule.selector}
            </code>
            <span className={styles.source}>{rule.source}</span>
          </div>
          <Declarations list={rule.declarations} />
        </section>
      ))}
      {data.rules.length === 0 && data.inline.length === 0 && <p className={styles.empty}>{t('elements.noRules')}</p>}
      {data.unreadable > 0 && (
        <p className={styles.note}>
          {data.unreadable === 1 ? t('elements.unreadableOne') : t('elements.unreadable', { count: data.unreadable })}
        </p>
      )}
    </div>
  );
}

/* ---------- Computed ---------- */

function Computed({ computed }: { computed: [string, string][] }) {
  const { t } = useI18n();
  const id = useId();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const rows = computedRows(computed, showAll, query);
  return (
    <div className={styles.computedTab}>
      <div className={styles.filter}>
        <label htmlFor={`${id}-search`} className="visually-hidden">
          {t('elements.search')}
        </label>
        <input
          id={`${id}-search`}
          className={`field ${styles.search}`}
          type="search"
          value={query}
          placeholder={t('elements.search')}
          autoComplete="off"
          spellCheck={false}
          data-testid="elements-search"
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          {t('elements.showAll')}
        </label>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t('elements.noMatch')}</p>
      ) : (
        <dl className={styles.computed} data-testid="elements-computed">
          {rows.map(([name, value]) => (
            <div key={name} className={styles.computedRow}>
              <dt className={styles.property}>{name}</dt>
              <dd className={styles.declValue}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ---------- Box model ---------- */

const sides = (values: number[]) => values.map((value) => (value === 0 ? '–' : String(value)));

function Box({ elementStyles: data }: { elementStyles: ElementStyles }) {
  const { t } = useI18n();
  const { box } = data;
  const layer = (name: string, values: number[], inner: ReactNode, className: string | undefined) => {
    const [top, right, bottom, left] = sides(values);
    return (
      <div className={`${styles.boxLayer} ${className ?? ''}`}>
        <span className={styles.boxName}>{name}</span>
        <span className={styles.boxTop}>{top}</span>
        <span className={styles.boxLeft}>{left}</span>
        <div className={styles.boxInner}>{inner}</div>
        <span className={styles.boxRight}>{right}</span>
        <span className={styles.boxBottom}>{bottom}</span>
      </div>
    );
  };
  const label = t('elements.boxLabel', {
    width: box.width,
    height: box.height,
    padding: box.padding.join(' '),
    border: box.border.join(' '),
    margin: box.margin.join(' '),
  });
  return (
    <div className={styles.boxWrap} role="img" aria-label={label} data-testid="elements-box">
      {layer(
        'margin',
        box.margin,
        layer(
          'border',
          box.border,
          layer(
            'padding',
            box.padding,
            <span className={styles.content}>
              {box.width} × {box.height}
            </span>,
            styles.padding,
          ),
          styles.border,
        ),
        styles.margin,
      )}
    </div>
  );
}

/* ---------- Summary ---------- */

const FINDING_KEYS: Record<SummaryFinding['kind'], { label: MessageKey; hint: MessageKey }> = {
  size: { label: 'elements.summary.elements', hint: 'elements.summary.sizeHint' },
  depth: { label: 'elements.summary.depth', hint: 'elements.summary.depthHint' },
  duplicateIds: { label: 'elements.summary.duplicateIds', hint: 'elements.summary.duplicateHint' },
  obsolete: { label: 'elements.summary.obsolete', hint: 'elements.summary.obsoleteHint' },
  alt: { label: 'elements.summary.alt', hint: 'elements.summary.altHint' },
  inline: { label: 'elements.summary.inline', hint: 'elements.summary.inlineHint' },
  important: { label: 'elements.summary.important', hint: 'elements.summary.importantHint' },
};

function Summary(props: Props) {
  const { t } = useI18n();
  const { summary } = props;
  if (!summary)
    return (
      <p className={styles.empty} role="status">
        {props.unavailable ? t('elements.noAgent') : t('elements.loading')}
      </p>
    );
  const list = (items: [string, number][]) =>
    items.length ? items.map(([name, count]) => `${name} (${count})`).join(', ') : t('elements.summary.none');
  const value = (kind: SummaryFinding['kind']) => {
    switch (kind) {
      case 'size':
        return String(summary.elements);
      case 'depth':
        return String(summary.depth);
      case 'duplicateIds':
        return list(summary.duplicateIds);
      case 'obsolete':
        return list(summary.obsolete);
      case 'alt':
        return String(summary.imagesWithoutAlt);
      case 'inline':
        return String(summary.inlineStyles);
      case 'important':
        return t('elements.summary.importantValue', { important: summary.important, rules: summary.rules });
    }
  };
  const copy = () =>
    props.onCopyText(
      summaryMarkdown(summary, props.page ?? '', {
        title: t('elements.summary.title'),
        elements: t('elements.summary.elements'),
        depth: t('elements.summary.depth'),
        duplicateIds: t('elements.summary.duplicateIds'),
        obsolete: t('elements.summary.obsolete'),
        inline: t('elements.summary.inline'),
        important: t('elements.summary.important'),
        alt: t('elements.summary.alt'),
        tags: t('elements.summary.tags'),
      }),
    );
  return (
    <div className={styles.summary} data-testid="elements-summary">
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" icon="clipboard" onClick={copy}>
          {t('elements.copySummary')}
        </Button>
      </div>
      <ul className={styles.findings}>
        {summaryFindings(summary).map((finding) => (
          <li key={finding.kind} className={styles.finding} data-warn={finding.warn || undefined}>
            <Icon name={finding.warn ? 'alert' : 'check'} size={14} className={styles.findingIcon} />
            <span className={styles.findingLabel}>{t(FINDING_KEYS[finding.kind].label)}</span>
            <span className={styles.findingValue}>{value(finding.kind)}</span>
            {finding.warn && <span className={styles.findingHint}>{t(FINDING_KEYS[finding.kind].hint)}</span>}
          </li>
        ))}
      </ul>
      <h3 className={styles.subheading}>{t('elements.summary.tags')}</h3>
      <ul className={styles.tagList}>
        {summary.tags.map(([tag, count]) => (
          <li key={tag}>
            <code>{tag}</code> <span className={styles.count}>{count}</span>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        {t('elements.summary.sheets', { count: summary.stylesheets, unreadable: summary.unreadable })}
      </p>
    </div>
  );
}
