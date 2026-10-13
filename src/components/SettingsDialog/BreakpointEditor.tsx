import { useId, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { suggestBreakpoint, toDrafts, validateBreakpoints, type BreakpointDraft } from '../../state/breakpoints';
import type { Breakpoint } from '../../types';
import { MAX_BREAKPOINT_NAME, MAX_CUSTOM_BREAKPOINTS, MAX_DIMENSION, MIN_DIMENSION } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import styles from './SettingsDialog.module.css';

type Props = {
  breakpoints: Breakpoint[];
  onChange: (breakpoints: Breakpoint[]) => void;
};

/**
 * Rows of name + min-width. Changes are saved as soon as every row is valid;
 * rows keep their place while editing and are shown sorted the next time.
 */
export function BreakpointEditor({ breakpoints, onChange }: Props) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<BreakpointDraft[]>(() => toDrafts(breakpoints));
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();

  const commit = (next: BreakpointDraft[]) => {
    setDrafts(next);
    const valid = validateBreakpoints(next);
    setInvalid(!valid);
    if (valid) onChange(valid);
  };

  const update = (index: number, patch: Partial<BreakpointDraft>) =>
    commit(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  return (
    <div className={styles.breakpoints}>
      {drafts.length > 0 && (
        <div className={styles.bpHeader} aria-hidden="true">
          <span>{t('settings.breakpointName')}</span>
          <span>{t('settings.breakpointMin')}</span>
        </div>
      )}
      <ul className={styles.bpList}>
        {drafts.map((draft, index) => (
          <li key={index} className={styles.bpRow}>
            <input
              className="field"
              value={draft.name}
              maxLength={MAX_BREAKPOINT_NAME}
              aria-label={`${t('settings.breakpointName')} ${index + 1}`}
              aria-invalid={invalid && !draft.name.trim() ? true : undefined}
              aria-describedby={invalid ? errorId : undefined}
              onChange={(event) => update(index, { name: event.target.value })}
              data-testid="breakpoint-name"
            />
            <input
              className={`field ${styles.bpMin}`}
              type="number"
              inputMode="numeric"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              step={1}
              value={draft.min}
              aria-label={`${t('settings.breakpointMin')} ${index + 1}`}
              aria-describedby={invalid ? errorId : undefined}
              onChange={(event) => update(index, { min: event.target.value })}
              data-testid="breakpoint-min"
            />
            <IconButton
              icon="trash"
              size="sm"
              tone="danger"
              label={t('settings.removeBreakpoint', { name: draft.name.trim() || String(index + 1) })}
              onClick={() => commit(drafts.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ul>
      {invalid && (
        <p id={errorId} role="alert" className={styles.error}>
          {t('settings.breakpointError', { min: MIN_DIMENSION, max: MAX_DIMENSION })}
        </p>
      )}
      <div>
        <Button
          size="sm"
          icon="plus"
          disabled={drafts.length >= MAX_CUSTOM_BREAKPOINTS || invalid}
          onClick={() => {
            const valid = validateBreakpoints(drafts) ?? [];
            const next = suggestBreakpoint(valid);
            commit([...toDrafts(valid), { name: next.name, min: String(next.min) }]);
          }}
        >
          {t('settings.addBreakpoint')}
        </Button>
      </div>
    </div>
  );
}
