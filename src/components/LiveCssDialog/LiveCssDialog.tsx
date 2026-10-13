import { useId, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MAX_LIVE_CSS } from '../../utils/constants';
import { Button } from '../Button/Button';
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
};

/** Edit CSS that is added to every preview (this session only), to try a fix at all sizes at once. */
export function LiveCssDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('css.title')}
      description={t('css.description')}
      onClose={props.onClose}
      width={640}
    >
      {/* Mounted while open, so the draft starts from what is applied. */}
      <Editor {...props} />
    </Dialog>
  );
}

function Editor({ css, host, siteAllowed, busy, onApply, onClear, onAllowSite, onClose }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(css);
  const fieldId = useId();
  const hintId = useId();
  const apply = () => onApply(draft.trim());

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
