import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { OMNIBOX_KEYWORD } from '../../utils/constants';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
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
  { keys: ['M'], label: 'help.rulers' },
  { keys: ['I'], label: 'help.inspect' },
  { keys: ['E'], label: 'help.audit' },
  { keys: ['W'], label: 'help.scan' },
  { keys: ['B'], label: 'help.batch' },
  { keys: ['V'], label: 'help.visual' },
  { keys: ['X'], label: 'help.measure' },
  { keys: ['N'], label: 'help.notes' },
  { keys: ['C'], label: 'help.contrast' },
  { keys: ['O'], label: 'help.outlines' },
  { keys: ['P'], label: 'help.floating' },
  { keys: ['[', ']'], label: 'help.cycleFocus' },
  { keys: ['1…8'], label: 'help.focusNumber' },
  { keys: ['S'], label: 'help.capture' },
  { keys: ['T'], label: 'help.theme' },
  { keys: ['Esc'], label: 'help.escape' },
  { keys: ['Alt ←', 'Alt →'], label: 'help.history' },
  { keys: ['Space'], label: 'help.pan' },
  { keys: ['Ctrl/⌘'], label: 'help.wheelZoom' },
  { keys: ['?'], label: 'help.help' },
];

/** What this version brings, shown at the top of Help. */
const NEWS: MessageKey[] = ['news.score', 'news.notes', 'news.projects', 'news.languages'];

type Props = {
  open: boolean;
  /** "0.4.0": the news are this version's. */
  version?: string;
  onClose: () => void;
  /** Current bindings from chrome.commands (already formatted for the platform; users can change them). */
  commandShortcuts: { open: string; preview: string };
  /** "⌘K" or "Ctrl K". */
  paletteShortcut?: string;
  /** Starts the tour of the workspace (the button shows when given). */
  onTour?: () => void;
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

export function HelpDialog({
  open,
  version,
  onClose,
  commandShortcuts,
  paletteShortcut = 'Ctrl K',
  onTour,
  support,
}: Props) {
  const { t } = useI18n();

  return (
    <Dialog open={open} title={t('help.title')} icon="keyboard" onClose={onClose} width={760}>
      <div className={styles.columns}>
        <section aria-labelledby="help-workspace">
          <h3 id="help-workspace" className={styles.heading}>
            {t('help.shortcuts')}
          </h3>
          <dl className={styles.shortcuts}>
            {WORKSPACE_SHORTCUTS.map((shortcut) => (
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
          <p className={styles.note}>{t('help.shortcutsNote')}</p>
          {onTour && (
            <Button size="sm" icon="sparkle" className={styles.tour} onClick={onTour} data-testid="help-tour">
              {t('tour.start')}
            </Button>
          )}
        </section>
        <section aria-labelledby="help-global">
          {version && (
            <div className={styles.news} data-testid="whats-new">
              <h3 className={styles.heading}>
                {t('help.whatsNew', { version: version.split('.').slice(0, 2).join('.') })}
              </h3>
              <ul className={styles.tips}>
                {NEWS.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>
          )}
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
          <h3 id="help-global" className={styles.heading}>
            {t('help.global')}
          </h3>
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
          <h3 className={styles.heading}>{t('help.how')}</h3>
          <ul className={styles.tips}>
            <li>{t('help.how1')}</li>
            <li>{t('help.how2')}</li>
            <li>{t('help.how3')}</li>
            <li>{t('help.how4')}</li>
            <li>{t('help.how5')}</li>
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
