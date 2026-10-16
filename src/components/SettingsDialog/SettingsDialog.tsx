import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CHECK_KINDS, type CheckKind } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { CHECK_KIND_KEYS } from '../../state/checks';
import type {
  Breakpoint,
  BreakpointSetId,
  BreakpointerSettings,
  GridColumns,
  GridSettings,
  LanguagePreference,
  SyncSettings,
  ThemePreference,
} from '../../types';
import {
  BASELINE_OPTIONS,
  GRID_COLUMN_OPTIONS,
  MAX_CUSTOM_BREAKPOINTS,
  MAX_GRID_SPACING,
  MAX_RECENT_URLS,
} from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { BreakpointEditor } from './BreakpointEditor';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import { Select } from '../Select/Select';
import { Switch } from '../Switch/Switch';
import styles from './SettingsDialog.module.css';

type Props = {
  open: boolean;
  settings: BreakpointerSettings;
  version: string;
  /** Breakpoints found in the previewed page (null: unknown). */
  siteBreakpoints: number[] | null;
  onTheme: (theme: ThemePreference) => void;
  onLanguage: (language: LanguagePreference) => void;
  onBreakpoints: (set: BreakpointSetId) => void;
  onCustomBreakpoints: (breakpoints: Breakpoint[]) => void;
  onSync: (sync: Partial<SyncSettings>) => void;
  onChecks: (on: boolean) => void;
  /** Switches one kind of check on or off (the list shows when given). */
  onCheckKind?: (kind: CheckKind, enabled: boolean) => void;
  onGrid: (grid: Partial<GridSettings>) => void;
  onOpenSaved: (url: string) => void;
  onRemoveSaved: (url: string) => void;
  onRulers: (show: boolean) => void;
  onEmbedHints: (show: boolean) => void;
  onRememberRecent: (remember: boolean) => void;
  onClearRecent: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
  onManageAccess: () => void;
  onOpenShortcuts: () => void;
  onClose: () => void;
};

type SectionId = 'appearance' | 'workspace' | 'tools' | 'pages' | 'data' | 'privacy';

const SECTIONS: { id: SectionId; title: MessageKey; icon: IconName }[] = [
  { id: 'appearance', title: 'settings.appearance', icon: 'sun' },
  { id: 'workspace', title: 'settings.workspace', icon: 'wrap' },
  { id: 'tools', title: 'settings.tools', icon: 'tools' },
  { id: 'pages', title: 'settings.savedPages', icon: 'star' },
  { id: 'data', title: 'settings.data', icon: 'download' },
  { id: 'privacy', title: 'settings.privacy', icon: 'shield' },
];

function Section({ id, title, icon, children }: { id: SectionId; title: string; icon: IconName; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId} data-section={id}>
      <h3 id={headingId} className={styles.heading}>
        <Icon name={icon} size={15} className={styles.headingIcon} />
        {title}
      </h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.row} role="group" aria-labelledby={id}>
      <div className={styles.rowText}>
        <span id={id} className={styles.rowLabel}>
          {label}
        </span>
        {help && <span className={styles.rowHelp}>{help}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export function SettingsDialog(props: Props) {
  const { open, onClose } = props;
  const { t } = useI18n();
  return (
    <Dialog open={open} title={t('settings.title')} icon="settings" onClose={onClose} width={780} flush>
      <SettingsBody {...props} />
    </Dialog>
  );
}

function SettingsBody(props: Props) {
  const { settings, version } = props;
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const customId = useId();
  const [active, setActive] = useState<SectionId>('appearance');
  // Bumped when the custom list is replaced from outside the editor, so it starts over.
  const [editorKey, setEditorKey] = useState(0);

  // Highlight the section being read.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const onScroll = () => {
      const top = content.getBoundingClientRect().top;
      let current: SectionId = 'appearance';
      for (const section of content.querySelectorAll<HTMLElement>('[data-section]')) {
        if (section.getBoundingClientRect().top - top < 80) current = section.dataset.section as SectionId;
      }
      // At the very bottom, the last section is the one being read.
      if (content.scrollTop + content.clientHeight >= content.scrollHeight - 4) current = 'privacy';
      setActive(current);
    };
    content.addEventListener('scroll', onScroll, { passive: true });
    return () => content.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (id: SectionId) => {
    setActive(id);
    contentRef.current
      ?.querySelector<HTMLElement>(`[data-section="${id}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const site = props.siteBreakpoints ?? [];

  return (
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label={t('settings.sections')}>
        <ul className={styles.navList}>
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className={styles.navItem}
                aria-current={active === section.id ? 'true' : undefined}
                onClick={() => goTo(section.id)}
              >
                <Icon name={section.icon} size={15} />
                {t(section.title)}
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.version}>{t('settings.version', { version })}</p>
      </nav>

      <div ref={contentRef} className={styles.content}>
        <Section id="appearance" title={t('settings.appearance')} icon="sun">
          <Row label={t('settings.theme')}>
            <Segmented
              label={t('settings.theme')}
              value={settings.theme}
              onChange={props.onTheme}
              size="sm"
              options={[
                { value: 'system', label: t('theme.system'), icon: 'system' },
                { value: 'light', label: t('theme.light'), icon: 'sun' },
                { value: 'dark', label: t('theme.dark'), icon: 'moon' },
              ]}
            />
          </Row>
          <Row label={t('settings.language')}>
            <Select
              size="sm"
              aria-label={t('settings.language')}
              value={settings.language}
              onChange={(event) => props.onLanguage(event.target.value as LanguagePreference)}
            >
              <option value="auto">{t('language.auto')}</option>
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </Select>
          </Row>
        </Section>

        <Section id="workspace" title={t('settings.workspace')} icon="wrap">
          <Row label={t('settings.breakpoints')} help={t('settings.breakpointsHelp')}>
            <Select
              size="sm"
              aria-label={t('settings.breakpoints')}
              value={settings.breakpoints}
              onChange={(event) => props.onBreakpoints(event.target.value as BreakpointSetId)}
            >
              <option value="none">{t('breakpoints.none')}</option>
              <option value="tailwind">{t('breakpoints.tailwind')}</option>
              <option value="bootstrap">{t('breakpoints.bootstrap')}</option>
              <option value="custom">{t('breakpoints.custom')}</option>
              <option value="site">{t('breakpoints.site')}</option>
            </Select>
          </Row>
          {settings.breakpoints === 'site' && (
            <p className={styles.note}>
              <Icon name="scan" size={15} />
              <span>
                {site.length
                  ? t('settings.siteBreakpointsFound', { list: site.join(', ') })
                  : t('settings.siteBreakpointsHelp')}
              </span>
            </p>
          )}
          {settings.breakpoints === 'custom' && (
            <div className={styles.subsection} role="group" aria-labelledby={customId}>
              <div className={styles.subsectionHead}>
                <div className={styles.rowText}>
                  <span id={customId} className={styles.rowLabel}>
                    {t('settings.customBreakpoints')}
                  </span>
                  <span className={styles.rowHelp}>{t('settings.customBreakpointsHelp')}</span>
                </div>
                {site.length > 0 && (
                  <Button
                    size="sm"
                    icon="scan"
                    onClick={() => {
                      props.onCustomBreakpoints(
                        site.slice(0, MAX_CUSTOM_BREAKPOINTS).map((min) => ({ name: String(min), min })),
                      );
                      setEditorKey((key) => key + 1);
                    }}
                  >
                    {t('settings.useSiteBreakpoints')}
                  </Button>
                )}
              </div>
              <BreakpointEditor
                key={editorKey}
                breakpoints={settings.customBreakpoints}
                onChange={props.onCustomBreakpoints}
              />
            </div>
          )}
          <Switch
            checked={settings.showRulers}
            onChange={props.onRulers}
            label={t('settings.rulers')}
            description={t('settings.rulersHelp')}
          />
          <Switch
            checked={settings.embedHints}
            onChange={props.onEmbedHints}
            label={t('settings.embedHints')}
            description={t('settings.embedHintsHelp')}
          />
          <Switch
            checked={settings.rememberRecent}
            onChange={props.onRememberRecent}
            label={t('settings.recent')}
            description={t('settings.recentHelp', { max: MAX_RECENT_URLS })}
          />
          {settings.rememberRecent && settings.recentUrls.length > 0 && (
            <div>
              <Button size="sm" variant="ghost" icon="trash" onClick={props.onClearRecent}>
                {t('settings.clearRecent')}
              </Button>
            </div>
          )}
        </Section>

        <Section id="tools" title={t('settings.tools')} icon="tools">
          <p className={styles.help}>{t('settings.toolsHelp')}</p>
          <Switch
            checked={settings.sync.scroll}
            onChange={(scroll) => props.onSync({ scroll })}
            label={t('tools.syncScroll')}
            description={t('settings.syncScrollHelp')}
          />
          <Switch
            checked={settings.sync.navigation}
            onChange={(navigation) => props.onSync({ navigation })}
            label={t('tools.syncNavigation')}
            description={t('settings.syncNavigationHelp')}
          />
          <Switch
            checked={settings.checks}
            onChange={props.onChecks}
            label={t('tools.checks')}
            description={t('settings.checksHelp')}
          />
          {settings.checks && props.onCheckKind && (
            <fieldset className={styles.checkKinds} data-testid="check-kinds">
              <legend className={styles.checkKindsLegend}>{t('settings.checkKinds')}</legend>
              {CHECK_KINDS.map((kind) => (
                <label key={kind} className={styles.checkKind}>
                  <input
                    type="checkbox"
                    checked={!settings.disabledChecks.includes(kind)}
                    onChange={(event) => props.onCheckKind?.(kind, event.target.checked)}
                  />
                  <span>{t(CHECK_KIND_KEYS[kind])}</span>
                </label>
              ))}
            </fieldset>
          )}
          <Switch
            checked={settings.grid.show}
            onChange={(show) => props.onGrid({ show })}
            label={t('settings.grid')}
            description={t('settings.gridHelp')}
          />
          <div className={styles.gridOptions}>
            <label className={styles.inlineField}>
              <span>{t('settings.gridColumns')}</span>
              <Select
                size="sm"
                value={String(settings.grid.columns)}
                onChange={(event) => {
                  const value = event.target.value;
                  props.onGrid({ columns: (value === 'auto' ? 'auto' : Number(value)) as GridColumns });
                }}
              >
                {GRID_COLUMN_OPTIONS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option === 'auto' ? t('settings.gridAuto') : option}
                  </option>
                ))}
              </Select>
            </label>
            <NumberField
              label={t('settings.gridGutter')}
              value={settings.grid.gutter}
              max={MAX_GRID_SPACING}
              onCommit={(gutter) => props.onGrid({ gutter })}
            />
            <NumberField
              label={t('settings.gridMargin')}
              value={settings.grid.margin}
              max={MAX_GRID_SPACING}
              onCommit={(margin) => props.onGrid({ margin })}
            />
            <label className={styles.inlineField}>
              <span>{t('settings.gridBaseline')}</span>
              <Select
                size="sm"
                value={String(settings.grid.baseline)}
                onChange={(event) => props.onGrid({ baseline: Number(event.target.value) })}
              >
                {BASELINE_OPTIONS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option === 0 ? t('settings.gridBaselineOff') : `${option}px`}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </Section>

        <Section id="pages" title={t('settings.savedPages')} icon="star">
          <p className={styles.help}>{t('settings.savedPagesHelp')}</p>
          {settings.savedPages.length === 0 ? (
            <p className={styles.empty}>{t('settings.savedPagesEmpty')}</p>
          ) : (
            <ul className={styles.savedList} data-testid="saved-pages">
              {settings.savedPages.map((url) => (
                <li key={url} className={styles.savedRow}>
                  <Icon name="star" size={14} className={styles.savedIcon} />
                  <span className={styles.savedUrl} title={url}>
                    {url}
                  </span>
                  <Button
                    size="sm"
                    icon="arrowRight"
                    onClick={() => props.onOpenSaved(url)}
                    aria-label={t('settings.openSavedLabel', { url })}
                  >
                    {t('settings.openSaved')}
                  </Button>
                  <IconButton
                    icon="trash"
                    size="sm"
                    tone="danger"
                    label={t('settings.removeSaved', { url })}
                    onClick={() => props.onRemoveSaved(url)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="data" title={t('settings.data')} icon="download">
          <p className={styles.help}>{t('settings.dataHelp')}</p>
          <div className={styles.buttons}>
            <Button size="sm" icon="download" onClick={props.onExport}>
              {t('settings.export')}
            </Button>
            <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()}>
              {t('settings.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) props.onImport(file);
                event.target.value = '';
              }}
              data-testid="import-input"
            />
          </div>
          <Row label={t('settings.reset')} help={t('settings.resetHelp')}>
            <Button size="sm" variant="danger" icon="reset" onClick={props.onReset}>
              {t('settings.resetButton')}
            </Button>
          </Row>
        </Section>

        <Section id="privacy" title={t('settings.privacy')} icon="shield">
          <p className={styles.help}>{t('settings.privacyBody')}</p>
          <div className={styles.buttons}>
            <Button size="sm" icon="shield" onClick={props.onManageAccess}>
              {t('settings.manageAccess')}
            </Button>
            <Button size="sm" icon="keyboard" onClick={props.onOpenShortcuts}>
              {t('settings.shortcuts')}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

/** A whole number from 0 to `max`, saved on blur or Enter (empty or invalid input goes back). */
function NumberField({
  label,
  value,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const number = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(number)) return;
    const next = Math.min(max, Math.max(0, Math.round(number)));
    if (next !== value) onCommit(next);
  };
  return (
    <label className={styles.inlineField}>
      <span>{label}</span>
      <input
        className={`field ${styles.numberField}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          // Escape first undoes the edit; a second press closes the dialog.
          if (event.key === 'Escape' && draft !== null) {
            event.preventDefault();
            setDraft(null);
          }
        }}
      />
    </label>
  );
}
