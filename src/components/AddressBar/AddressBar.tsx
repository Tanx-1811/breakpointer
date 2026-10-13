import { useId, useRef, type Ref } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './AddressBar.module.css';

type Props = {
  value: string;
  error: string | null;
  recentUrls: string[];
  secure: boolean | null;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function AddressBar({ value, error, recentUrls, secure, inputRef, onChange, onSubmit }: Props) {
  const { t } = useI18n();
  const errorId = useId();
  const listId = useId();
  const selectOnFocus = useRef(false);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.inputWrap} data-invalid={error ? true : undefined}>
        <Icon name={secure ? 'lock' : 'globe'} size={15} className={styles.leading} />
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label={t('address.label')}
          placeholder={t('address.placeholder')}
          value={value}
          list={recentUrls.length ? listId : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            event.target.select();
            selectOnFocus.current = true;
          }}
          onMouseUp={(event) => {
            // Keep the selection made on focus instead of letting the click place the caret.
            if (selectOnFocus.current) event.preventDefault();
            selectOnFocus.current = false;
          }}
          onBlur={() => {
            selectOnFocus.current = false;
          }}
          data-testid="address-input"
        />
        <kbd className={styles.kbd} aria-hidden="true">
          /
        </kbd>
        {recentUrls.length > 0 && (
          <datalist id={listId}>
            {recentUrls.map((url) => (
              <option key={url} value={url} />
            ))}
          </datalist>
        )}
      </div>
      <Button type="submit" variant="primary">
        {t('address.submit')}
      </Button>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon name="alert" size={14} />
          {error}
        </p>
      )}
    </form>
  );
}
