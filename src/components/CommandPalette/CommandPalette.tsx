import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { searchCommands } from '../../state/commands';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './CommandPalette.module.css';

export type PaletteCommand = {
  id: string;
  title: string;
  /** Heading the command is listed under. */
  section: string;
  /** Extra words that find it (other names, sizes…). */
  keywords?: string;
  icon?: IconName;
  /** Quiet text on the right, e.g. a size. */
  hint?: string;
  shortcut?: string;
  /** A switch that is on. */
  checked?: boolean;
  /** One of several choices (e.g. a layout) that is the one in use. */
  current?: boolean;
  disabled?: boolean;
  run: () => void;
};

type Props = {
  open: boolean;
  commands: PaletteCommand[];
  /** A command made from what was typed (e.g. "Preview example.com"), listed first. */
  fromQuery?: (query: string) => PaletteCommand | null;
  onClose: () => void;
};

/** Search and run any action: ⌘K / Ctrl+K. */
export function CommandPalette({ open, commands, fromQuery, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="palette-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === ref.current;
      }}
      onClick={(event) => {
        if (event.target === ref.current && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
      data-testid="command-palette"
    >
      {/* Mounted while open, so every opening starts with an empty search. */}
      {open && <Palette commands={commands} fromQuery={fromQuery} onClose={onClose} />}
    </dialog>
  );
}

function Palette({ commands, fromQuery, onClose }: Omit<Props, 'open'>) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const found = searchCommands(commands, query, 80);
    const extra = query.trim() ? fromQuery?.(query.trim()) : null;
    return extra ? [extra, ...found] : found;
  }, [commands, fromQuery, query]);

  // With an empty search, commands are listed under their sections.
  const sections = useMemo(() => {
    if (query.trim()) return null;
    const map = new Map<string, PaletteCommand[]>();
    for (const command of results) map.set(command.section, [...(map.get(command.section) ?? []), command]);
    return [...map.entries()];
  }, [query, results]);

  const enabled = results.filter((command) => !command.disabled);
  const current = enabled[Math.min(active, enabled.length - 1)];

  useLayoutEffect(() => {
    if (!current) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-command-id="${CSS.escape(current.id)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const run = (command: PaletteCommand) => {
    if (command.disabled) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const move = (next: number) => {
      event.preventDefault();
      if (enabled.length) setActive((next + enabled.length) % enabled.length);
    };
    const index = current ? enabled.indexOf(current) : 0;
    switch (event.key) {
      case 'ArrowDown':
        move(index + 1);
        break;
      case 'ArrowUp':
        move(index - 1);
        break;
      case 'PageDown':
        move(Math.min(enabled.length - 1, index + 8));
        break;
      case 'PageUp':
        move(Math.max(0, index - 8));
        break;
      case 'Enter':
        event.preventDefault();
        if (current) run(current);
        break;
    }
  };

  const option = (command: PaletteCommand) => {
    const selected = command === current;
    return (
      <div
        key={command.id}
        id={`${listId}-${command.id}`}
        role="option"
        aria-selected={selected}
        aria-disabled={command.disabled || undefined}
        className={styles.option}
        data-command-id={command.id}
        onMouseMove={() => {
          if (!command.disabled && !selected) setActive(enabled.indexOf(command));
        }}
        onClick={() => run(command)}
      >
        <span className={styles.optionIcon}>{command.icon && <Icon name={command.icon} size={16} />}</span>
        <span className={styles.optionTitle}>{command.title}</span>
        {command.checked !== undefined && (
          <span className={styles.state} data-on={command.checked || undefined}>
            {command.checked ? t('tools.on') : t('palette.off')}
          </span>
        )}
        {command.current && (
          <span className={styles.current} title={t('palette.current')}>
            <Icon name="check" size={14} />
            <span className="visually-hidden">{t('palette.current')}</span>
          </span>
        )}
        {query.trim() && <span className={styles.optionSection}>{command.section}</span>}
        {command.hint && <span className={styles.optionHint}>{command.hint}</span>}
        {command.shortcut && <kbd className={styles.kbd}>{command.shortcut}</kbd>}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <h2 id="palette-title" className="visually-hidden">
        {t('palette.title')}
      </h2>
      <div className={styles.search}>
        <Icon name="search" size={18} className={styles.searchIcon} />
        <input
          className={styles.input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
          aria-label={t('palette.label')}
          placeholder={t('palette.placeholder')}
          value={query}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          data-testid="palette-input"
        />
        <kbd className={styles.esc}>Esc</kbd>
      </div>
      {results.length === 0 && (
        <p className={styles.empty} role="status">
          {t('palette.empty', { query: query.trim() })}
        </p>
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('palette.results')}
        className={styles.list}
        hidden={results.length === 0}
      >
        {sections
          ? sections.map(([section, items]) => (
              <div key={section} role="group" aria-label={section} className={styles.group}>
                <div className={styles.heading} aria-hidden="true">
                  {section}
                </div>
                {items.map(option)}
              </div>
            ))
          : results.map(option)}
      </div>
      <footer className={styles.footer} aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> {t('palette.navigate')}
        </span>
        <span>
          <kbd>↵</kbd> {t('palette.run')}
        </span>
        <span>
          <kbd>Esc</kbd> {t('palette.close')}
        </span>
      </footer>
    </div>
  );
}
