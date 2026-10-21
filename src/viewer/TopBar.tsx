import type { Ref } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { IconButton } from '../components/Button/Button';
import { AddressBar } from '../components/AddressBar/AddressBar';
import { Icon, Logo } from '../components/Icon/Icon';
import { Menu, type MenuEntry } from '../components/Menu/Menu';
import type { Entitlement } from '../state/license';
import styles from './Viewer.module.css';

export type CaptureKind = 'workspace' | 'all' | 'copy' | 'showcase';

/** Seconds between automatic reloads offered (0: off). */
export const AUTO_RELOAD_OPTIONS = [0, 5, 10, 30, 60] as const;

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
  /** Submits the typed address, or a suggestion picked from the list. */
  onSubmit: (value?: string) => void;
  onReloadAll: () => void;
  /** Reload every this many seconds (0: off); the options show when the handler is given. */
  autoReload?: number;
  onAutoReload?: (seconds: number) => void;
  onOpenInTab: () => void;
  /** Opens every viewport as a real window of its size. */
  onOpenWindows?: () => void;
  /** Opens the always-on-top floating preview. */
  onFloating?: () => void;
  onPalette: () => void;
  paletteShortcut: string;
  onCapture: (kind: CaptureKind) => void;
  onSiteAccess: () => void;
  onToggleTheme: () => void;
  resolvedTheme: 'light' | 'dark';
  onSettings: () => void;
  onHelp: () => void;
  /** This version has news the user hasn't seen: the Help button shows a dot. */
  helpNews?: boolean;
  /** The plan: on the free plan a "Get Pro" button shows, during the trial the days left (shown when given). */
  entitlement?: Entitlement;
  onPro?: () => void;
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
    { kind: 'separator', id: 'capture-sep' },
    {
      id: 'capture-showcase',
      label: t('capture.showcase'),
      description: t('capture.showcaseHint'),
      icon: 'devices',
      onSelect: () => props.onCapture('showcase'),
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
        {props.onAutoReload && (
          <Menu
            label={t('reload.menu')}
            entries={[
              { kind: 'heading', id: 'reload-auto', label: t('reload.auto') },
              ...AUTO_RELOAD_OPTIONS.map<MenuEntry>((seconds) => ({
                id: `reload-${seconds}`,
                label: seconds === 0 ? t('reload.off') : t('reload.every', { seconds }),
                radio: true,
                checked: (props.autoReload ?? 0) === seconds,
                onSelect: () => props.onAutoReload?.(seconds),
              })),
              { kind: 'note', id: 'reload-note', label: t('reload.note') },
            ]}
            minWidth={250}
            trigger={(triggerProps) => (
              <button
                type="button"
                {...triggerProps}
                className={styles.menuChevron}
                aria-label={t('reload.menu')}
                data-tooltip={t('reload.menu')}
                data-active={props.autoReload ? true : undefined}
                data-testid="reload-menu"
                disabled={!props.hasUrl}
              >
                <Icon name="chevronDown" size={12} />
              </button>
            )}
          />
        )}
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
        {props.onOpenWindows && (
          <IconButton
            icon="window"
            size="sm"
            label={t('windows.open')}
            onClick={props.onOpenWindows}
            disabled={!props.hasUrl}
            data-testid="open-windows"
          />
        )}
        {props.onFloating && (
          <IconButton
            icon="pip"
            size="sm"
            label={t('floating.open')}
            shortcut="P"
            onClick={props.onFloating}
            data-testid="open-floating"
          />
        )}
      </div>

      <div className={styles.topActions}>
        {props.entitlement && props.onPro && <ProButton entitlement={props.entitlement} onClick={props.onPro} />}
        <button
          type="button"
          className={styles.searchButton}
          onClick={props.onPalette}
          // The name is what the button shows ("Search… ⌘K", WCAG 2.5.3); what it searches is its description.
          aria-label={`${t('palette.button')} ${props.paletteShortcut}`}
          aria-description={t('palette.open')}
          data-tooltip={t('palette.open')}
          data-shortcut={props.paletteShortcut}
          data-palette-trigger
        >
          <Icon name="search" size={15} />
          <span className={styles.searchText}>{t('palette.button')}</span>
          <kbd className={styles.searchKbd} aria-hidden="true">
            {props.paletteShortcut}
          </kbd>
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
        <IconButton
          icon="help"
          label={props.helpNews ? t('toolbar.helpNews') : t('toolbar.help')}
          shortcut="?"
          onClick={props.onHelp}
          className={props.helpNews ? styles.news : undefined}
          data-testid="help-button"
        />
      </div>
    </header>
  );
}

/** "Get Pro" on the free plan; "Pro trial" and the days left during the trial; nothing with a licence. */
function ProButton({ entitlement, onClick }: { entitlement: Entitlement; onClick: () => void }) {
  const { t } = useI18n();
  if (entitlement.source === 'license') return null;
  const trial = entitlement.trial.status === 'active' ? entitlement.trial : null;
  const label = trial
    ? trial.daysLeft === 1
      ? t('pro.buttonTrialLabelOne')
      : t('pro.buttonTrialLabel', { days: trial.daysLeft })
    : t('pro.button');
  return (
    <button
      type="button"
      className={styles.proButton}
      onClick={onClick}
      aria-label={label}
      data-tooltip={t('pro.buttonHint')}
      data-testid="pro-button"
    >
      <Icon name="sparkle" size={15} />
      <span className={styles.proLabel}>{trial ? t('pro.buttonTrial') : t('pro.button')}</span>
      {trial && (
        <span className={styles.proDays} aria-hidden="true">
          {trial.daysLeft}
        </span>
      )}
    </button>
  );
}
