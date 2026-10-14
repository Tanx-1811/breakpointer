import type { Ref } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { IconButton } from '../components/Button/Button';
import { AddressBar } from '../components/AddressBar/AddressBar';
import { Icon, Logo } from '../components/Icon/Icon';
import { Menu, type MenuEntry } from '../components/Menu/Menu';
import styles from './Viewer.module.css';

export type CaptureKind = 'workspace' | 'all' | 'copy';

type Props = {
  address: string;
  addressError: string | null;
  addressRef: Ref<HTMLInputElement>;
  recentUrls: string[];
  savedPages: string[];
  saved: boolean;
  onToggleSaved: () => void;
  hasUrl: boolean;
  secure: boolean | null;
  siteAllowed: boolean | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
  onReloadAll: () => void;
  onOpenInTab: () => void;
  onPalette: () => void;
  paletteShortcut: string;
  onCapture: (kind: CaptureKind) => void;
  onSiteAccess: () => void;
  onToggleTheme: () => void;
  resolvedTheme: 'light' | 'dark';
  onSettings: () => void;
  onHelp: () => void;
};

export function TopBar(props: Props) {
  const { t } = useI18n();
  const themeLabel = props.resolvedTheme === 'dark' ? t('toolbar.themeToLight') : t('toolbar.themeToDark');

  const captureEntries: MenuEntry[] = [
    {
      id: 'capture-workspace',
      label: t('capture.workspace'),
      description: t('capture.workspaceHint'),
      icon: 'camera',
      shortcut: 'S',
      onSelect: () => props.onCapture('workspace'),
    },
    {
      id: 'capture-all',
      label: t('capture.all'),
      description: t('capture.allHint'),
      icon: 'gallery',
      onSelect: () => props.onCapture('all'),
    },
    {
      id: 'capture-copy',
      label: t('capture.copy'),
      description: t('capture.copyHint'),
      icon: 'clipboard',
      onSelect: () => props.onCapture('copy'),
    },
  ];

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <Logo size={26} />
        <span className={styles.brandName}>Breakpointer</span>
      </div>

      <nav className={styles.navButtons} aria-label={t('nav.label')}>
        <IconButton
          icon="arrowLeft"
          size="sm"
          label={t('nav.back')}
          shortcut="Alt ←"
          onClick={props.onBack}
          disabled={!props.canGoBack}
        />
        <IconButton
          icon="arrowRight"
          size="sm"
          label={t('nav.forward')}
          shortcut="Alt →"
          onClick={props.onForward}
          disabled={!props.canGoForward}
        />
        <IconButton
          icon="reload"
          size="sm"
          label={t('address.reloadAll')}
          shortcut="R"
          onClick={props.onReloadAll}
          disabled={!props.hasUrl}
        />
      </nav>

      <div className={styles.addressArea}>
        <AddressBar
          value={props.address}
          error={props.addressError}
          recentUrls={props.recentUrls}
          savedPages={props.savedPages}
          saved={props.saved}
          canSave={props.hasUrl}
          onToggleSaved={props.onToggleSaved}
          secure={props.secure}
          inputRef={props.addressRef}
          onChange={props.onAddressChange}
          onSubmit={props.onSubmit}
        />
        <IconButton
          icon="external"
          size="sm"
          label={t('address.openInTab')}
          onClick={props.onOpenInTab}
          disabled={!props.hasUrl}
        />
      </div>

      <div className={styles.topActions}>
        <button
          type="button"
          className={styles.searchButton}
          onClick={props.onPalette}
          aria-label={t('palette.open')}
          data-tooltip={t('palette.open')}
          data-shortcut={props.paletteShortcut}
          data-palette-trigger
        >
          <Icon name="search" size={15} />
          <span className={styles.searchText}>{t('palette.button')}</span>
          <kbd className={styles.searchKbd}>{props.paletteShortcut}</kbd>
        </button>
        <Menu
          label={t('capture.menu')}
          entries={captureEntries}
          align="end"
          minWidth={300}
          trigger={(triggerProps) => (
            <button
              type="button"
              {...triggerProps}
              className={styles.splitIcon}
              aria-label={t('capture.menu')}
              data-tooltip={t('capture.menu')}
              disabled={!props.hasUrl}
            >
              <Icon name="camera" size={17} />
              <Icon name="chevronDown" size={12} className={styles.splitChevron} />
            </button>
          )}
        />
        <span className={styles.separator} aria-hidden="true" />
        <IconButton
          icon={props.siteAllowed ? 'shieldCheck' : 'shield'}
          label={
            props.hasUrl
              ? props.siteAllowed
                ? t('toolbar.siteAccessOn')
                : t('toolbar.siteAccessOff')
              : t('toolbar.siteAccess')
          }
          onClick={props.onSiteAccess}
          className={props.siteAllowed ? styles.accessOn : undefined}
        />
        <IconButton
          icon={props.resolvedTheme === 'dark' ? 'sun' : 'moon'}
          label={themeLabel}
          shortcut="T"
          onClick={props.onToggleTheme}
        />
        <IconButton icon="settings" label={t('toolbar.settings')} onClick={props.onSettings} />
        <IconButton icon="help" label={t('toolbar.help')} shortcut="?" onClick={props.onHelp} />
      </div>
    </header>
  );
}
