import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { CssSnippet } from '../../types';
import { MAX_CSS_SNIPPETS, MAX_LIVE_CSS, MAX_SNIPPET_NAME } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import styles from './LiveCssDialog.module.css';

type Props = {
  open: boolean;
  /** CSS currently applied to the previews. */
  css: string;
  host: string | null;
  siteAllowed: boolean | null;
  busy: boolean;
  onApply: (css: string) => void;
  onClear: () => void;
  onAllowSite: () => void;
  onClose: () => void;
  /** CSS the user saved to use again (the section shows when `onSaveSnippet` is given). */
  snippets?: CssSnippet[];
  onSaveSnippet?: (name: string, css: string) => void;
  onDeleteSnippet?: (snippet: CssSnippet) => void;
};

/** Edit CSS that is added to every preview (this session only), to try a fix at all sizes at once. */
export function LiveCssDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('css.title')}
      description={t('css.description')}
      icon="code"
      onClose={props.onClose}
      width={680}
    >
      {/* Mounted while open, so the draft starts from what is applied. */}
      <Editor {...props} />
    </Dialog>
  );
}

function Editor({
  css,
  host,
  siteAllowed,
  busy,
  onApply,
  onClear,
  onAllowSite,
  onClose,
  snippets = [],
  onSaveSnippet,
  onDeleteSnippet,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(css);
  const [snippetName, setSnippetName] = useState('');
  const fieldId = useId();
  const hintId = useId();
  const nameId = useId();
  const snippetsId = useId();
  const apply = () => onApply(draft.trim());
  const full = snippets.length >= MAX_CSS_SNIPPETS;
  // Saving under an existing name replaces that snippet, even when the list is full.
  const replaces = snippets.some(
    (snippet) => snippet.name.toLocaleLowerCase() === snippetName.trim().toLocaleLowerCase(),
  );

  const saveSnippet = (event: FormEvent) => {
    event.preventDefault();
    if (!onSaveSnippet || !draft.trim() || !snippetName.trim() || (full && !replaces)) return;
    onSaveSnippet(snippetName, draft);
    setSnippetName('');
  };

  return (
    <div className={styles.editor}>
      {host && siteAllowed === false && (
        <div className={styles.access}>
          <Icon name="shield" size={16} />
          <span>{t('css.accessNote')}</span>
          <Button size="sm" variant="primary" onClick={onAllowSite} disabled={busy}>
            {t('tools.allowSite', { host })}
          </Button>
        </div>
      )}
      <label htmlFor={fieldId} className={styles.label}>
        {t('css.label')}
      </label>
      <textarea
        id={fieldId}
        className={`field ${styles.textarea}`}
        value={draft}
        maxLength={MAX_LIVE_CSS}
        rows={12}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        placeholder={t('css.placeholder')}
        aria-describedby={hintId}
        data-autofocus
        data-testid="live-css-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            apply();
          }
        }}
      />
      <p id={hintId} className={styles.hint}>
        {t('css.shortcut')}
      </p>

      {onSaveSnippet && (
        <section className={styles.snippets} aria-labelledby={snippetsId}>
          <h3 id={snippetsId} className={styles.snippetsTitle}>
            {t('css.snippets')}
          </h3>
          {snippets.length === 0 ? (
            <p className={styles.hint}>{t('css.snippetsEmpty')}</p>
          ) : (
            <ul className={styles.snippetList}>
              {snippets.map((snippet) => (
                <li key={snippet.id} className={styles.snippet} data-testid="css-snippet">
                  <span className={styles.snippetText}>
                    <span className={styles.snippetName}>{snippet.name}</span>
                    <code className={styles.snippetCode}>{snippet.css.replace(/\s+/g, ' ')}</code>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="pencil"
                    aria-label={t('css.snippetUseLabel', { name: snippet.name })}
                    onClick={() => setDraft(snippet.css)}
                  >
                    {t('css.snippetUse')}
                  </Button>
                  <Button
                    size="sm"
                    icon="code"
                    aria-label={t('css.snippetApplyLabel', { name: snippet.name })}
                    onClick={() => onApply(snippet.css)}
                  >
                    {t('css.snippetApply')}
                  </Button>
                  <IconButton
                    icon="trash"
                    size="sm"
                    tone="danger"
                    label={t('css.snippetDelete', { name: snippet.name })}
                    onClick={() => onDeleteSnippet?.(snippet)}
                  />
                </li>
              ))}
            </ul>
          )}
          <form className={styles.saveSnippet} onSubmit={saveSnippet}>
            <label htmlFor={nameId} className="visually-hidden">
              {t('css.snippetName')}
            </label>
            <input
              id={nameId}
              className={`field ${styles.snippetNameField}`}
              value={snippetName}
              maxLength={MAX_SNIPPET_NAME}
              placeholder={t('css.snippetNamePlaceholder')}
              data-testid="css-snippet-name"
              onChange={(event) => setSnippetName(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              icon="save"
              disabled={!draft.trim() || !snippetName.trim() || (full && !replaces)}
              tooltip={full && !replaces ? t('css.snippetLimit', { max: MAX_CSS_SNIPPETS }) : undefined}
            >
              {t('css.saveSnippet')}
            </Button>
          </form>
        </section>
      )}
      <div className={styles.footer}>
        {css && (
          <Button variant="ghost" icon="trash" onClick={onClear} className={styles.clear}>
            {t('css.clear')}
          </Button>
        )}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" icon="code" onClick={apply} disabled={draft.trim() === css}>
          {t('css.apply')}
        </Button>
      </div>
    </div>
  );
}
