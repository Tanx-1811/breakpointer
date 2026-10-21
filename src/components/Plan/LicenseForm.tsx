import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import type { VerifyResult } from '../../services/license';
import type { LicenseProblem } from '../../state/license';
import { Button } from '../Button/Button';
import styles from './Plan.module.css';

const PROBLEM_KEYS: Record<LicenseProblem, MessageKey> = {
  format: 'pro.problem.format',
  unknownKey: 'pro.problem.unknownKey',
  signature: 'pro.problem.signature',
  claims: 'pro.problem.claims',
};

type Props = {
  onActivate: (key: string) => Promise<VerifyResult>;
  /** The key was valid (the caller says so, e.g. with a toast). */
  onActivated: (result: Extract<VerifyResult, { ok: true }>) => void;
  /** Gets the focus when the form appears (in a dialog: `data-autofocus`). */
  autoFocus?: boolean;
};

/** Paste a licence key and activate it; the key is checked in the browser. */
export function LicenseForm({ onActivate, onActivated, autoFocus }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [key, setKey] = useState('');
  const [problem, setProblem] = useState<LicenseProblem | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!key.trim() || checking) return;
    setChecking(true);
    try {
      const result = await onActivate(key);
      if (result.ok) {
        setKey('');
        setProblem(null);
        onActivated(result);
      } else setProblem(result.problem);
    } finally {
      setChecking(false);
    }
  };

  return (
    <form className={styles.licenseForm} onSubmit={(event) => void submit(event)} data-testid="license-form">
      <label className={styles.licenseLabel} htmlFor={`${id}-key`}>
        {t('pro.keyLabel')}
      </label>
      <div className={styles.licenseRow}>
        <input
          id={`${id}-key`}
          className="field"
          type="text"
          value={key}
          placeholder={t('pro.keyPlaceholder')}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : `${id}-privacy`}
          data-autofocus={autoFocus || undefined}
          onChange={(event) => {
            setKey(event.target.value);
            setProblem(null);
          }}
        />
        <Button type="submit" variant="primary" icon="key" disabled={!key.trim() || checking}>
          {checking ? t('pro.activating') : t('pro.activate')}
        </Button>
      </div>
      {problem ? (
        <p id={`${id}-problem`} className={styles.licenseProblem} role="alert">
          {t(PROBLEM_KEYS[problem])}
        </p>
      ) : (
        <p id={`${id}-privacy`} className={styles.licenseNote}>
          {t('pro.keyPrivacy')}
        </p>
      )}
    </form>
  );
}
