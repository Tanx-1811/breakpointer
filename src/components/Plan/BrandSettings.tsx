import { useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { blobToDataUrl } from '../../services/screenshot';
import {
  MAX_BRAND_NAME,
  MAX_BRAND_URL,
  MAX_LOGO_BYTES,
  isSafeLogo,
  normalizeBrandName,
  normalizeBrandUrl,
} from '../../state/branding';
import type { BrandingSettings } from '../../types';
import { Button } from '../Button/Button';
import { Switch } from '../Switch/Switch';
import { ProBadge, usePlan } from './PlanContext';
import styles from './Plan.module.css';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Props = {
  branding: BrandingSettings;
  onChange: (branding: Partial<BrandingSettings>) => void;
};

/** Settings → Your brand (Pro): a name, a website and a logo for reports and images. */
export function BrandSettings({ branding, onChange }: Props) {
  const { t } = useI18n();
  const { pro, upgrade } = usePlan();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState(false);

  const chooseLogo = async (file: File) => {
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      setLogoError(true);
      return;
    }
    const logo = await blobToDataUrl(file).catch(() => '');
    if (!isSafeLogo(logo)) {
      setLogoError(true);
      return;
    }
    setLogoError(false);
    onChange({ logo });
  };

  return (
    <div className={styles.brand} data-testid="brand-settings">
      <p className={styles.brandHelp}>
        {t('settings.brandHelp')}
        {!pro && <ProBadge feature="branding" />}
      </p>
      {!pro && (
        <div>
          <Button size="sm" variant="primary" icon="sparkle" onClick={() => upgrade('branding')}>
            {t('pro.see')}
          </Button>
        </div>
      )}
      <fieldset className={styles.brandFields} disabled={!pro}>
        <legend className="visually-hidden">{t('settings.brand')}</legend>
        <TextSetting
          label={t('settings.brandName')}
          help={t('settings.brandNameHelp')}
          placeholder={t('settings.brandNamePlaceholder')}
          value={branding.name}
          maxLength={MAX_BRAND_NAME}
          normalize={normalizeBrandName}
          onCommit={(name) => onChange({ name })}
        />
        <TextSetting
          label={t('settings.brandUrl')}
          help={t('settings.brandUrlHelp')}
          placeholder="https://example.com"
          value={branding.url}
          maxLength={MAX_BRAND_URL}
          type="url"
          normalize={normalizeBrandUrl}
          invalidMessage={t('settings.brandUrlInvalid')}
          onCommit={(url) => onChange({ url })}
        />
        <div className={styles.brandRow}>
          <div className={styles.brandText}>
            <span className={styles.brandLabel} id={`${id}-logo`}>
              {t('settings.brandLogo')}
            </span>
            <span
              className={logoError ? styles.licenseProblem : styles.licenseNote}
              role={logoError ? 'alert' : undefined}
            >
              {logoError ? t('settings.brandLogoInvalid') : t('settings.brandLogoHelp')}
            </span>
          </div>
          <div className={styles.logoControls}>
            {branding.logo && <img className={styles.logo} src={branding.logo} alt={t('settings.brandLogoAlt')} />}
            <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()} aria-describedby={`${id}-logo`}>
              {t('settings.brandLogoChoose')}
            </Button>
            {branding.logo && (
              <Button size="sm" variant="ghost" icon="trash" onClick={() => onChange({ logo: '' })}>
                {t('settings.brandLogoRemove')}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={LOGO_TYPES.join(',')}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void chooseLogo(file);
                event.target.value = '';
              }}
              data-testid="brand-logo-input"
            />
          </div>
        </div>
      </fieldset>
      {pro && (
        <Switch
          checked={branding.credit}
          onChange={(credit) => onChange({ credit })}
          label={t('settings.brandCredit')}
          description={t('settings.brandCreditHelp')}
        />
      )}
    </div>
  );
}

/** A text setting saved on blur or Enter, once valid; Escape puts back the saved value. */
function TextSetting({
  label,
  help,
  placeholder,
  value,
  maxLength,
  type = 'text',
  normalize,
  invalidMessage,
  onCommit,
}: {
  label: string;
  help: string;
  placeholder: string;
  value: string;
  maxLength: number;
  type?: 'text' | 'url';
  normalize: (value: string) => string;
  /** Shown when a non-empty value normalizes to nothing. */
  invalidMessage?: string;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    if (draft === null) return;
    const next = normalize(draft);
    if (draft.trim() && !next && invalidMessage) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    if (next !== value) onCommit(next);
  };
  return (
    <div className={styles.brandRow}>
      <div className={styles.brandText}>
        <label className={styles.brandLabel} htmlFor={id}>
          {label}
        </label>
        <span id={`${id}-help`} className={invalid ? styles.licenseProblem : styles.licenseNote}>
          {invalid && invalidMessage ? invalidMessage : help}
        </span>
      </div>
      <input
        id={id}
        className={`field ${styles.brandInput}`}
        type={type}
        value={draft ?? value}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          // Escape first undoes the edit; a second press closes the dialog.
          if (event.key === 'Escape' && draft !== null) {
            event.preventDefault();
            setDraft(null);
            setInvalid(false);
          }
        }}
      />
    </div>
  );
}
