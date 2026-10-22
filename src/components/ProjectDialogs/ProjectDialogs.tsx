import { useId, useState, type FormEvent } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MAX_PROJECTS, normalizeProjectName, projectNamed } from '../../state/projects';
import type { Project } from '../../types';
import { MAX_NAME_LENGTH } from '../../utils/constants';
import { displayHost } from '../../utils/url';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import { ProBadge } from '../Plan/PlanContext';
import styles from '../GroupDialogs/GroupDialogs.module.css';

type SaveProps = {
  open: boolean;
  projects: Project[];
  /** The name offered (the page's host). */
  suggestedName: string;
  /** A new project fits the plan (updating one always does). */
  canSaveNew: boolean;
  onSave: (name: string) => void;
  onUpgrade: () => void;
  onClose: () => void;
};

export function SaveProjectDialog(props: SaveProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('projects.saveTitle')}
      description={t('projects.saveDescription')}
      icon="save"
      onClose={props.onClose}
      width={480}
    >
      {/* Dialog renders its content only while open, so the form starts fresh each time. */}
      <SaveProjectForm {...props} />
    </Dialog>
  );
}

function SaveProjectForm({ projects, suggestedName, canSaveNew, onSave, onUpgrade, onClose }: Omit<SaveProps, 'open'>) {
  const { t } = useI18n();
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState(false);
  const inputId = useId();
  const noteId = useId();
  const existing = projectNamed(projects, name);
  const blocked = !existing && !canSaveNew;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = normalizeProjectName(name);
    if (!value) {
      setError(true);
      return;
    }
    if (blocked) return;
    onSave(value);
  };

  return (
    <form onSubmit={submit} noValidate className={styles.form} data-testid="save-project">
      <label htmlFor={inputId} className={styles.label}>
        {t('projects.nameLabel')}
      </label>
      <input
        id={inputId}
        className="field"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder={t('projects.namePlaceholder')}
        data-autofocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error || existing || blocked ? noteId : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setError(false);
        }}
      />
      {error ? (
        <p id={noteId} role="alert" className={styles.error}>
          {t('projects.nameRequired')}
        </p>
      ) : existing ? (
        <p id={noteId} className={styles.note}>
          {t('projects.replaces')}
        </p>
      ) : blocked ? (
        <p id={noteId} className={styles.note}>
          {t('projects.freeLimit', { max: MAX_PROJECTS })} <ProBadge feature="projects" />
        </p>
      ) : null}
      <div className={styles.footer}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        {blocked ? (
          <Button variant="primary" icon="sparkle" onClick={onUpgrade}>
            {t('pro.see')}
          </Button>
        ) : (
          <Button type="submit" variant="primary" icon="save">
            {t('common.save')}
          </Button>
        )}
      </div>
    </form>
  );
}

type ManageProps = {
  open: boolean;
  projects: Project[];
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Saves the current setup into the project (null: nothing to save, no page shown). */
  onUpdate: ((id: string) => void) | null;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function ManageProjectsDialog({ open, projects, onOpen, onRename, onUpdate, onDelete, onClose }: ManageProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      title={t('projects.manageTitle')}
      description={t('projects.manageDescription')}
      icon="save"
      onClose={onClose}
      width={620}
    >
      {projects.length === 0 ? (
        <p className={styles.empty}>{t('projects.empty')}</p>
      ) : (
        <ul className={styles.list} data-testid="project-list">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              onOpen={() => onOpen(project.id)}
              onRename={(name) => onRename(project.id, name)}
              onUpdate={onUpdate ? () => onUpdate(project.id) : null}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function ProjectRow({
  project,
  onOpen,
  onRename,
  onUpdate,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onRename: (name: string) => void;
  onUpdate: (() => void) | null;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? project.name;
  const commit = () => {
    const value = normalizeProjectName(name);
    if (value && value !== project.name) onRename(value);
    setDraft(null);
  };
  const host = displayHost(new URL(project.url));

  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon name="save" size={16} />
      </span>
      <div className={styles.rowMain}>
        <input
          className={`field ${styles.nameInput}`}
          value={name}
          maxLength={MAX_NAME_LENGTH}
          aria-label={t('projects.renameLabel', { name: project.name })}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <span className={styles.meta} title={project.url}>
          {project.viewports.length === 1
            ? t('projects.metaOne', { host })
            : t('projects.meta', { host, count: project.viewports.length })}
        </span>
      </div>
      <div className={styles.rowActions}>
        <Button
          size="sm"
          icon="arrowRight"
          onClick={onOpen}
          aria-label={t('projects.openLabel', { name: project.name })}
        >
          {t('projects.open')}
        </Button>
        <IconButton
          icon="reset"
          size="sm"
          label={t('projects.update')}
          onClick={() => onUpdate?.()}
          disabled={!onUpdate}
        />
        <IconButton
          icon="trash"
          size="sm"
          tone="danger"
          label={t('projects.delete', { name: project.name })}
          onClick={onDelete}
        />
      </div>
    </li>
  );
}
