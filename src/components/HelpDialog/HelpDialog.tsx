import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { OMNIBOX_KEYWORD } from '../../utils/constants';
import { Dialog } from '../Dialog/Dialog';
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
  { keys: ['X'], label: 'help.measure' },
  { keys: ['C'], label: 'help.contrast' },
  { keys: ['O'], label: 'help.outlines' },
  { keys: ['P'], label: 'help.floating' },
  { keys: ['[', ']'], label: 'help.cycleFocus' },
  { keys: ['S'], label: 'help.capture' },
  { keys: ['T'], label: 'help.theme' },
  { keys: ['Esc'], label: 'help.escape' },
  { keys: ['Alt ←', 'Alt →'], label: 'help.history' },
  { keys: ['Space'], label: 'help.pan' },
  { keys: ['Ctrl/⌘'], label: 'help.wheelZoom' },
  { keys: ['?'], label: 'help.help' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Current bindings from chrome.commands (already formatted for the platform; users can change them). */
  commandShortcuts: { open: string; preview: string };
  /** "⌘K" or "Ctrl K". */
  paletteShortcut?: string;
};

export function HelpDialog({ open, onClose, commandShortcuts, paletteShortcut = 'Ctrl K' }: Props) {
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
        </section>
        <section aria-labelledby="help-global">
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
