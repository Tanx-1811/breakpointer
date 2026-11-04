import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { searchCommands } from '../../state/commands';
import { GUIDES, type Guide, type GuideId } from '../../state/guides';
import { LEARN_TASKS, learnSummary, type LearnProgress, type LearnTaskInfo } from '../../state/learn';
import { OMNIBOX_KEYWORD } from '../../utils/constants';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './HelpDialog.module.css';

/** Workspace shortcuts handled in hooks/useShortcuts.ts. `palette` is shown with the platform's modifier. */
export const WORKSPACE_SHORTCUTS: { keys: string[]; label: MessageKey }[] = [
  { keys: ['palette', 'K'], label: 'help.palette' },
  { keys: ['/'], label: 'help.focusAddress' },
  { keys: ['R'], label: 'help.reloadAll' },
  { keys: ['A'], label: 'help.addViewport' },
  { keys: ['G'], label: 'help.groups' },
  { keys: ['F'], label: 'help.fit' },
  { keys: ['+'], label: 'help.zoomIn' },
  { keys: ['−'], label: 'help.zoomOut' },
  { keys: ['0'], label: 'help.actualSize' },
  { keys: ['L'], label: 'help.layout' },
  { keys: ['\\'], label: 'help.sidebar' },
  { keys: ['M'], label: 'help.rulers' },
  { keys: ['I'], label: 'help.inspect' },
  { keys: ['E'], label: 'help.audit' },
  { keys: ['W'], label: 'help.scan' },
  { keys: ['B'], label: 'help.batch' },
  { keys: ['V'], label: 'help.visual' },
  { keys: ['Q'], label: 'help.qa' },
  { keys: ['X'], label: 'help.measure' },
  { keys: ['N'], label: 'help.notes' },
  { keys: ['C'], label: 'help.contrast' },
  { keys: ['O'], label: 'help.outlines' },
  { keys: ['P'], label: 'help.floating' },
  { keys: ['D'], label: 'help.present' },
  { keys: ['[', ']'], label: 'help.cycleFocus' },
  { keys: ['1…8'], label: 'help.focusNumber' },
  { keys: ['S'], label: 'help.capture' },
  { keys: ['T'], label: 'help.theme' },
  { keys: ['H'], label: 'help.explain' },
  { keys: ['Esc'], label: 'help.escape' },
  { keys: ['Alt ←', 'Alt →'], label: 'help.history' },
  { keys: ['Space'], label: 'help.pan' },
  { keys: ['Ctrl/⌘'], label: 'help.wheelZoom' },
  { keys: ['?'], label: 'help.help' },
];

/** What this version brings, shown in Help's “What's new”. */
const NEWS: { icon: IconName; text: MessageKey }[] = [
  { icon: 'book', text: 'news.guides' },
  { icon: 'explain', text: 'news.explain' },
  { icon: 'checklist', text: 'news.qa' },
  { icon: 'ruler', text: 'news.media' },
  { icon: 'present', text: 'news.present' },
];

export type HelpSection = 'start' | 'shortcuts' | 'news' | 'support';

const SECTIONS: { id: HelpSection; icon: IconName; label: MessageKey }[] = [
  { id: 'start', icon: 'book', label: 'help.section.start' },
  { id: 'shortcuts', icon: 'keyboard', label: 'help.section.shortcuts' },
  { id: 'news', icon: 'sparkle', label: 'help.section.news' },
  { id: 'support', icon: 'message', label: 'help.section.support' },
];

type Props = {
  open: boolean;
  /** "0.4.0": the news are this version's. */
  version?: string;
  onClose: () => void;
  /** Current bindings from chrome.commands (already formatted for the platform; users can change them). */
  commandShortcuts: { open: string; preview: string };
  /** "⌘K" or "Ctrl K". */
  paletteShortcut?: string;
  /** Where Help opens (What's new after an update; Get started otherwise). */
  section?: HelpSection;
  /** Starts a guide (the guides show when given). */
  onGuide?: (guide: GuideId) => void;
  /** Turns on “What's this?” mode (its row shows when given). */
  onExplain?: () => void;
  /** The getting-started checklist (shows when given). */
  learn?: {
    progress: LearnProgress;
    onTask: (task: LearnTaskInfo) => void;
    /** Hides the checklist's button from the status bar, or shows it again. */
    onHidden: (hidden: boolean) => void;
  };
  /** Feedback, rating and sharing (the section shows when given). */
  support?: {
    feedbackUrl: string;
    rateUrl: string;
    /** "Rate on the Chrome Web Store" (or the store it was installed from). */
    rateLabel: string;
    /** The project on GitHub. */
    starUrl: string;
    onShare: () => void;
  };
};

/**
 * Help: guides and the getting-started checklist, shortcuts, what's new and
 * support, as sections of one dialog with a search over guides and shortcuts.
 */
export function HelpDialog(props: Props) {
  const { open, section: initial = 'start', onClose } = props;
  const { t } = useI18n();
  const id = useId();
  const [section, setSection] = useState<HelpSection>(initial);
  const [query, setQuery] = useState('');
  const tabRefs = useRef<Partial<Record<HelpSection, HTMLButtonElement | null>>>({});

  // Each time Help opens: the section asked for, and no search left from last time.
  useEffect(() => {
    if (!open) return;
    setSection(initial);
    setQuery('');
  }, [open, initial]);

  const sections = SECTIONS.filter((item) => item.id !== 'support' || props.support);
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const target =
      event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : delta ? index + delta : null;
    if (target === null) return;
    event.preventDefault();
    const next = sections[(target + sections.length) % sections.length]!.id;
    setSection(next);
    setQuery('');
    tabRefs.current[next]?.focus();
  };

  const searching = query.trim().length > 0;

  return (
    <Dialog open={open} title={t('help.title')} icon="help" onClose={onClose} width={880} flush>
      <div className={styles.layout}>
        <nav className={styles.nav} aria-label={t('help.sections')}>
          <label className={styles.search}>
            <Icon name="search" size={14} className={styles.searchIcon} />
            <span className="visually-hidden">{t('help.search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('help.searchPlaceholder')}
              onChange={(event) => setQuery(event.target.value)}
              data-autofocus
              data-testid="help-search"
            />
          </label>
          <div role="tablist" aria-orientation="vertical" aria-label={t('help.sections')} className={styles.tabs}>
            {sections.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => {
                  tabRefs.current[item.id] = element;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${item.id}`}
                aria-selected={!searching && section === item.id}
                aria-controls={`${id}-panel`}
                tabIndex={section === item.id ? 0 : -1}
                className={styles.tab}
                onClick={() => {
                  setSection(item.id);
                  setQuery('');
                }}
                onKeyDown={(event) => onTabKey(event, index)}
                data-testid={`help-tab-${item.id}`}
              >
                <Icon name={item.icon} size={15} />
                <span>{t(item.label)}</span>
                {item.id === 'start' && props.learn && <LearnBadge progress={props.learn.progress} />}
              </button>
            ))}
          </div>
        </nav>
        <div
          className={styles.content}
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={searching ? undefined : `${id}-tab-${section}`}
          aria-label={searching ? t('help.results', { query: query.trim() }) : undefined}
          tabIndex={0}
        >
          {searching ? (
            <SearchResults query={query.trim()} {...props} />
          ) : section === 'start' ? (
            <StartSection {...props} />
          ) : section === 'shortcuts' ? (
            <ShortcutsSection {...props} />
          ) : section === 'news' ? (
            <NewsSection version={props.version} />
          ) : (
            <SupportSection {...props} />
          )}
        </div>
      </div>
    </Dialog>
  );
}

function LearnBadge({ progress }: { progress: LearnProgress }) {
  const { t } = useI18n();
  const { done, total, complete } = learnSummary(progress);
  if (complete) return null;
  return (
    <span className={styles.tabCount} aria-label={t('learn.count', { done, total })}>
      {done}/{total}
    </span>
  );
}

function StartSection({ learn, onExplain, onGuide }: Props) {
  const { t } = useI18n();
  return (
    <>
      <p className={styles.lead}>{t('help.startLead')}</p>
      {learn && <LearnChecklist {...learn} />}
      {onExplain && (
        <div className={styles.explain}>
          <Icon name="explain" size={18} className={styles.explainIcon} />
          <div className={styles.explainText}>
            <h3 className={styles.explainTitle}>{t('explain.title')}</h3>
            <p>{t('help.explainText')}</p>
          </div>
          <Button size="sm" onClick={onExplain} data-testid="help-explain">
            {t('help.explainStart')}
          </Button>
        </div>
      )}
      {onGuide && (
        <>
          <h3 className={styles.heading}>{t('help.guides')}</h3>
          <GuideList guides={GUIDES} onGuide={onGuide} />
        </>
      )}
    </>
  );
}

function LearnChecklist({ progress, onTask, onHidden }: NonNullable<Props['learn']>) {
  const { t } = useI18n();
  const { done, total, complete } = learnSummary(progress);
  return (
    <section className={styles.learn} aria-labelledby="help-learn" data-testid="learn-checklist">
      <div className={styles.learnHead}>
        <div>
          <h3 id="help-learn" className={styles.learnTitle}>
            {complete ? t('learn.complete') : t('learn.title')}
          </h3>
          <p className={styles.learnCount}>{t('learn.count', { done, total })}</p>
        </div>
        <button type="button" className={styles.textButton} onClick={() => onHidden(!progress.hidden)}>
          {progress.hidden ? t('learn.showInStatus') : t('learn.hideFromStatus')}
        </button>
      </div>
      <div
        className={styles.meter}
        role="progressbar"
        aria-label={t('learn.title')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <ul className={styles.tasks}>
        {LEARN_TASKS.map((task) => {
          const finished = progress.done.includes(task.id);
          return (
            <li key={task.id} className={styles.task} data-done={finished || undefined} data-task={task.id}>
              {finished ? (
                <Icon name="check" size={15} className={styles.taskDone} />
              ) : (
                <span className={styles.taskTodo} aria-hidden="true" />
              )}
              <span className={styles.taskTitle}>
                {t(task.title)}
                <span className="visually-hidden"> · {finished ? t('learn.done') : t('learn.todo')}</span>
              </span>
              {!finished && (
                <Button size="sm" variant="ghost" onClick={() => onTask(task)}>
                  {t('learn.showMe')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GuideList({ guides, onGuide }: { guides: readonly Guide[]; onGuide: (guide: GuideId) => void }) {
  const { t } = useI18n();
  return (
    <ul className={styles.guides}>
      {guides.map((guide) => (
        <li key={guide.id}>
          <button
            type="button"
            className={styles.guide}
            onClick={() => onGuide(guide.id)}
            // The workspace tour keeps the name it had as Help's tour button.
            data-testid={guide.id === 'basics' ? 'help-tour' : 'help-guide'}
            data-guide={guide.id}
          >
            <Icon name={guide.icon} size={18} className={styles.guideIcon} />
            <span className={styles.guideText}>
              <span className={styles.guideTitle}>{t(guide.title)}</span>
              <span className={styles.guideSummary}>{t(guide.summary)}</span>
            </span>
            <span className={styles.guideMeta}>{t('help.guideSteps', { count: guide.steps.length })}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Shortcuts({ items, paletteShortcut }: { items: typeof WORKSPACE_SHORTCUTS; paletteShortcut: string }) {
  const { t } = useI18n();
  return (
    <dl className={styles.shortcuts}>
      {items.map((shortcut) => (
        <div key={shortcut.label} className={styles.shortcut}>
          <dt>{t(shortcut.label)}</dt>
          <dd>
            {shortcut.keys[0] === 'palette' ? (
              <>
                <kbd>{paletteShortcut}</kbd>
                <span className={styles.or}>/</span>
                <kbd>K</kbd>
              </>
            ) : (
              shortcut.keys.map((key) => <kbd key={key}>{key}</kbd>)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ShortcutsSection({ paletteShortcut = 'Ctrl K', commandShortcuts }: Props) {
  const { t } = useI18n();
  return (
    <>
      <h3 className={styles.heading}>{t('help.shortcuts')}</h3>
      <Shortcuts items={WORKSPACE_SHORTCUTS} paletteShortcut={paletteShortcut} />
      <p className={styles.note}>{t('help.shortcutsNote')}</p>
      <h3 className={styles.heading}>{t('help.global')}</h3>
      <dl className={styles.shortcuts}>
        <div className={styles.shortcut}>
          <dt>{t('help.openExtension')}</dt>
          <dd>{commandShortcuts.open ? <kbd>{commandShortcuts.open}</kbd> : '—'}</dd>
        </div>
        <div className={styles.shortcut}>
          <dt>{t('help.previewPage')}</dt>
          <dd>{commandShortcuts.preview ? <kbd>{commandShortcuts.preview}</kbd> : '—'}</dd>
        </div>
      </dl>
      <ul className={styles.tips}>
        <li>{t('help.omnibox', { keyword: OMNIBOX_KEYWORD })}</li>
        <li>{t('help.contextMenu')}</li>
      </ul>
      <h3 className={styles.heading}>{t('help.mouse')}</h3>
      <ul className={styles.tips}>
        <li>{t('help.mouseResize')}</li>
        <li>{t('help.mouseFocus')}</li>
        <li>{t('help.mouseInspect')}</li>
        <li>{t('help.mouseMeasure')}</li>
        <li>{t('help.mouseOverlay')}</li>
      </ul>
    </>
  );
}

function NewsSection({ version }: { version?: string }) {
  const { t } = useI18n();
  return (
    <div className={styles.news} data-testid="whats-new">
      <h3 className={styles.heading}>
        {t('help.whatsNew', { version: (version ?? '').split('.').slice(0, 2).join('.') })}
      </h3>
      <ul className={styles.newsList}>
        {NEWS.map((item) => (
          <li key={item.text}>
            <Icon name={item.icon} size={16} className={styles.newsIcon} />
            <span>{t(item.text)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SupportSection({ support }: Props) {
  const { t } = useI18n();
  return (
    <>
      {support && (
        <div className={styles.support} data-testid="help-support">
          <h3 className={styles.heading}>{t('help.support')}</h3>
          <p className={styles.supportText}>{t('help.supportText')}</p>
          <div className={styles.supportLinks}>
            <a className={styles.supportLink} href={support.feedbackUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="message" size={15} />
              {t('help.feedback')}
            </a>
            <a className={styles.supportLink} href={support.rateUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="heart" size={15} />
              {support.rateLabel}
            </a>
            <a className={styles.supportLink} href={support.starUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="star" size={15} />
              {t('help.rateGithub')}
            </a>
            <button type="button" className={styles.supportLink} onClick={support.onShare}>
              <Icon name="link" size={15} />
              {t('help.share')}
            </button>
          </div>
        </div>
      )}
      <h3 className={styles.heading}>{t('help.how')}</h3>
      <ul className={styles.tips}>
        <li>{t('help.how1')}</li>
        <li>{t('help.how2')}</li>
        <li>{t('help.how3')}</li>
        <li>{t('help.how4')}</li>
        <li>{t('help.how5')}</li>
      </ul>
    </>
  );
}

function SearchResults({ query, onGuide, paletteShortcut = 'Ctrl K' }: Props & { query: string }) {
  const { t } = useI18n();
  const guides = onGuide
    ? searchCommands(
        GUIDES.map((guide) => ({ guide, title: t(guide.title), keywords: t(guide.summary) })),
        query,
      ).map((item) => item.guide)
    : [];
  const shortcuts = searchCommands(
    WORKSPACE_SHORTCUTS.map((shortcut) => ({ shortcut, title: t(shortcut.label), keywords: shortcut.keys.join(' ') })),
    query,
  ).map((item) => item.shortcut);
  if (!guides.length && !shortcuts.length)
    return (
      <p className={styles.empty} role="status">
        {t('help.noResults', { query })}
      </p>
    );
  return (
    <>
      {guides.length > 0 && onGuide && (
        <>
          <h3 className={styles.heading}>{t('help.guides')}</h3>
          <GuideList guides={guides} onGuide={onGuide} />
        </>
      )}
      {shortcuts.length > 0 && (
        <>
          <h3 className={styles.heading}>{t('help.shortcuts')}</h3>
          <Shortcuts items={shortcuts} paletteShortcut={paletteShortcut} />
        </>
      )}
    </>
  );
}
