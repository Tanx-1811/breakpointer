import type { Ref } from 'react';
import { BUILT_IN_GROUPS } from '../data/groups';
import { useI18n } from '../i18n/I18nProvider';
import { builtInGroupName } from '../state/groups';
import type { ThemePreference, ViewportGroup } from '../types';
import { Button, IconButton } from '../components/Button/Button';
import { AddressBar } from '../components/AddressBar/AddressBar';
import { Icon, Logo, type IconName } from '../components/Icon/Icon';
import { Menu, type MenuEntry } from '../components/Menu/Menu';
import styles from './Viewer.module.css';

const THEME_ICONS: Record<ThemePreference, IconName> = { system: 'system', light: 'sun', dark: 'moon' };

type Props = {
  address: string;
  addressError: string | null;
  addressRef: Ref<HTMLInputElement>;
  recentUrls: string[];
  hasUrl: boolean;
  secure: boolean | null;
  siteAllowed: boolean | null;
  theme: ThemePreference;
  groups: ViewportGroup[];
  canAddViewport: boolean;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
  onReloadAll: () => void;
  onOpenInTab: () => void;
  onApplyGroup: (id: string) => void;
  onSaveGroup: () => void;
  onManageGroups: () => void;
  onAddViewport: () => void;
  onCapture: () => void;
  onSiteAccess: () => void;
  onCycleTheme: () => void;
  onSettings: () => void;
  onHelp: () => void;
};

export function TopBar(props: Props) {
  const { t } = useI18n();
  const groupEntries: MenuEntry[] = [
    { kind: 'heading', id: 'builtin', label: t('groups.builtIn') },
    ...BUILT_IN_GROUPS.map<MenuEntry>((group) => ({
      id: `builtin:${group.id}`,
      label: builtInGroupName(group, t),
      icon: 'layers',
      hint: String(group.viewports.length),
      onSelect: () => props.onApplyGroup(`builtin:${group.id}`),
    })),
    { kind: 'separator', id: 'sep1' },
    { kind: 'heading', id: 'yours', label: t('groups.yours') },
    ...(props.groups.length
      ? props.groups.map<MenuEntry>((group) => ({
          id: group.id,
          label: group.name,
          icon: 'layers',
          hint: String(group.viewports.length),
          onSelect: () => props.onApplyGroup(group.id),
        }))
      : [{ kind: 'note', id: 'none', label: t('groups.empty') } satisfies MenuEntry]),
    { kind: 'separator', id: 'sep2' },
    { id: 'save', label: t('groups.save'), icon: 'save', onSelect: props.onSaveGroup },
    {
      id: 'manage',
      label: t('groups.manage'),
      icon: 'settings',
      disabled: props.groups.length === 0,
      onSelect: props.onManageGroups,
    },
  ];

  const themeLabel = t('toolbar.theme', { theme: t(`theme.${props.theme}`) });

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <Logo size={26} />
        <span className={styles.brandName}>ViewportLab</span>
      </div>

      <div className={styles.addressArea}>
        <AddressBar
          value={props.address}
          error={props.addressError}
          recentUrls={props.recentUrls}
          secure={props.secure}
          inputRef={props.addressRef}
          onChange={props.onAddressChange}
          onSubmit={props.onSubmit}
        />
        <IconButton
          icon="reload"
          label={`${t('address.reloadAll')} (R)`}
          onClick={props.onReloadAll}
          disabled={!props.hasUrl}
        />
        <IconButton
          icon="external"
          label={t('address.openInTab')}
          onClick={props.onOpenInTab}
          disabled={!props.hasUrl}
        />
      </div>

      <div className={styles.topActions}>
        <Menu
          label={t('toolbar.groups')}
          entries={groupEntries}
          minWidth={260}
          trigger={(triggerProps) => (
            <button
              type="button"
              {...triggerProps}
              className={styles.menuButton}
              data-groups-trigger
              title={`${t('toolbar.groups')} (G)`}
            >
              <Icon name="layers" size={16} />
              <span className={styles.collapsible}>{t('toolbar.groups')}</span>
              <Icon name="chevronDown" size={14} />
            </button>
          )}
        />
        <Button
          icon="plus"
          onClick={props.onAddViewport}
          disabled={!props.canAddViewport}
          title={`${t('toolbar.addViewport')} (A)`}
        >
          <span className={styles.collapsible}>{t('toolbar.addViewport')}</span>
        </Button>
        <span className={styles.separator} aria-hidden="true" />
        <IconButton
          icon="camera"
          label={`${t('toolbar.capture')} (S)`}
          onClick={props.onCapture}
          disabled={!props.hasUrl}
        />
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
        <IconButton icon={THEME_ICONS[props.theme]} label={`${themeLabel} (T)`} onClick={props.onCycleTheme} />
        <IconButton icon="settings" label={t('toolbar.settings')} onClick={props.onSettings} />
        <IconButton icon="help" label={`${t('toolbar.help')} (?)`} onClick={props.onHelp} />
      </div>
    </header>
  );
}
