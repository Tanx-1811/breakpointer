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
import { shortHash } from '../utils/hash';
import { displayHost, parsePreviewUrl } from '../utils/url';
import { Button } from '../components/Button/Button';
import { Icon, Logo } from '../components/Icon/Icon';
import { Select } from '../components/Select/Select';
import styles from './Popup.module.css';

type Props = {
  settings: BreakpointerSettings;
  /** The active tab's URL when it can be previewed (http/https). */
  tabUrl: URL | null;
  /** The tab is a page Chrome never lets extensions show (Chrome Web Store). */
  restricted?: boolean;
  /** The popup was opened on the Breakpointer workspace itself. */
  inWorkspace?: boolean;
  /** Shortcut that opens this popup. */
  shortcut: string;
  /** Shortcut that previews the current tab directly. */
  previewShortcut?: string;
};

export function PopupApp(props: Props) {
  useTheme(props.settings.theme);
  return (
    <I18nProvider language={resolveLanguage(props.settings.language)}>
      <Popup {...props} />
    </I18nProvider>
  );
}

const AVATAR_COLORS = ['#4f46e5', '#0d9488', '#7c3aed', '#d97706', '#e11d48', '#0284c7', '#059669', '#c026d3'];

/** A coloured letter for a site, so pages are easy to tell apart at a glance. */
function SiteAvatar({ url, size = 'md' }: { url: string; size?: 'md' | 'sm' }) {
  let host = url;
  try {
    host = displayHost(new URL(url));
  } catch {
    // Keep the text as it is.
  }
  const color = AVATAR_COLORS[Number.parseInt(shortHash(host), 36) % AVATAR_COLORS.length];
  return (
    <span
      className={`${styles.avatar} ${size === 'sm' ? styles.avatarSmall : ''}`}
      // The letter is drawn by CSS so it isn't part of the button's text.
      data-letter={host.charAt(0).toUpperCase()}
      style={{ ['--avatar' as string]: color }}
      aria-hidden="true"
    />
  );
}

function Popup({ settings, tabUrl, restricted, inWorkspace, shortcut, previewShortcut }: Props) {
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

  const saved = settings.savedPages.slice(0, 4);
  const recent = settings.rememberRecent
    ? settings.recentUrls.filter((url) => !settings.savedPages.includes(url)).slice(0, 4)
    : [];
  const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className={styles.popup}>
      <header className={styles.header}>
        <Logo size={30} />
        <div className={styles.headerText}>
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
              <SiteAvatar url={tabUrl.href} />
              <div className={styles.pageText}>
                <span className={styles.host}>
                  {tabUrl.protocol === 'https:' && <Icon name="lock" size={12} className={styles.lock} />}
                  {displayHost(tabUrl)}
                </span>
                <span className={styles.url} title={tabUrl.href}>
                  {tabUrl.href}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              icon="arrowRight"
              className={styles.wide}
              onClick={() => void open(tabUrl.href)}
              autoFocus
            >
              {t('popup.previewThis')}
              {previewShortcut && <kbd className={styles.buttonKbd}>{previewShortcut}</kbd>}
            </Button>
          </>
        ) : (
          <p className={styles.muted}>
            <Icon name="info" size={15} className={styles.mutedIcon} />
            <span>
              {inWorkspace
                ? t('popup.inWorkspace')
                : restricted
                  ? t('popup.cannotPreviewStore')
                  : t('popup.cannotPreview')}
            </span>
          </p>
        )}
      </section>

      <div className={styles.field}>
        <label htmlFor={groupId} className={styles.label}>
          {t('popup.openWith')}
        </label>
        <Select id={groupId} wide icon="layers" value={group} onChange={(event) => setGroup(event.target.value)}>
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
        </Select>
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
          <Icon name="globe" size={15} className={styles.inputIcon} />
          <input
            id={inputId}
            className={`field ${styles.input}`}
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
          <button type="submit" className={styles.go} aria-label={t('address.submit')} title={t('address.submit')}>
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
        {error && (
          <p id={errorId} role="alert" className={styles.error}>
            {t(error)}
          </p>
        )}
      </form>

      {saved.length > 0 && (
        <section aria-labelledby="saved" className={styles.field}>
          <h2 id="saved" className={styles.label}>
            {t('popup.saved')}
          </h2>
          <ul className={styles.list} data-testid="popup-saved">
            {saved.map((url) => (
              <li key={url}>
                <button type="button" className={styles.item} onClick={() => void open(url)} title={url}>
                  <SiteAvatar url={url} size="sm" />
                  <span className={styles.itemText}>{shortUrl(url)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent" className={styles.field}>
          <h2 id="recent" className={styles.label}>
            {t('popup.recent')}
          </h2>
          <ul className={styles.list}>
            {recent.map((url) => (
              <li key={url}>
                <button type="button" className={styles.item} onClick={() => void open(url)} title={url}>
                  <SiteAvatar url={url} size="sm" />
                  <span className={styles.itemText}>{shortUrl(url)}</span>
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
