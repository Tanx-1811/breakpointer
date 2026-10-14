import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
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
  /** Submits the typed address, or `value` when a suggestion was picked. */
  onSubmit: (value?: string) => void;
};

type Suggestion = { url: string; kind: 'saved' | 'recent' };

const MAX_SUGGESTIONS = 8;

/** "https://www.example.com/a?b" → { host: "example.com", rest: "/a?b" } for display. */
function splitUrl(url: string): { host: string; rest: string } {
  try {
    const parsed = new URL(url);
    const rest = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`;
    return { host: parsed.host.replace(/^www\./, ''), rest };
  } catch {
    return { host: url, rest: '' };
  }
}

export function AddressBar(props: Props) {
  const { value, error, recentUrls, savedPages, secure, inputRef, onChange, onSubmit } = props;
  const { t } = useI18n();
  const errorId = useId();
  const listId = useId();
  const selectOnFocus = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // What was typed since focusing; untouched, every suggestion is offered.
  const [query, setQuery] = useState<string | null>(null);

  const all: Suggestion[] = [
    ...savedPages.map((url) => ({ url, kind: 'saved' as const })),
    ...recentUrls.filter((url) => !savedPages.includes(url)).map((url) => ({ url, kind: 'recent' as const })),
  ];
  const needle = (query ?? '').trim().toLowerCase().replace(/^https?:\/\//, '');
  const suggestions = all
    .filter((item) => !needle || item.url.toLowerCase().replace(/^https?:\/\//, '').includes(needle))
    .slice(0, MAX_SUGGESTIONS);
  const showList = open && suggestions.length > 0;

  useLayoutEffect(() => {
    const list = listRef.current;
    const wrap = wrapRef.current;
    if (!showList || !list || !wrap) return;
    if (typeof list.showPopover === 'function' && !list.matches(':popover-open')) list.showPopover();
    const rect = wrap.getBoundingClientRect();
    list.style.left = `${rect.left}px`;
    list.style.top = `${rect.bottom + 6}px`;
    list.style.width = `${rect.width}px`;
  });

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (item: Suggestion) => {
    close();
    setQuery(null);
    onChange(item.url);
    onSubmit(item.url);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(event.key === 'ArrowDown' ? 0 : suggestions.length - 1);
        return;
      }
      // -1 is the typed text itself; the arrows cycle through it and the suggestions.
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => {
        const next = index + delta;
        if (next < -1) return suggestions.length - 1;
        return next >= suggestions.length ? -1 : next;
      });
      return;
    }
    if (event.key === 'Enter' && showList && active >= 0 && suggestions[active]) {
      event.preventDefault();
      pick(suggestions[active]);
      return;
    }
    if (event.key === 'Escape' && showList) {
      // Close the list first; a second Escape leaves the field to the page.
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const activeId = showList && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        close();
        setQuery(null);
        onSubmit();
      }}
    >
      <div ref={wrapRef} className={styles.inputWrap} data-invalid={error ? true : undefined}>
        <Icon name={secure ? 'lock' : 'globe'} size={15} className={styles.leading} data-secure={secure || undefined} />
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={activeId}
          aria-label={t('address.label')}
          placeholder={t('address.placeholder')}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          onFocus={(event) => {
            event.target.select();
            selectOnFocus.current = true;
            setQuery(null);
            setOpen(true);
          }}
          onMouseUp={(event) => {
            // Keep the selection made on focus instead of letting the click place the caret.
            if (selectOnFocus.current) event.preventDefault();
            selectOnFocus.current = false;
          }}
          onBlur={() => {
            selectOnFocus.current = false;
            close();
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
            data-tooltip={props.saved ? t('address.saved') : t('address.save')}
            onClick={props.onToggleSaved}
            data-testid="save-page"
          >
            <Icon name="star" size={15} />
          </button>
        )}
      </div>
      <Button type="submit" variant="primary" className={styles.submit}>
        {t('address.submit')}
      </Button>
      {showList && (
        <ul ref={listRef} id={listId} role="listbox" aria-label={t('address.suggestions')} popover="manual" className={styles.list}>
          {suggestions.map((item, index) => {
            const { host, rest } = splitUrl(item.url);
            return (
              <li
                key={item.url}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={styles.option}
                // Keep focus in the field so the list stays open until the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(item)}
              >
                <Icon
                  name={item.kind === 'saved' ? 'star' : 'clock'}
                  size={14}
                  className={styles.optionIcon}
                  data-saved={item.kind === 'saved' || undefined}
                />
                <span className={styles.optionUrl}>
                  <span className={styles.optionHost}>{host}</span>
                  <span className={styles.optionRest}>{rest}</span>
                </span>
                <span className={styles.optionKind}>
                  {item.kind === 'saved' ? t('address.savedLabel') : t('address.recentLabel')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          <Icon name="alert" size={14} />
          {error}
        </p>
      )}
    </form>
  );
}
