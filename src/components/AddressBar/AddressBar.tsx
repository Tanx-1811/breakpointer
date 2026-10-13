import { useId, useRef, type Ref } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './AddressBar.module.css';

type Props = {
  value: string;
  error: string | null;
  recentUrls: string[];
  /** Pages the user starred; suggested first. */
  savedPages: string[];
  /** The page on show is starred. */
  saved: boolean;
  canSave: boolean;
  onToggleSaved: () => void;
  secure: boolean | null;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function AddressBar(props: Props) {
  const { value, error, recentUrls, savedPages, secure, inputRef, onChange, onSubmit } = props;
  const { t } = useI18n();
  const suggestions = [
    ...savedPages.map((url) => ({ url, label: t('address.savedLabel') })),
    ...recentUrls.filter((url) => !savedPages.includes(url)).map((url) => ({ url, label: t('address.recentLabel') })),
  ];
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
          list={suggestions.length ? listId : undefined}
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
        {props.canSave && (
          <button
            type="button"
            className={styles.star}
            aria-pressed={props.saved}
            aria-label={t('address.save')}
            title={t('address.save')}
            onClick={props.onToggleSaved}
            data-testid="save-page"
          >
            <Icon name="star" size={15} />
          </button>
        )}
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((item) => (
              <option key={item.url} value={item.url} label={item.label} />
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
