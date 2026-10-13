import type { Ref } from 'react';
import { BUILT_IN_GROUPS } from '../data/groups';
import { useI18n } from '../i18n/I18nProvider';
import { builtInGroupName } from '../state/groups';
import type { ViewportGroup } from '../types';
import { Button, IconButton } from '../components/Button/Button';
import { AddressBar } from '../components/AddressBar/AddressBar';
import { Icon, Logo } from '../components/Icon/Icon';
import { Menu, type MenuEntry } from '../components/Menu/Menu';
import type { MessageKey } from '../i18n/en';
import styles from './Viewer.module.css';

type Props = {
  address: string;
  addressError: string | null;
  addressRef: Ref<HTMLInputElement>;
  recentUrls: string[];
  hasUrl: boolean;
  secure: boolean | null;
  siteAllowed: boolean | null;
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
  onToggleTheme: () => void;
  resolvedTheme: 'light' | 'dark';
  onSettings: () => void;
  onHelp: () => void;
  host: string | null;
  savedPages: string[];
  saved: boolean;
  onToggleSaved: () => void;
  tools: ToolState;
  onTool: (tool: ToolToggle) => void;
  onLiveCss: () => void;
  onEdges: () => void;
  onRotateAll: () => void;
  onReport: () => void;
  onAllowSite: () => void;
};

export type ToolToggle = 'syncScroll' | 'syncNavigation' | 'checks' | 'outlines' | 'grid';
export type ToolState = Record<ToolToggle, boolean> & { liveCss: boolean };

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

  const toolToggle = (id: ToolToggle, label: MessageKey): MenuEntry => ({
    id,
    label: t(label),
    checked: props.tools[id],
    onSelect: () => props.onTool(id),
  });
  // Everything but the grid runs inside the preview, so it needs the site's permission.
  const needsAccess = props.hasUrl && props.siteAllowed === false && props.host;
  const toolEntries: MenuEntry[] = [
    ...(needsAccess
      ? ([
          { kind: 'note', id: 'tools-note', label: t('tools.menuNote') },
          {
            id: 'tools-allow',
            label: t('tools.allowSite', { host: props.host ?? '' }),
            icon: 'shield',
            onSelect: props.onAllowSite,
          },
          { kind: 'separator', id: 'tools-sep0' },
        ] satisfies MenuEntry[])
      : []),
    toolToggle('syncScroll', 'tools.syncScroll'),
    toolToggle('syncNavigation', 'tools.syncNavigation'),
    toolToggle('checks', 'tools.checks'),
    toolToggle('outlines', 'tools.outlines'),
    toolToggle('grid', 'tools.grid'),
    { kind: 'separator', id: 'tools-sep1' },
    {
      id: 'liveCss',
      label: t('tools.liveCss'),
      icon: 'code',
      hint: props.tools.liveCss ? t('tools.on') : undefined,
      onSelect: props.onLiveCss,
    },
    { id: 'edges', label: t('tools.edges'), icon: 'ruler', onSelect: props.onEdges },
    { id: 'rotateAll', label: t('tools.rotateAll'), icon: 'rotate', onSelect: props.onRotateAll },
    { kind: 'separator', id: 'tools-sep2' },
    { id: 'report', label: t('tools.report'), icon: 'report', disabled: !props.hasUrl, onSelect: props.onReport },
  ];

  const themeLabel = props.resolvedTheme === 'dark' ? t('toolbar.themeToLight') : t('toolbar.themeToDark');

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <Logo size={26} />
        <span className={styles.brandName}>Breakpointer</span>
      </div>

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
          data-add-viewport
          onClick={props.onAddViewport}
          disabled={!props.canAddViewport}
          title={`${t('toolbar.addViewport')} (A)`}
        >
          <span className={styles.collapsible}>{t('toolbar.addViewport')}</span>
        </Button>
        <Menu
          label={t('toolbar.tools')}
          entries={toolEntries}
          align="end"
          minWidth={250}
          trigger={(triggerProps) => (
            <button
              type="button"
              {...triggerProps}
              className={styles.menuButton}
              data-tools-trigger
              title={t('toolbar.tools')}
            >
              <Icon name="tools" size={16} />
              <span className={styles.collapsible}>{t('toolbar.tools')}</span>
              <Icon name="chevronDown" size={14} />
            </button>
          )}
        />
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
        <IconButton
          icon={props.resolvedTheme === 'dark' ? 'sun' : 'moon'}
          label={`${themeLabel} (T)`}
          onClick={props.onToggleTheme}
        />
        <IconButton icon="settings" label={t('toolbar.settings')} onClick={props.onSettings} />
        <IconButton icon="help" label={`${t('toolbar.help')} (?)`} onClick={props.onHelp} />
      </div>
    </header>
  );
}
