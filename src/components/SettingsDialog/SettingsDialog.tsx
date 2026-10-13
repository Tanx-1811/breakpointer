import { useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { BreakpointSetId, LanguagePreference, ThemePreference, ViewportLabSettings } from '../../types';
import { MAX_RECENT_URLS } from '../../utils/constants';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Segmented } from '../Segmented/Segmented';
import { Switch } from '../Switch/Switch';
import styles from './SettingsDialog.module.css';

type Props = {
  open: boolean;
  settings: ViewportLabSettings;
  version: string;
  onTheme: (theme: ThemePreference) => void;
  onLanguage: (language: LanguagePreference) => void;
  onBreakpoints: (set: BreakpointSetId) => void;
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
          </select>
        </Row>
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
