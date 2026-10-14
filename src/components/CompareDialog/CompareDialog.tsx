import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { URL_ERROR_KEYS } from '../../i18n/url-errors';
import { parseCompareInput, type CompareMode, type CompareTarget } from '../../state/compare';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import styles from './CompareDialog.module.css';

type Props = {
  open: boolean;
  /** What is being compared now, if anything. */
  target: CompareTarget | null;
  /** The workspace's page (A), if any. */
  current: string | null;
  onCompare: (target: CompareTarget) => void;
  onStop: () => void;
  onClose: () => void;
};

/** Starts (or changes) a comparison of the workspace's page with another address. */
export function CompareDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('compare.title')}
      description={t('compare.description')}
      icon="split"
      onClose={props.onClose}
      width={520}
    >
      <CompareForm {...props} />
    </Dialog>
  );
}

function CompareForm({ target, current, onCompare, onStop, onClose }: Props) {
  const { t } = useI18n();
  const fieldId = useId();
  const errorId = useId();
  const [mode, setMode] = useState<CompareMode>(target?.mode ?? 'mirror');
  const [value, setValue] = useState(target ? (target.mode === 'mirror' ? target.origin : target.url) : '');
  const [error, setError] = useState<MessageKey | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = parseCompareInput(value, mode, current);
    if (!result.ok) {
      setError(result.error === 'same' ? 'compare.same' : URL_ERROR_KEYS[result.error]);
      return;
    }
    onCompare(result.target);
  };

  const modes: { value: CompareMode; label: MessageKey; hint: MessageKey }[] = [
    { value: 'mirror', label: 'compare.modeMirror', hint: 'compare.modeMirrorHint' },
    { value: 'fixed', label: 'compare.modeFixed', hint: 'compare.modeFixedHint' },
  ];

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={fieldId} className={styles.label}>
        {t('compare.address')}
      </label>
      <input
        id={fieldId}
        className="field"
        value={value}
        placeholder={t('compare.placeholder')}
        spellCheck={false}
        autoComplete="off"
        inputMode="url"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-autofocus
        data-testid="compare-input"
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {t(error)}
        </p>
      )}

      <fieldset className={styles.modes}>
        <legend className={styles.label}>{t('compare.mode')}</legend>
        {modes.map((option) => (
          <label key={option.value} className={styles.mode}>
            <input
              type="radio"
              name="compare-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => {
                setMode(option.value);
                setError(null);
              }}
            />
            <span className={styles.modeText}>
              <span className={styles.modeLabel}>{t(option.label)}</span>
              <span className={styles.modeHint}>{t(option.hint)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className={styles.footer}>
        {target && (
          <Button variant="ghost" icon="close" onClick={onStop} className={styles.stop}>
            {t('compare.stop')}
          </Button>
        )}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" variant="primary" icon="split">
          {t('compare.start')}
        </Button>
      </div>
    </form>
  );
}
