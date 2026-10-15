import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, IconButton } from '../components/Button/Button';
import { Logo } from '../components/Icon/Icon';
import { ALLOW, SANDBOX } from '../components/PreviewFrame/PreviewFrame';
import { Select } from '../components/Select/Select';
import { PRESETS, findPreset } from '../data/presets';
import { useTheme } from '../hooks/useTheme';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import { resolveLanguage } from '../i18n/translate';
import { URL_ERROR_KEYS } from '../i18n/url-errors';
import { DEFAULT_SIDE_PANEL, updateStoredSettings } from '../services/storage';
import { openViewer } from '../shared/viewer-url';
import type { BreakpointerSettings, SidePanelSettings } from '../types';
import { parsePreviewUrl, toSafeHref } from '../utils/url';
import styles from './SidePanel.module.css';

/** Space around the preview inside the panel, in CSS pixels. */
const PADDING = 12;

/** The page in the active tab of the last focused window, when Breakpointer may read it (sites you allowed). */
export async function activeTabUrl(): Promise<string | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  return toSafeHref(tab?.url);
}

/** The zoom at which a viewport fits the panel's width. */
export function panelZoom(viewportWidth: number, panelWidth: number): number {
  return Math.max(0.1, Math.min(1, (panelWidth - PADDING * 2) / viewportWidth));
}

type Props = {
  settings: BreakpointerSettings;
  /** A page sent from the popup or the context menu, or the active tab's. */
  initialUrl: string | null;
};

export function SidePanelApp(props: Props) {
  useTheme(props.settings.theme);
  return (
    <I18nProvider language={resolveLanguage(props.settings.language)}>
      <SidePanel {...props} />
    </I18nProvider>
  );
}

/**
 * Chrome's side panel: the page you're browsing at a phone (or any preset)
 * size, right next to it. It follows the active tab on sites you allowed.
 */
function SidePanel({ settings, initialUrl }: Props) {
  const { t } = useI18n();
  const [url, setUrl] = useState(initialUrl);
  const [address, setAddress] = useState(initialUrl ?? '');
  const [error, setError] = useState<MessageKey | null>(null);
  const [size, setSize] = useState<SidePanelSettings>(settings.sidePanel);
  const [follow, setFollow] = useState(true);
  const [reloads, setReloads] = useState(0);
  const [panelWidth, setPanelWidth] = useState(window.innerWidth);
  const addressId = useId();
  const sizeId = useId();
  const errorId = useId();

  useEffect(() => {
    const onResize = () => setPanelWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Follow the page in the active tab as you browse.
  useEffect(() => {
    if (!follow) return;
    const check = () =>
      void activeTabUrl().then((href) => {
        if (!href) return;
        setUrl(href);
        setAddress(href);
        setError(null);
      });
    const onUpdated = (_tabId: number, change: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && change.url) check();
    };
    chrome.tabs.onActivated.addListener(check);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows.onFocusChanged.addListener(check);
    return () => {
      chrome.tabs.onActivated.removeListener(check);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows.onFocusChanged.removeListener(check);
    };
  }, [follow]);

  const changeSize = (next: SidePanelSettings) => {
    setSize(next);
    void updateStoredSettings((current) => ({ ...current, sidePanel: next })).catch(() => {});
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = parsePreviewUrl(address);
    if (!result.ok) {
      setError(URL_ERROR_KEYS[result.error]);
      return;
    }
    // An address typed here stays until you follow the tab again.
    setFollow(false);
    setError(null);
    setUrl(result.url.href);
    setAddress(result.url.href);
  };

  const preset = findPreset(size.preset) ?? findPreset(DEFAULT_SIDE_PANEL.preset)!;
  const width = size.landscape ? preset.height : preset.width;
  const height = size.landscape ? preset.width : preset.height;
  const zoom = panelZoom(width, panelWidth);
  const name = t(`preset.${preset.id}` as MessageKey);

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <Logo size={22} />
        <span className={styles.brand}>Breakpointer</span>
        <IconButton
          icon="reload"
          size="sm"
          label={t('sidepanel.reload')}
          onClick={() => setReloads((count) => count + 1)}
          disabled={!url}
        />
        <IconButton
          icon="external"
          size="sm"
          label={t('sidepanel.workspace')}
          onClick={() => void openViewer(url ? { url } : {})}
          data-testid="sidepanel-workspace"
        />
      </header>

      <form className={styles.address} onSubmit={submit} noValidate>
        <label className="visually-hidden" htmlFor={addressId}>
          {t('address.label')}
        </label>
        <input
          id={addressId}
          className={`field ${styles.input}`}
          value={address}
          placeholder={t('address.placeholder')}
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setAddress(event.target.value);
            setError(null);
          }}
        />
        <Button type="submit" size="sm" variant="primary">
          {t('sidepanel.go')}
        </Button>
      </form>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {t(error)}
        </p>
      )}

      <div className={styles.controls}>
        <label htmlFor={sizeId} className="visually-hidden">
          {t('sidepanel.size')}
        </label>
        <Select
          id={sizeId}
          size="sm"
          className={styles.size}
          value={preset.id}
          onChange={(event) => changeSize({ ...size, preset: event.target.value })}
        >
          {PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {t(`preset.${item.id}` as MessageKey)} · {item.width}×{item.height}
            </option>
          ))}
        </Select>
        <IconButton
          icon="rotate"
          size="sm"
          label={t('sidepanel.rotate')}
          pressed={size.landscape}
          onClick={() => changeSize({ ...size, landscape: !size.landscape })}
        />
        <span className={styles.zoom} data-testid="sidepanel-size">
          {width}×{height} · {Math.round(zoom * 100)}%
        </span>
      </div>
      <label className={styles.follow}>
        <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} />
        <span>
          {t('sidepanel.follow')}
          <span className={styles.followHint}>{t('sidepanel.followHint')}</span>
        </span>
      </label>

      <div className={styles.stage}>
        {url ? (
          <div className={styles.viewport} style={{ width: width * zoom, height: height * zoom }}>
            <iframe
              key={`${url}#${reloads}`}
              className={styles.frame}
              src={url}
              title={t('frame.title', { name, width, height })}
              width={width}
              height={height}
              style={{ width, height, transform: `scale(${zoom})` }}
              sandbox={SANDBOX}
              allow={ALLOW}
              referrerPolicy="strict-origin-when-cross-origin"
              data-testid="sidepanel-frame"
            />
          </div>
        ) : (
          <p className={styles.empty}>{t('sidepanel.empty')}</p>
        )}
      </div>
    </div>
  );
}
