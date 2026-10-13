import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { normalizeGroupName } from '../../state/groups';
import type { ViewportGroup } from '../../types';
import { MAX_GROUPS, MAX_NAME_LENGTH } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import styles from './GroupDialogs.module.css';

type SaveProps = {
  open: boolean;
  viewportCount: number;
  groupCount: number;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function SaveGroupDialog({ open, viewportCount, groupCount, onSave, onClose }: SaveProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      title={t('groups.saveTitle')}
      description={t('groups.saveDescription', { count: viewportCount })}
      onClose={onClose}
      width={460}
    >
      {/* Dialog renders its content only while open, so the form starts fresh each time. */}
      <SaveGroupForm viewportCount={viewportCount} groupCount={groupCount} onSave={onSave} onClose={onClose} />
    </Dialog>
  );
}

function SaveGroupForm({ viewportCount, groupCount, onSave, onClose }: Omit<SaveProps, 'open'>) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const atLimit = groupCount >= MAX_GROUPS;
  const empty = viewportCount === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeGroupName(name);
    if (!value) {
      setError(t('groups.nameRequired'));
      return;
    }
    onSave(value);
  };

  return (
    <form onSubmit={submit} noValidate className={styles.form}>
      <label htmlFor={inputId} className={styles.label}>
        {t('groups.nameLabel')}
      </label>
      <input
        id={inputId}
        className="field"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder={t('groups.namePlaceholder')}
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error || atLimit || empty ? errorId : undefined}
        onChange={(event) => setName(event.target.value)}
      />
      {(error || atLimit || empty) && (
        <p id={errorId} role="alert" className={styles.error}>
          {error ?? (empty ? t('groups.nothingToSave') : t('groups.limit', { max: MAX_GROUPS }))}
        </p>
      )}
      <div className={styles.footer}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" variant="primary" icon="save" disabled={atLimit || empty}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

type ManageProps = {
  open: boolean;
  groups: ViewportGroup[];
  onRename: (id: string, name: string) => void;
  onReplace: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  canReplace: boolean;
};

export function ManageGroupsDialog({ open, groups, onRename, onReplace, onDelete, onClose, canReplace }: ManageProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      title={t('groups.manageTitle')}
      description={t('groups.manageDescription')}
      onClose={onClose}
      width={560}
    >
      {groups.length === 0 ? (
        <p className={styles.empty}>{t('groups.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              canReplace={canReplace}
              onRename={(name) => onRename(group.id, name)}
              onReplace={() => onReplace(group.id)}
              onDelete={() => onDelete(group.id)}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function GroupRow({
  group,
  canReplace,
  onRename,
  onReplace,
  onDelete,
}: {
  group: ViewportGroup;
  canReplace: boolean;
  onRename: (name: string) => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  // A local draft while typing; otherwise the saved name.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? group.name;

  const commit = () => {
    const value = normalizeGroupName(name);
    if (value && value !== group.name) onRename(value);
    setDraft(null);
  };

  const sizes = group.viewports.map((vp) => `${vp.width}×${vp.height}`).join(' · ');

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <input
          className={`field ${styles.nameInput}`}
          value={name}
          maxLength={MAX_NAME_LENGTH}
          aria-label={t('groups.renameLabel', { name: group.name })}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <span className={styles.meta} title={sizes}>
          {group.viewports.length === 1
            ? t('common.viewport')
            : t('common.viewports', { count: group.viewports.length })}{' '}
          · {sizes}
        </span>
      </div>
      <div className={styles.rowActions}>
        <IconButton icon="reset" label={t('groups.update')} onClick={onReplace} disabled={!canReplace} />
        <IconButton icon="trash" tone="danger" label={t('groups.delete', { name: group.name })} onClick={onDelete} />
      </div>
    </li>
  );
}
