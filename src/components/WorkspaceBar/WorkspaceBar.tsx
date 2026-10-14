import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { BUILT_IN_GROUPS } from '../../data/groups';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { builtInGroupName } from '../../state/groups';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import { VISION_MODES, type VisionMode } from '../../state/vision';
import type { BreakpointSetId, ViewportConfig, ViewportGroup } from '../../types';
import { MAX_VIEWPORTS } from '../../utils/constants';
import { Icon, type IconName } from '../Icon/Icon';
import { Menu, type MenuEntry } from '../Menu/Menu';
import { Select } from '../Select/Select';
import styles from './WorkspaceBar.module.css';

export type ToolToggle = 'syncScroll' | 'syncNavigation' | 'checks' | 'outlines' | 'scrollbars' | 'grid';
export type ToolState = Record<ToolToggle, boolean> & { liveCss: boolean };

/** Simulations that run inside the previews (sites the user allowed). */
export type SimulateToggle = 'reduceMotion' | 'pauseAnimations' | 'pseudo' | 'rtl';
export type SimulateState = Record<SimulateToggle, boolean> & { vision: VisionMode };

export const VISION_KEYS: Record<VisionMode, MessageKey> = {
  none: 'vision.none',
  protanopia: 'vision.protanopia',
  deuteranopia: 'vision.deuteranopia',
  tritanopia: 'vision.tritanopia',
  achromatopsia: 'vision.achromatopsia',
  blurred: 'vision.blurred',
};

type Props = {
  viewports: ViewportConfig[];
  groups: ViewportGroup[];
  canAddViewport: boolean;
  breakpoints: BreakpointSetId;
  /** Breakpoints detected in the page (null: not known yet). */
  siteBreakpoints: number[] | null;
  showRulers: boolean;
  /** Scroll or navigation sync is on. */
  sync: boolean;
  showGrid: boolean;
  /** The inspector is open. */
  inspecting: boolean;
  measuring?: boolean;
  /** Comparing two addresses. */
  comparing?: boolean;
  tools: ToolState;
  /** The Simulate menu shows when this and its handlers are given. */
  simulate?: SimulateState;
  hasUrl: boolean;
  siteAllowed: boolean | null;
  host: string | null;
  /** The viewport shown on its own (focus mode). */
  focusedId: string | null;
  onToggleVisible: (id: string) => void;
  onMoveTo: (id: string, index: number) => void;
  onApplyGroup: (id: string) => void;
  onSaveGroup: () => void;
  onManageGroups: () => void;
  onAddViewport: () => void;
  onBreakpoints: (set: BreakpointSetId) => void;
  onRulers: (show: boolean) => void;
  onSync: (on: boolean) => void;
  onGrid: (show: boolean) => void;
  onInspect: () => void;
  onMeasure?: () => void;
  onContrast?: () => void;
  onCompare?: () => void;
  onStopCompare?: () => void;
  onVision?: (mode: VisionMode) => void;
  onSimulate?: (toggle: SimulateToggle) => void;
  onTool: (tool: ToolToggle) => void;
  onLiveCss: () => void;
  onEdges: () => void;
  onRotateAll: () => void;
  onSortByWidth: () => void;
  onReport: () => void;
  onAllowSite: () => void;
};

function Toggle({
  pressed,
  label,
  icon,
  tooltip,
  shortcut,
  onClick,
  testId,
}: {
  pressed: boolean;
  label: string;
  icon: IconName;
  tooltip: string;
  shortcut?: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={pressed}
      aria-label={label}
      data-tooltip={tooltip}
      data-shortcut={shortcut}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon name={icon} size={15} />
      <span className={styles.toggleLabel}>{label}</span>
    </button>
  );
}

function MenuButton({
  triggerProps,
  icon,
  label,
  tooltip,
  shortcut,
  extra,
  dataAttribute,
}: {
  triggerProps: object;
  icon: IconName;
  label: string;
  tooltip?: string;
  shortcut?: string;
  extra?: ReactNode;
  dataAttribute: Record<string, true>;
}) {
  return (
    <button
      type="button"
      {...triggerProps}
      {...dataAttribute}
      className={styles.menuButton}
      data-tooltip={tooltip}
      data-shortcut={shortcut}
    >
      <Icon name={icon} size={16} />
      <span className={styles.menuLabel}>{label}</span>
      {extra}
      <Icon name="chevronDown" size={13} className={styles.chevron} />
    </button>
  );
}

export function WorkspaceBar(props: Props) {
  const { viewports, breakpoints, showRulers, sync, showGrid } = props;
  const { t } = useI18n();
  const [dragId, setDragId] = useState<string | null>(null);
  /** Insertion slot while dragging: 0 = before the first chip, n = after the last. */
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  const onDragOver = (event: DragEvent<HTMLLIElement>, index: number) => {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    // Drop before or after this chip depending on which half the pointer is over.
    const rect = event.currentTarget.getBoundingClientRect();
    setDropSlot(index + (event.clientX > rect.left + rect.width / 2 ? 1 : 0));
  };

  const endDrag = () => {
    setDragId(null);
    setDropSlot(null);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const from = viewports.findIndex((vp) => vp.id === dragId);
    if (dragId && from >= 0 && dropSlot !== null) {
      // The slot counts the dragged chip itself; removing it first shifts later slots.
      const to = from < dropSlot ? dropSlot - 1 : dropSlot;
      if (to !== from) props.onMoveTo(dragId, to);
    }
    endDrag();
  };

  const dropMarker = (index: number): 'before' | 'after' | undefined => {
    if (dropSlot === null || !dragId) return undefined;
    if (dropSlot === index) return 'before';
    if (dropSlot === viewports.length && index === viewports.length - 1) return 'after';
    return undefined;
  };

  const onChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, vp: ViewportConfig, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
    if (target < 0 || target >= viewports.length) return;
    props.onMoveTo(vp.id, target);
    // Keep focus on the moved chip after re-render.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-chip-id="${vp.id}"]`)?.focus());
  };

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

  const toolToggle = (id: ToolToggle, label: MessageKey, description?: MessageKey): MenuEntry => ({
    id,
    label: t(label),
    description: description ? t(description) : undefined,
    checked: props.tools[id],
    onSelect: () => props.onTool(id),
  });
  // Measuring is a toggle in the bar (X), so it isn't repeated here.
  const utilityEntries: MenuEntry[] = [];
  if (props.onContrast)
    utilityEntries.push({
      id: 'contrast',
      label: t('tools.contrast'),
      icon: 'eyedropper',
      shortcut: 'C',
      onSelect: props.onContrast,
    });
  if (props.comparing && props.onStopCompare)
    utilityEntries.push({
      id: 'compare-stop',
      label: t('tools.compareStop'),
      icon: 'split',
      onSelect: props.onStopCompare,
    });
  else if (props.onCompare)
    utilityEntries.push({
      id: 'compare',
      label: t('tools.compare'),
      icon: 'split',
      disabled: !props.hasUrl,
      onSelect: props.onCompare,
    });
  if (utilityEntries.length)
    utilityEntries.unshift(
      { kind: 'separator', id: 'tools-sep-utilities' },
      { kind: 'heading', id: 'utilities', label: t('tools.utilities') },
    );

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
    { kind: 'heading', id: 'in-page', label: t('tools.inPage') },
    toolToggle('syncScroll', 'tools.syncScroll'),
    toolToggle('syncNavigation', 'tools.syncNavigation'),
    toolToggle('checks', 'tools.checks'),
    toolToggle('outlines', 'tools.outlines'),
    toolToggle('scrollbars', 'tools.scrollbars'),
    toolToggle('grid', 'tools.grid'),
    {
      id: 'liveCss',
      label: t('tools.liveCss'),
      icon: 'code',
      hint: props.tools.liveCss ? t('tools.on') : undefined,
      onSelect: props.onLiveCss,
    },
    { id: 'inspect', label: t('tools.inspect'), icon: 'inspect', shortcut: 'I', onSelect: props.onInspect },
    ...utilityEntries,
    { kind: 'separator', id: 'tools-sep1' },
    { kind: 'heading', id: 'arrange', label: t('tools.arrange') },
    { id: 'edges', label: t('tools.edges'), icon: 'ruler', onSelect: props.onEdges },
    { id: 'rotateAll', label: t('tools.rotateAll'), icon: 'rotate', onSelect: props.onRotateAll },
    { id: 'sortWidth', label: t('tools.sortByWidth'), icon: 'sort', onSelect: props.onSortByWidth },
    { kind: 'separator', id: 'tools-sep2' },
    { id: 'report', label: t('tools.report'), icon: 'report', disabled: !props.hasUrl, onSelect: props.onReport },
  ];

  const simulate = props.simulate;
  const simulateToggle = (id: SimulateToggle, label: MessageKey, description: MessageKey): MenuEntry => ({
    id,
    label: t(label),
    description: t(description),
    checked: Boolean(simulate?.[id]),
    onSelect: () => props.onSimulate?.(id),
  });
  const simulateEntries: MenuEntry[] = [
    ...(needsAccess
      ? ([
          { kind: 'note', id: 'simulate-note', label: t('simulate.accessNote') },
          {
            id: 'simulate-allow',
            label: t('tools.allowSite', { host: props.host ?? '' }),
            icon: 'shield',
            onSelect: props.onAllowSite,
          },
          { kind: 'separator', id: 'simulate-sep0' },
        ] satisfies MenuEntry[])
      : []),
    { kind: 'heading', id: 'vision', label: t('simulate.vision') },
    ...(['none', ...VISION_MODES] as VisionMode[]).map<MenuEntry>((mode) => ({
      id: `vision-${mode}`,
      label: t(VISION_KEYS[mode]),
      radio: true,
      checked: (simulate?.vision ?? 'none') === mode,
      onSelect: () => props.onVision?.(mode),
    })),
    { kind: 'note', id: 'vision-note', label: t('simulate.visionNote') },
    { kind: 'separator', id: 'simulate-sep1' },
    { kind: 'heading', id: 'preferences', label: t('simulate.preferences') },
    simulateToggle('reduceMotion', 'motion.reduce', 'motion.reduceHint'),
    simulateToggle('pauseAnimations', 'animations.pause', 'animations.pauseHint'),
    { kind: 'separator', id: 'simulate-sep2' },
    { kind: 'heading', id: 'stress', label: t('simulate.stress') },
    simulateToggle('pseudo', 'stress.pseudo', 'stress.pseudoHint'),
    simulateToggle('rtl', 'stress.rtl', 'stress.rtlHint'),
  ];
  const simulating = Boolean(
    simulate &&
    (simulate.vision !== 'none' ||
      simulate.reduceMotion ||
      simulate.pauseAnimations ||
      simulate.pseudo ||
      simulate.rtl),
  );

  const siteCount = props.siteBreakpoints?.length ?? 0;

  return (
    <div className={styles.bar}>
      <div className={styles.chipsArea}>
        <Menu
          label={t('toolbar.groups')}
          entries={groupEntries}
          minWidth={270}
          trigger={(triggerProps) => (
            <MenuButton
              triggerProps={triggerProps}
              icon="layers"
              label={t('toolbar.groups')}
              tooltip={t('toolbar.groupsHint')}
              shortcut="G"
              dataAttribute={{ 'data-groups-trigger': true }}
            />
          )}
        />
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.count}>
          <span aria-hidden="true">
            {viewports.length}/{MAX_VIEWPORTS}
          </span>
          <span className="visually-hidden">
            {t('workspace.countLabel', { count: viewports.length, max: MAX_VIEWPORTS })}
          </span>
        </span>
        <ul className={styles.chips} aria-label={t('workspace.viewports')}>
          {viewports.map((vp, index) => {
            const sizeClass = sizeClassOf(vp.width, vp.height);
            return (
              <li
                key={vp.id}
                className={styles.chipItem}
                data-drop={dropMarker(index)}
                onDragOver={(event) => onDragOver(event, index)}
                onDrop={onDrop}
              >
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={!vp.hidden}
                  aria-label={t('workspace.chipLabel', { name: vp.name, size: `${vp.width} × ${vp.height}` })}
                  data-tooltip={vp.hidden ? t('workspace.chipShow') : t('workspace.chipHint')}
                  data-chip-id={vp.id}
                  data-size-class={sizeClass}
                  data-focused={props.focusedId === vp.id || undefined}
                  data-testid="viewport-chip"
                  draggable
                  onDragStart={(event) => {
                    setDragId(vp.id);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', vp.id);
                  }}
                  onDragEnd={endDrag}
                  onClick={() => props.onToggleVisible(vp.id)}
                  onKeyDown={(event) => onChipKeyDown(event, vp, index)}
                >
                  <Icon
                    name={vp.hidden ? 'eyeOff' : SIZE_CLASS_ICONS[sizeClass]}
                    size={14}
                    className={styles.chipIcon}
                  />
                  <span className={styles.chipName}>{vp.name}</span>
                  <span className={styles.chipSize}>{vp.width}</span>
                  {vp.colorScheme && (
                    <Icon name={vp.colorScheme === 'dark' ? 'moon' : 'sun'} size={12} className={styles.chipScheme} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={styles.addButton}
          onClick={props.onAddViewport}
          disabled={!props.canAddViewport}
          aria-label={t('toolbar.addViewport')}
          data-tooltip={props.canAddViewport ? t('toolbar.addViewport') : t('add.limit', { max: MAX_VIEWPORTS })}
          data-shortcut="A"
          data-add-viewport
        >
          <Icon name="plus" size={15} />
          <span className={styles.addLabel}>{t('toolbar.addViewport')}</span>
        </button>
      </div>

      <div className={styles.controls}>
        <label className={styles.control}>
          <span className="visually-hidden">{t('workspace.breakpoints')}</span>
          <Select
            size="sm"
            icon="tag"
            value={breakpoints}
            aria-label={t('workspace.breakpoints')}
            data-tooltip={t('workspace.breakpointsHint')}
            onChange={(event) => props.onBreakpoints(event.target.value as BreakpointSetId)}
          >
            <option value="none">{t('breakpoints.noneLabel')}</option>
            <option value="tailwind">{t('breakpoints.tailwind')}</option>
            <option value="bootstrap">{t('breakpoints.bootstrap')}</option>
            <option value="custom">{t('breakpoints.custom')}</option>
            <option value="site">
              {siteCount ? t('breakpoints.siteCount', { count: siteCount }) : t('breakpoints.site')}
            </option>
          </Select>
        </label>

        <div className={styles.toggleGroup}>
          <Toggle
            pressed={showRulers}
            label={t('workspace.rulers')}
            icon="ruler"
            tooltip={t('workspace.rulersHint')}
            shortcut="M"
            onClick={() => props.onRulers(!showRulers)}
          />
          <Toggle
            pressed={showGrid}
            label={t('workspace.grid')}
            icon="columns"
            tooltip={t('workspace.gridHint')}
            onClick={() => props.onGrid(!showGrid)}
            testId="grid-toggle"
          />
          <Toggle
            pressed={sync}
            label={t('workspace.sync')}
            icon="link"
            tooltip={t('workspace.syncHint')}
            onClick={() => props.onSync(!sync)}
            testId="sync-toggle"
          />
          <Toggle
            pressed={props.inspecting}
            label={t('workspace.inspect')}
            icon="inspect"
            tooltip={t('workspace.inspectHint')}
            shortcut="I"
            onClick={props.onInspect}
            testId="inspect-toggle"
          />
          {props.onMeasure && (
            <Toggle
              pressed={Boolean(props.measuring)}
              label={t('workspace.measure')}
              icon="measure"
              tooltip={t('workspace.measureHint')}
              shortcut="X"
              onClick={props.onMeasure}
              testId="measure-toggle"
            />
          )}
        </div>

        {simulate && props.onVision && props.onSimulate && (
          <Menu
            label={t('toolbar.simulate')}
            entries={simulateEntries}
            align="end"
            minWidth={300}
            trigger={(triggerProps) => (
              <MenuButton
                triggerProps={triggerProps}
                icon="beaker"
                label={t('toolbar.simulate')}
                tooltip={t('simulate.hint')}
                extra={simulating ? <span className={styles.activeDot} aria-hidden="true" /> : undefined}
                dataAttribute={{ 'data-simulate-trigger': true }}
              />
            )}
          />
        )}

        <Menu
          label={t('toolbar.tools')}
          entries={toolEntries}
          align="end"
          minWidth={270}
          trigger={(triggerProps) => (
            <MenuButton
              triggerProps={triggerProps}
              icon="tools"
              label={t('toolbar.tools')}
              dataAttribute={{ 'data-tools-trigger': true }}
            />
          )}
        />
      </div>
    </div>
  );
}
