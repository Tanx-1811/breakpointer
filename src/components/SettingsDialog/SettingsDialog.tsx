import { useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
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
import { GRID_COLUMN_OPTIONS, MAX_GRID_SPACING, MAX_RECENT_URLS } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { BreakpointEditor } from './BreakpointEditor';
import { Dialog } from '../Dialog/Dialog';
import { Segmented } from '../Segmented/Segmented';
import { Switch } from '../Switch/Switch';
import styles from './SettingsDialog.module.css';

type Props = {
  open: boolean;
  settings: BreakpointerSettings;
  version: string;
  onTheme: (theme: ThemePreference) => void;
  onLanguage: (language: LanguagePreference) => void;
  onBreakpoints: (set: BreakpointSetId) => void;
  onCustomBreakpoints: (breakpoints: Breakpoint[]) => void;
  onSync: (sync: Partial<SyncSettings>) => void;
  onChecks: (on: boolean) => void;
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h3 id={id} className={styles.heading}>
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
  const { open, settings, version, onClose } = props;
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const customId = useId();

  return (
    <Dialog open={open} title={t('settings.title')} onClose={onClose} width={620}>
      <Section title={t('settings.appearance')}>
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
          <select
            className="field"
            aria-label={t('settings.language')}
            value={settings.language}
            onChange={(event) => props.onLanguage(event.target.value as LanguagePreference)}
          >
            <option value="auto">{t('language.auto')}</option>
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </Row>
      </Section>

      <Section title={t('settings.workspace')}>
        <Row label={t('settings.breakpoints')} help={t('settings.breakpointsHelp')}>
          <select
            className="field"
            aria-label={t('settings.breakpoints')}
            value={settings.breakpoints}
            onChange={(event) => props.onBreakpoints(event.target.value as BreakpointSetId)}
          >
            <option value="none">{t('breakpoints.none')}</option>
            <option value="tailwind">{t('breakpoints.tailwind')}</option>
            <option value="bootstrap">{t('breakpoints.bootstrap')}</option>
            <option value="custom">{t('breakpoints.custom')}</option>
          </select>
        </Row>
        {settings.breakpoints === 'custom' && (
          <div className={styles.subsection} role="group" aria-labelledby={customId}>
            <span id={customId} className={styles.rowLabel}>
              {t('settings.customBreakpoints')}
            </span>
            <span className={styles.rowHelp}>{t('settings.customBreakpointsHelp')}</span>
            <BreakpointEditor breakpoints={settings.customBreakpoints} onChange={props.onCustomBreakpoints} />
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

      <Section title={t('settings.tools')}>
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
        <Switch
          checked={settings.grid.show}
          onChange={(show) => props.onGrid({ show })}
          label={t('settings.grid')}
          description={t('settings.gridHelp')}
        />
        <div className={styles.gridOptions}>
          <label className={styles.inlineField}>
            <span>{t('settings.gridColumns')}</span>
            <select
              className="field"
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
            </select>
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
        </div>
      </Section>

      <Section title={t('settings.savedPages')}>
        <p className={styles.help}>{t('settings.savedPagesHelp')}</p>
        {settings.savedPages.length === 0 ? (
          <p className={styles.empty}>{t('settings.savedPagesEmpty')}</p>
        ) : (
          <ul className={styles.savedList} data-testid="saved-pages">
            {settings.savedPages.map((url) => (
              <li key={url} className={styles.savedRow}>
                <span className={styles.savedUrl} title={url}>
                  {url}
                </span>
                <Button
                  size="sm"
                  icon="external"
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

      <Section title={t('settings.data')}>
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

      <Section title={t('settings.privacy')}>
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

      <p className={styles.version}>{t('settings.version', { version })}</p>
    </Dialog>
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
