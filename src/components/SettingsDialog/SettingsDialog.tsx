import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CHECK_KINDS, type CheckKind } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import { LANGUAGES, LANGUAGE_NAMES } from '../../i18n/translate';
import type { MessageKey } from '../../i18n/en';
import type { VerifyResult } from '../../services/license';
import { FRAMEWORK_SET_IDS } from '../../data/breakpoints';
import { formatBytes } from '../../state/audit';
import {
  BUDGET_MAX,
  BUDGET_METRICS,
  budgetValue,
  type BudgetMetric,
  type PerformanceBudgets,
} from '../../state/budgets';
import { CHECK_KIND_KEYS } from '../../state/checks';
import { TRIAL_DAYS, type Entitlement } from '../../state/license';
import { PRO_FEATURES, PRO_FEATURE_KEYS, isProCheck, type ProFeature } from '../../state/plan';
import { matchRanges, matchesWords, searchWords } from '../../state/settings-search';
import type { SnapshotPage } from '../../state/snapshots';
import { ACCENTS, CANVASES } from '../../services/storage';
import type {
  AccentColor,
  Breakpoint,
  BreakpointSetId,
  BrandingSettings,
  BreakpointerSettings,
  CanvasStyle,
  GridColumns,
  GridSettings,
  LanguagePreference,
  PanelSettings,
  SyncSettings,
  ThemePreference,
  WorkspaceLayout,
} from '../../types';
import {
  BASELINE_OPTIONS,
  GRID_COLUMN_OPTIONS,
  MAX_CUSTOM_BREAKPOINTS,
  MAX_GRID_SPACING,
  MAX_RECENT_URLS,
} from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { BreakpointEditor } from './BreakpointEditor';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import { BrandSettings } from '../Plan/BrandSettings';
import { LicenseForm } from '../Plan/LicenseForm';
import { ProBadge, usePlan } from '../Plan/PlanContext';
import { PRO_FEATURE_ICONS } from '../Plan/UpgradeDialog';
import { Segmented } from '../Segmented/Segmented';
import { Select } from '../Select/Select';
import { Switch } from '../Switch/Switch';
import styles from './SettingsDialog.module.css';

type Props = {
  open: boolean;
  settings: BreakpointerSettings;
  version: string;
  /** Breakpoints found in the previewed page (null: unknown). */
  siteBreakpoints: number[] | null;
  onTheme: (theme: ThemePreference) => void;
  onLanguage: (language: LanguagePreference) => void;
  /** Appearance of the workspace (each control shows when its handler is given). */
  onAccent?: (accent: AccentColor) => void;
  onCanvas?: (canvas: CanvasStyle) => void;
  onLayout?: (layout: WorkspaceLayout) => void;
  onPanels?: (panels: Partial<PanelSettings>) => void;
  onBreakpoints: (set: BreakpointSetId) => void;
  onCustomBreakpoints: (breakpoints: Breakpoint[]) => void;
  onSync: (sync: Partial<SyncSettings>) => void;
  onChecks: (on: boolean) => void;
  /** Switches one kind of check on or off (the list shows when given). */
  onCheckKind?: (kind: CheckKind, enabled: boolean) => void;
  onGrid: (grid: Partial<GridSettings>) => void;
  onOpenSaved: (url: string) => void;
  onRemoveSaved: (url: string) => void;
  onRulers: (show: boolean) => void;
  onEmbedHints: (show: boolean) => void;
  onRememberRecent: (remember: boolean) => void;
  onClearRecent: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onManageAccess: () => void;
  onOpenShortcuts: () => void;
  /** Pages with visual baselines (null: not read yet); the section shows when the handlers are given. */
  snapshots?: SnapshotPage[] | null;
  onDeleteSnapshots?: (page: string) => void;
  onClearSnapshots?: () => void;
  /** The plan and licence (the section shows when given). */
  plan?: {
    entitlement: Entitlement;
    /** Where Pro is bought; null while sales haven't started. */
    checkoutUrl: string | null;
    onStartTrial: () => void;
    onActivate: (key: string) => Promise<VerifyResult>;
    onActivated: (result: Extract<VerifyResult, { ok: true }>) => void;
    onRemove: () => void;
  };
  /** Changes the performance budgets (the fields show when given). */
  onBudgets?: (budgets: Partial<PerformanceBudgets>) => void;
  /** Changes the brand on reports and images (the section shows when given). */
  onBranding?: (branding: Partial<BrandingSettings>) => void;
  /** The section shown when Settings opens (default: the first). */
  initialSection?: SettingsSection;
  onClose: () => void;
};

export type SettingsSection = 'appearance' | 'workspace' | 'tools' | 'brand' | 'pages' | 'data' | 'plan' | 'privacy';
type SectionId = SettingsSection;

const SECTIONS: { id: SectionId; title: MessageKey; icon: IconName }[] = [
  { id: 'appearance', title: 'settings.appearance', icon: 'sun' },
  { id: 'workspace', title: 'settings.workspace', icon: 'wrap' },
  { id: 'tools', title: 'settings.tools', icon: 'tools' },
  { id: 'brand', title: 'settings.brand', icon: 'palette' },
  { id: 'pages', title: 'settings.savedPages', icon: 'star' },
  { id: 'data', title: 'settings.data', icon: 'download' },
  { id: 'plan', title: 'settings.plan', icon: 'sparkle' },
  { id: 'privacy', title: 'settings.privacy', icon: 'shield' },
];

function Section({ id, title, icon, children }: { id: SectionId; title: string; icon: IconName; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId} data-section={id}>
      <h3 id={headingId} className={styles.heading}>
        <Icon name={icon} size={15} className={styles.headingIcon} />
        {title}
      </h3>
      <div className={styles.sectionBody} data-section-body>
        {children}
      </div>
    </section>
  );
}

/**
 * Scrolls the settings to a section — only the settings: scrollIntoView() would
 * also move the dialog when a section near the end can't reach the top.
 */
function scrollToSection(content: HTMLElement | null, id: SectionId, behavior: ScrollBehavior) {
  const section = content?.querySelector<HTMLElement>(`[data-section="${id}"]`);
  if (content && section) content.scrollTo({ top: Math.max(0, section.offsetTop - 6), behavior });
}

/** The CSS highlight that marks what a search found (see `::highlight()` in the styles). */
const SEARCH_HIGHLIGHT = 'breakpointer-settings-search';

/** Everything a setting can be found by: its text, and the names of controls that show none. */
function searchableText(item: Element): string {
  const names = Array.from(item.querySelectorAll('[aria-label], [data-tooltip], [placeholder]'), (element) =>
    [element.getAttribute('aria-label'), element.getAttribute('data-tooltip'), element.getAttribute('placeholder')]
      .filter(Boolean)
      .join(' '),
  );
  return `${item.textContent ?? ''} ${names.join(' ')}`;
}

/** Marks the words found in the settings shown, without changing the DOM (CSS Custom Highlight API). */
function highlightMatches(root: HTMLElement, words: readonly string[]) {
  if (typeof Highlight === 'undefined' || typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  if (words.length === 0) {
    CSS.highlights.delete(SEARCH_HIGHLIGHT);
    return;
  }
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('[data-search-hidden], select, option, textarea, .visually-hidden')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (
    let node = walker.nextNode() as Text | null;
    node && ranges.length < 400;
    node = walker.nextNode() as Text | null
  ) {
    for (const [start, end] of matchRanges(node.data, words)) {
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...ranges));
}

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.row} role="group" aria-labelledby={id}>
      <div className={styles.rowText}>
        <span id={id} className={styles.rowLabel}>
          {label}
        </span>
        {help && <span className={styles.rowHelp}>{help}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export function SettingsDialog(props: Props) {
  const { open, onClose } = props;
  const { t } = useI18n();
  return (
    <Dialog open={open} title={t('settings.title')} icon="settings" onClose={onClose} width={780} flush>
      <SettingsBody {...props} />
    </Dialog>
  );
}

function SettingsBody(props: Props) {
  const { settings, version } = props;
  const { t, language } = useI18n();
  const { pro, upgrade } = usePlan();
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const customId = useId();
  const sections = SECTIONS.filter(
    (section) => (section.id !== 'plan' || props.plan) && (section.id !== 'brand' || props.onBranding),
  );
  const [active, setActive] = useState<SectionId>(props.initialSection ?? 'appearance');
  // The section picked in the list stays highlighted while the content scrolls to it,
  // even when it is too near the end to reach the top; scrolling by hand takes over.
  const picked = useRef<SectionId | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const words = useMemo(() => searchWords(query), [query]);
  // What the search found: the sections and how many settings ("pages data|5").
  const [found, setFound] = useState('');
  const [foundIds, foundCount] = found.split('|') as [string, string | undefined];
  const foundSections = new Set(foundIds.split(' '));
  const searching = words.length > 0;

  // Opened on a section (e.g. "Enter a licence key"): show it.
  const initialSection = props.initialSection;
  useEffect(() => {
    if (!initialSection) return;
    picked.current = initialSection;
    scrollToSection(contentRef.current, initialSection, 'instant');
  }, [initialSection]);
  // Bumped when the custom list is replaced from outside the editor, so it starts over.
  const [editorKey, setEditorKey] = useState(0);

  // Highlight the section being read.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const onScroll = () => {
      if (picked.current) return;
      const shown = Array.from(content.querySelectorAll<HTMLElement>('[data-section]:not([data-search-hidden])'));
      const top = content.getBoundingClientRect().top;
      let current = shown[0]?.dataset.section as SectionId | undefined;
      for (const section of shown) {
        if (section.getBoundingClientRect().top - top < 80) current = section.dataset.section as SectionId;
      }
      // At the very bottom, the last section is the one being read.
      if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4)
        current = (shown[shown.length - 1]?.dataset.section as SectionId | undefined) ?? current;
      if (current) setActive(current);
    };
    const takeOver = () => {
      picked.current = null;
    };
    content.addEventListener('scroll', onScroll, { passive: true });
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const)
      content.addEventListener(type, takeOver, { passive: true });
    return () => {
      content.removeEventListener('scroll', onScroll);
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const)
        content.removeEventListener(type, takeOver);
    };
  }, []);

  // Searching: settings that don't match are hidden (and sections with none), the
  // words found are highlighted. Done on the DOM, so every row, switch and list is
  // searchable by what it shows, in the language shown; kept up to date while
  // settings change under a search.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const show = (element: HTMLElement, shown: boolean) => {
      if (shown) element.removeAttribute('data-search-hidden');
      else element.setAttribute('data-search-hidden', '');
    };
    const apply = () => {
      const ids: string[] = [];
      let count = 0;
      for (const section of content.querySelectorAll<HTMLElement>('[data-section]')) {
        const heading = section.querySelector('h3')?.textContent ?? '';
        const whole = words.length > 0 && matchesWords(heading, words);
        let matches = 0;
        const items = section.querySelector('[data-section-body]')?.children ?? [];
        for (const item of Array.from(items) as HTMLElement[]) {
          const shown = whole || matchesWords(searchableText(item), words);
          show(item, shown);
          if (shown) matches++;
        }
        show(section, matches > 0);
        if (matches > 0) ids.push(section.dataset.section!);
        count += matches;
      }
      const next = words.length ? `${ids.join(' ')}|${count}` : '';
      setFound((previous) => (previous === next ? previous : next));
      highlightMatches(content, words);
    };
    apply();
    if (words.length === 0) return;
    const observer = new MutationObserver(apply);
    observer.observe(content, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [words]);

  // A new search starts at the top of what it found.
  useEffect(() => {
    if (words.length === 0) return;
    picked.current = null;
    contentRef.current?.scrollTo({ top: 0 });
    const first = contentRef.current?.querySelector<HTMLElement>('[data-section]:not([data-search-hidden])');
    if (first) setActive(first.dataset.section as SectionId);
  }, [words]);

  useEffect(
    () => () => {
      if (typeof CSS !== 'undefined' && 'highlights' in CSS) CSS.highlights.delete(SEARCH_HIGHLIGHT);
    },
    [],
  );

  // Ctrl/⌘ + F searches Settings while it is open (the workspace's shortcuts are off under a dialog).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
        return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = (id: SectionId) => {
    picked.current = id;
    setActive(id);
    scrollToSection(contentRef.current, id, 'smooth');
  };

  const site = props.siteBreakpoints ?? [];
  const navSections = searching ? sections.filter((section) => foundSections.has(section.id)) : sections;

  return (
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label={t('settings.sections')}>
        <label className={styles.search}>
          <Icon name="search" size={14} className={styles.searchIcon} />
          <span className="visually-hidden">{t('settings.search')}</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={t('settings.search')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Escape first clears the search; a second press closes Settings.
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
              }
            }}
            data-autofocus={props.initialSection ? undefined : true}
            data-testid="settings-search"
          />
        </label>
        <p className="visually-hidden" role="status">
          {searching
            ? foundIds
              ? Number(foundCount) === 1
                ? t('settings.searchFoundOne')
                : t('settings.searchFound', { count: Number(foundCount) })
              : t('settings.searchNone', { query: query.trim() })
            : ''}
        </p>
        <ul className={styles.navList}>
          {navSections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={styles.navItem}
                aria-current={active === section.id ? 'true' : undefined}
                onClick={() => goTo(section.id)}
              >
                <Icon name={section.icon} size={15} />
                {t(section.title)}
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.version}>{t('settings.version', { version })}</p>
      </nav>

      <div ref={contentRef} className={styles.content}>
        {searching && !foundIds && (
          <div className={styles.noResults} data-testid="settings-no-results">
            <Icon name="search" size={18} />
            <p>{t('settings.searchNone', { query: query.trim() })}</p>
            <Button size="sm" variant="ghost" onClick={() => setQuery('')}>
              {t('settings.searchClear')}
            </Button>
          </div>
        )}
        <Section id="appearance" title={t('settings.appearance')} icon="sun">
          <Row label={t('settings.theme')}>
            <Segmented
              label={t('settings.theme')}
              value={settings.theme}
              onChange={props.onTheme}
              size="sm"
              options={[
                { value: 'system', label: t('theme.system'), icon: 'system' },
                { value: 'light', label: t('theme.light'), icon: 'sun' },
                { value: 'dark', label: t('theme.dark'), icon: 'moon' },
              ]}
            />
          </Row>
          {props.onAccent && (
            <Row label={t('settings.accent')} help={t('settings.accentHelp')}>
              <div className={styles.swatches} role="radiogroup" aria-label={t('settings.accent')}>
                {ACCENTS.map((accent) => (
                  <label
                    key={accent}
                    className={styles.swatch}
                    data-accent={accent}
                    data-tooltip={t(`accent.${accent}`)}
                  >
                    <input
                      type="radio"
                      name={`${customId}-accent`}
                      className="visually-hidden"
                      checked={settings.accent === accent}
                      onChange={() => props.onAccent?.(accent)}
                    />
                    <span className={styles.swatchDot} aria-hidden="true" />
                    <span className="visually-hidden">{t(`accent.${accent}`)}</span>
                  </label>
                ))}
              </div>
            </Row>
          )}
          {props.onCanvas && (
            <div className={styles.canvasBlock} role="radiogroup" aria-labelledby={`${customId}-canvas`}>
              <div className={styles.rowText}>
                <span id={`${customId}-canvas`} className={styles.rowLabel}>
                  {t('settings.canvas')}
                </span>
                <span className={styles.rowHelp}>{t('settings.canvasHelp')}</span>
              </div>
              <div className={styles.canvases}>
                {CANVASES.map((canvas) => (
                  <label key={canvas} className={styles.canvasOption} data-canvas={canvas}>
                    <input
                      type="radio"
                      name={`${customId}-canvas-style`}
                      className="visually-hidden"
                      checked={settings.canvas === canvas}
                      onChange={() => props.onCanvas?.(canvas)}
                    />
                    <span className={styles.canvasPreview} aria-hidden="true">
                      <span />
                      <span />
                    </span>
                    <span className={styles.canvasName}>{t(`canvas.${canvas}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {props.onLayout && (
            <Row label={t('settings.layout')}>
              <Segmented
                label={t('settings.layout')}
                value={settings.layout}
                onChange={props.onLayout}
                size="sm"
                options={[
                  { value: 'wrap', label: t('layout.wrap'), icon: 'wrap' },
                  { value: 'row', label: t('layout.row'), icon: 'row' },
                  { value: 'stack', label: t('layout.stack'), icon: 'stack' },
                ]}
              />
            </Row>
          )}
          {props.onPanels && (
            <>
              <Switch
                checked={settings.panels.sidebar}
                onChange={(sidebar) => props.onPanels?.({ sidebar })}
                label={t('settings.sidebar')}
                description={t('settings.sidebarHelp')}
              />
              <Switch
                checked={settings.panels.statusBar}
                onChange={(statusBar) => props.onPanels?.({ statusBar })}
                label={t('settings.statusBar')}
                description={t('settings.statusBarHelp')}
              />
              <Switch
                checked={settings.panels.minimap}
                onChange={(minimap) => props.onPanels?.({ minimap })}
                label={t('settings.minimap')}
                description={t('settings.minimapHelp')}
              />
            </>
          )}
          <Row label={t('settings.language')}>
            <Select
              size="sm"
              aria-label={t('settings.language')}
              value={settings.language}
              onChange={(event) => props.onLanguage(event.target.value as LanguagePreference)}
            >
              <option value="auto">{t('language.auto')}</option>
              {LANGUAGES.map((code) => (
                <option key={code} value={code} lang={code}>
                  {LANGUAGE_NAMES[code]}
                </option>
              ))}
            </Select>
          </Row>
        </Section>

        <Section id="workspace" title={t('settings.workspace')} icon="wrap">
          <Row label={t('settings.breakpoints')} help={t('settings.breakpointsHelp')}>
            <Select
              size="sm"
              aria-label={t('settings.breakpoints')}
              value={settings.breakpoints}
              onChange={(event) => props.onBreakpoints(event.target.value as BreakpointSetId)}
            >
              <option value="none">{t('breakpoints.none')}</option>
              {FRAMEWORK_SET_IDS.map((set) => (
                <option key={set} value={set}>
                  {t(`breakpoints.${set}`)}
                </option>
              ))}
              <option value="custom">{t('breakpoints.custom')}</option>
              <option value="site">{t('breakpoints.site')}</option>
            </Select>
          </Row>
          {settings.breakpoints === 'site' && (
            <p className={styles.note}>
              <Icon name="scan" size={15} />
              <span>
                {site.length
                  ? t('settings.siteBreakpointsFound', { list: site.join(', ') })
                  : t('settings.siteBreakpointsHelp')}
              </span>
            </p>
          )}
          {settings.breakpoints === 'custom' && (
            <div className={styles.subsection} role="group" aria-labelledby={customId}>
              <div className={styles.subsectionHead}>
                <div className={styles.rowText}>
                  <span id={customId} className={styles.rowLabel}>
                    {t('settings.customBreakpoints')}
                  </span>
                  <span className={styles.rowHelp}>{t('settings.customBreakpointsHelp')}</span>
                </div>
                {site.length > 0 && (
                  <Button
                    size="sm"
                    icon="scan"
                    onClick={() => {
                      props.onCustomBreakpoints(
                        site.slice(0, MAX_CUSTOM_BREAKPOINTS).map((min) => ({ name: String(min), min })),
                      );
                      setEditorKey((key) => key + 1);
                    }}
                  >
                    {t('settings.useSiteBreakpoints')}
                  </Button>
                )}
              </div>
              <BreakpointEditor
                key={editorKey}
                breakpoints={settings.customBreakpoints}
                onChange={props.onCustomBreakpoints}
              />
            </div>
          )}
          <Switch
            checked={settings.showRulers}
            onChange={props.onRulers}
            label={t('settings.rulers')}
            description={t('settings.rulersHelp')}
          />
          <Switch
            checked={settings.embedHints}
            onChange={props.onEmbedHints}
            label={t('settings.embedHints')}
            description={t('settings.embedHintsHelp')}
          />
          <Switch
            checked={settings.rememberRecent}
            onChange={props.onRememberRecent}
            label={t('settings.recent')}
            description={t('settings.recentHelp', { max: MAX_RECENT_URLS })}
          />
          {settings.rememberRecent && settings.recentUrls.length > 0 && (
            <div>
              <Button size="sm" variant="ghost" icon="trash" onClick={props.onClearRecent}>
                {t('settings.clearRecent')}
              </Button>
            </div>
          )}
        </Section>

        <Section id="tools" title={t('settings.tools')} icon="tools">
          <p className={styles.help}>{t('settings.toolsHelp')}</p>
          <Switch
            checked={settings.sync.scroll}
            onChange={(scroll) => props.onSync({ scroll })}
            label={t('tools.syncScroll')}
            description={t('settings.syncScrollHelp')}
          />
          <Switch
            checked={settings.sync.navigation}
            onChange={(navigation) => props.onSync({ navigation })}
            label={t('tools.syncNavigation')}
            description={t('settings.syncNavigationHelp')}
          />
          <Switch
            checked={pro && settings.sync.interactions}
            onChange={(interactions) => (pro ? props.onSync({ interactions }) : upgrade('syncInteractions'))}
            label={
              <>
                {t('tools.syncInteractions')}
                {!pro && <ProBadge feature="syncInteractions" className={styles.inlineBadge} />}
              </>
            }
            description={t('settings.syncInteractionsHelp')}
          />
          <Switch
            checked={settings.checks}
            onChange={props.onChecks}
            label={t('tools.checks')}
            description={t('settings.checksHelp')}
          />
          {settings.checks && props.onCheckKind && (
            <fieldset className={styles.checkKinds} data-testid="check-kinds">
              <legend className={styles.checkKindsLegend}>{t('settings.checkKinds')}</legend>
              {CHECK_KINDS.map((kind) => {
                // The accessibility checks come with Pro: on the free plan they are off, and
                // switching one on shows what Pro brings.
                const locked = !pro && isProCheck(kind);
                return (
                  <label key={kind} className={styles.checkKind}>
                    <input
                      type="checkbox"
                      checked={!locked && !settings.disabledChecks.includes(kind)}
                      onChange={(event) =>
                        locked ? upgrade('a11yChecks') : props.onCheckKind?.(kind, event.target.checked)
                      }
                    />
                    <span>{t(CHECK_KIND_KEYS[kind])}</span>
                    {locked && <ProBadge feature="a11yChecks" />}
                  </label>
                );
              })}
            </fieldset>
          )}
          <Switch
            checked={settings.grid.show}
            onChange={(show) => props.onGrid({ show })}
            label={t('settings.grid')}
            description={t('settings.gridHelp')}
          />
          <div className={styles.gridOptions}>
            <label className={styles.inlineField}>
              <span>{t('settings.gridColumns')}</span>
              <Select
                size="sm"
                value={String(settings.grid.columns)}
                onChange={(event) => {
                  const value = event.target.value;
                  props.onGrid({ columns: (value === 'auto' ? 'auto' : Number(value)) as GridColumns });
                }}
              >
                {GRID_COLUMN_OPTIONS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option === 'auto' ? t('settings.gridAuto') : option}
                  </option>
                ))}
              </Select>
            </label>
            <NumberField
              label={t('settings.gridGutter')}
              value={settings.grid.gutter}
              max={MAX_GRID_SPACING}
              onCommit={(gutter) => props.onGrid({ gutter })}
            />
            <NumberField
              label={t('settings.gridMargin')}
              value={settings.grid.margin}
              max={MAX_GRID_SPACING}
              onCommit={(margin) => props.onGrid({ margin })}
            />
            <label className={styles.inlineField}>
              <span>{t('settings.gridBaseline')}</span>
              <Select
                size="sm"
                value={String(settings.grid.baseline)}
                onChange={(event) => props.onGrid({ baseline: Number(event.target.value) })}
              >
                {BASELINE_OPTIONS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option === 0 ? t('settings.gridBaselineOff') : `${option}px`}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {props.onBudgets && (
            <div className={styles.budgets} data-testid="budgets">
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>
                  {t('settings.budgets')}
                  {!pro && <ProBadge feature="budgets" className={styles.inlineBadge} />}
                </span>
                <span className={styles.rowHelp}>{t('settings.budgetsHelp')}</span>
              </div>
              <div className={styles.gridOptions}>
                {BUDGET_METRICS.map((metric) => (
                  <BudgetField
                    key={metric}
                    metric={metric}
                    label={t(BUDGET_LABEL_KEYS[metric])}
                    value={pro ? settings.budgets[metric] : null}
                    disabled={!pro}
                    onCommit={(value) => props.onBudgets?.({ [metric]: value })}
                  />
                ))}
                {!pro && (
                  <Button size="sm" variant="ghost" onClick={() => upgrade('budgets')}>
                    {t('pro.see')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Section>

        {props.onBranding && (
          <Section id="brand" title={t('settings.brand')} icon="palette">
            <BrandSettings branding={settings.branding} onChange={props.onBranding} />
          </Section>
        )}

        <Section id="pages" title={t('settings.savedPages')} icon="star">
          <p className={styles.help}>{t('settings.savedPagesHelp')}</p>
          {settings.savedPages.length === 0 ? (
            <p className={styles.empty}>{t('settings.savedPagesEmpty')}</p>
          ) : (
            <ul className={styles.savedList} data-testid="saved-pages">
              {settings.savedPages.map((url) => (
                <li key={url} className={styles.savedRow}>
                  <Icon name="star" size={14} className={styles.savedIcon} />
                  <span className={styles.savedUrl} title={url}>
                    {url}
                  </span>
                  <Button
                    size="sm"
                    icon="arrowRight"
                    onClick={() => props.onOpenSaved(url)}
                    aria-label={t('settings.openSavedLabel', { url })}
                  >
                    {t('settings.openSaved')}
                  </Button>
                  <IconButton
                    icon="trash"
                    size="sm"
                    tone="danger"
                    label={t('settings.removeSaved', { url })}
                    onClick={() => props.onRemoveSaved(url)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="data" title={t('settings.data')} icon="download">
          <p className={styles.help}>{t('settings.dataHelp')}</p>
          <div className={styles.buttons}>
            <Button size="sm" icon="download" onClick={props.onExport}>
              {t('settings.export')}
            </Button>
            <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()}>
              {t('settings.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) props.onImport(file);
                event.target.value = '';
              }}
              data-testid="import-input"
            />
          </div>
          {props.onDeleteSnapshots && props.onClearSnapshots && (
            <div className={styles.subsection} data-testid="snapshot-list">
              <div className={styles.subsectionHead}>
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>{t('settings.snapshots')}</span>
                  <span className={styles.rowHelp}>{t('settings.snapshotsHelp')}</span>
                </div>
                {props.snapshots && props.snapshots.length > 0 && (
                  <Button size="sm" variant="ghost" icon="trash" onClick={props.onClearSnapshots}>
                    {t('settings.snapshotsClear')}
                  </Button>
                )}
              </div>
              {props.snapshots && props.snapshots.length === 0 && (
                <p className={styles.empty}>{t('settings.snapshotsEmpty')}</p>
              )}
              {props.snapshots && props.snapshots.length > 0 && (
                <ul className={styles.savedList}>
                  {props.snapshots.map((entry) => (
                    <li key={entry.page} className={styles.savedRow}>
                      <Icon name="gallery" size={14} className={styles.snapshotIcon} />
                      <span className={styles.savedUrl} title={entry.page}>
                        {entry.page}
                      </span>
                      <span className={styles.snapshotMeta}>
                        {entry.count === 1
                          ? t('settings.snapshotsPageOne', { size: formatBytes(entry.bytes, language) })
                          : t('settings.snapshotsPage', {
                              count: entry.count,
                              size: formatBytes(entry.bytes, language),
                            })}
                      </span>
                      <IconButton
                        icon="trash"
                        size="sm"
                        tone="danger"
                        label={t('settings.snapshotsDelete', { page: entry.page })}
                        onClick={() => props.onDeleteSnapshots?.(entry.page)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Row label={t('settings.reset')} help={t('settings.resetHelp')}>
            <Button size="sm" variant="danger" icon="reset" onClick={props.onReset}>
              {t('settings.resetButton')}
            </Button>
          </Row>
        </Section>

        {props.plan && <PlanSection {...props.plan} />}

        <Section id="privacy" title={t('settings.privacy')} icon="shield">
          <p className={styles.help}>{t('settings.privacyBody')}</p>
          <div className={styles.buttons}>
            <Button size="sm" icon="shield" onClick={props.onManageAccess}>
              {t('settings.manageAccess')}
            </Button>
            <Button size="sm" icon="keyboard" onClick={props.onOpenShortcuts}>
              {t('settings.shortcuts')}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

/** The plan: free, the Pro trial or a licence; entering and removing a licence key. */
function PlanSection({
  entitlement,
  checkoutUrl,
  onStartTrial,
  onActivate,
  onActivated,
  onRemove,
}: NonNullable<Props['plan']>) {
  const { t, language } = useI18n();
  const { upgrade } = usePlan();
  const date = (time: number) =>
    new Date(time).toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' });
  const { license, trial } = entitlement;
  const licensed = entitlement.source === 'license' && license;

  return (
    <Section id="plan" title={t('settings.plan')} icon="sparkle">
      <div className={styles.planStatus} data-testid="plan-status" data-plan={entitlement.plan}>
        <span className={styles.planIcon} aria-hidden="true">
          <Icon name={entitlement.plan === 'pro' ? 'sparkle' : 'layers'} size={18} />
        </span>
        <div className={styles.rowText}>
          <span className={styles.rowLabel}>
            {licensed
              ? t('pro.name')
              : trial.status === 'active'
                ? trial.daysLeft === 1
                  ? t('pro.trialActiveOne')
                  : t('pro.trialActive', { days: trial.daysLeft })
                : t('settings.planFree')}
          </span>
          <span className={styles.rowHelp}>
            {licensed
              ? [
                  t('settings.planLicensed', { name: license.name }),
                  license.expiresAt === null
                    ? t('settings.planForever')
                    : t('settings.planUntil', { date: date(license.expiresAt) }),
                  t('settings.planId', { id: license.id }),
                ].join(' · ')
              : license?.expired && license.expiresAt !== null
                ? t('settings.planExpired', { date: date(license.expiresAt) })
                : t('settings.planFreeHelp')}
          </span>
        </div>
        {entitlement.source !== 'license' && (
          <Button size="sm" variant="primary" icon="sparkle" onClick={() => upgrade()}>
            {t('settings.planFeatures')}
          </Button>
        )}
      </div>

      {licensed ? (
        <Row label={t('settings.planRemove')} help={t('settings.planRemoveHelp')}>
          <Button size="sm" variant="ghost" icon="trash" onClick={onRemove}>
            {t('settings.planRemove')}
          </Button>
        </Row>
      ) : (
        <>
          {(trial.status === 'available' || checkoutUrl) && (
            <div className={styles.buttons}>
              {trial.status === 'available' && (
                <Button size="sm" icon="sparkle" onClick={onStartTrial} data-testid="settings-start-trial">
                  {t('pro.trialStart', { days: TRIAL_DAYS })}
                </Button>
              )}
              {checkoutUrl && (
                <a className={styles.linkButton} href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={14} />
                  {t('pro.get')}
                </a>
              )}
            </div>
          )}
          <LicenseForm onActivate={onActivate} onActivated={onActivated} />
        </>
      )}

      <ul className={styles.planFeatures} aria-label={t('settings.planFeatures')}>
        {PRO_FEATURES.map((feature: ProFeature) => (
          <li key={feature}>
            <Icon name={PRO_FEATURE_ICONS[feature]} size={14} />
            <span>{t(PRO_FEATURE_KEYS[feature].title)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const BUDGET_LABEL_KEYS: Record<BudgetMetric, MessageKey> = {
  transferred: 'settings.budgetTransferred',
  requests: 'settings.budgetRequests',
  lcp: 'settings.budgetLcp',
  cls: 'settings.budgetCls',
};

/** A budget's limit, saved on blur or Enter; empty is no limit. */
function BudgetField({
  metric,
  label,
  value,
  disabled,
  onCommit,
}: {
  metric: BudgetMetric;
  label: string;
  value: number | null;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    // A typo that isn't a number goes back; an emptied field removes the limit.
    if (draft.trim() !== '' && budgetValue(metric, draft) === null) return;
    const next = budgetValue(metric, draft);
    if (next !== value) onCommit(next);
  };
  return (
    <label className={styles.inlineField}>
      <span>{label}</span>
      <input
        className={`field ${styles.numberField}`}
        type="number"
        inputMode="decimal"
        min={0}
        max={BUDGET_MAX[metric]}
        step={metric === 'cls' ? 0.01 : 1}
        placeholder={t('settings.budgetNone')}
        disabled={disabled}
        value={draft ?? (value === null ? '' : String(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape' && draft !== null) {
            event.preventDefault();
            setDraft(null);
          }
        }}
        data-budget={metric}
      />
    </label>
  );
}

/** A whole number from 0 to `max`, saved on blur or Enter (empty or invalid input goes back). */
function NumberField({
  label,
  value,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const number = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(number)) return;
    const next = Math.min(max, Math.max(0, Math.round(number)));
    if (next !== value) onCommit(next);
  };
  return (
    <label className={styles.inlineField}>
      <span>{label}</span>
      <input
        className={`field ${styles.numberField}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          // Escape first undoes the edit; a second press closes the dialog.
          if (event.key === 'Escape' && draft !== null) {
            event.preventDefault();
            setDraft(null);
          }
        }}
      />
    </label>
  );
}
