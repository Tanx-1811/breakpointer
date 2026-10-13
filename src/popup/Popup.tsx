import { useId, useState } from 'react';
import { BUILT_IN_GROUPS } from '../data/groups';
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { resolveLanguage } from '../i18n/translate';
import { openViewer } from '../shared/viewer-url';
import { builtInGroupName } from '../state/groups';
import type { BreakpointerSettings } from '../types';
import { URL_ERROR_KEYS } from '../i18n/url-errors';
import { displayHost, parsePreviewUrl } from '../utils/url';
import { Button } from '../components/Button/Button';
import { Icon, Logo } from '../components/Icon/Icon';
import styles from './Popup.module.css';

type Props = {
  settings: BreakpointerSettings;
  /** The active tab's URL when it can be previewed (http/https). */
  tabUrl: URL | null;
  /** The tab is a page Chrome never lets extensions show (Chrome Web Store). */
  restricted?: boolean;
  shortcut: string;
};

export function PopupApp(props: Props) {
  useTheme(props.settings.theme);
  return (
    <I18nProvider language={resolveLanguage(props.settings.language)}>
      <Popup {...props} />
    </I18nProvider>
  );
}

function Popup({ settings, tabUrl, restricted, shortcut }: Props) {
  const { t } = useI18n();
  const [address, setAddress] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [group, setGroup] = useState('');
  const inputId = useId();
  const groupId = useId();
  const errorId = useId();

  const open = async (url?: string) => {
    await openViewer({ url, group: group || undefined });
    window.close();
  };

  const submit = () => {
    const result = parsePreviewUrl(address);
    if (!result.ok) {
      setError(URL_ERROR_KEYS[result.error]);
      return;
    }
    void open(result.url.href);
  };

  const recent = settings.rememberRecent ? settings.recentUrls.slice(0, 4) : [];

  return (
    <div className={styles.popup}>
      <header className={styles.header}>
        <Logo size={28} />
        <div>
          <h1 className={styles.title}>Breakpointer</h1>
          <p className={styles.subtitle}>{t('welcome.title')}</p>
        </div>
      </header>

      <section className={styles.card} aria-labelledby="current-tab">
        <h2 id="current-tab" className={styles.label}>
          {t('popup.currentTab')}
        </h2>
        {tabUrl ? (
          <>
            <div className={styles.page}>
              <Icon name={tabUrl.protocol === 'https:' ? 'lock' : 'globe'} size={15} className={styles.pageIcon} />
              <div className={styles.pageText}>
                <span className={styles.host}>{displayHost(tabUrl)}</span>
                <span className={styles.url} title={tabUrl.href}>
                  {tabUrl.href}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              icon="arrowRight"
              className={styles.wide}
              onClick={() => void open(tabUrl.href)}
              autoFocus
            >
              {t('popup.previewThis')}
            </Button>
          </>
        ) : (
          <p className={styles.muted}>{restricted ? t('popup.cannotPreviewStore') : t('popup.cannotPreview')}</p>
        )}
      </section>

      <div className={styles.field}>
        <label htmlFor={groupId} className={styles.label}>
          {t('popup.openWith')}
        </label>
        <select id={groupId} className="field" value={group} onChange={(event) => setGroup(event.target.value)}>
          <option value="">
            {t('popup.openWithCurrent')} ({settings.viewports.length})
          </option>
          <optgroup label={t('groups.builtIn')}>
            {BUILT_IN_GROUPS.map((item) => (
              <option key={item.id} value={`builtin:${item.id}`}>
                {builtInGroupName(item, t)} ({item.viewports.length})
              </option>
            ))}
          </optgroup>
          {settings.groups.length > 0 && (
            <optgroup label={t('groups.yours')}>
              {settings.groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.viewports.length})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <form
        className={styles.field}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        <label htmlFor={inputId} className={styles.label}>
          {t('popup.another')}
        </label>
        <div className={styles.inputRow}>
          <input
            id={inputId}
            className="field"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('address.placeholder')}
            value={address}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setAddress(event.target.value);
              setError(null);
            }}
          />
          <Button type="submit" aria-label={t('address.submit')} title={t('address.submit')}>
            <Icon name="arrowRight" size={16} />
          </Button>
        </div>
        {error && (
          <p id={errorId} role="alert" className={styles.error}>
            {t(error)}
          </p>
        )}
      </form>

      {recent.length > 0 && (
        <section aria-labelledby="recent" className={styles.field}>
          <h2 id="recent" className={styles.label}>
            {t('popup.recent')}
          </h2>
          <ul className={styles.recent}>
            {recent.map((url) => (
              <li key={url}>
                <button type="button" className={styles.recentItem} onClick={() => void open(url)} title={url}>
                  <Icon name="globe" size={13} />
                  <span>{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.footer}>
        <Button variant="ghost" size="sm" icon="layers" onClick={() => void open()}>
          {t('popup.openWorkspace')}
        </Button>
        {shortcut && (
          <span className={styles.shortcut}>
            {t('popup.shortcut')} <kbd>{shortcut}</kbd>
          </span>
        )}
      </footer>
    </div>
  );
}
