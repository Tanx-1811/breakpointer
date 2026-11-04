import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import { Icon } from '../Icon/Icon';
import styles from './AuditPanel.module.css';

type Props = {
  row: { name: string; width: number; height: number };
  /** For a narrow table column: the icon over the width, the name for assistive technology only. */
  compact?: boolean;
};

/** A preview as the audit's tabs name it: its size class, name and width. */
export function ViewportName({ row, compact }: Props) {
  const sizeClass = sizeClassOf(row.width, row.height);
  return (
    <span className={compact ? `${styles.viewport} ${styles.viewportCompact}` : styles.viewport} data-size-class={sizeClass}>
      <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={13} className={styles.viewportIcon} />
      <span className={compact ? 'visually-hidden' : styles.viewportName}>{row.name}</span>
      <span className={styles.viewportWidth}>{row.width}</span>
    </span>
  );
}
