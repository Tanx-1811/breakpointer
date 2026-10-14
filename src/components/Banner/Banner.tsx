import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Banner.module.css';

type Props = {
  tone: 'danger' | 'warning' | 'info';
  icon: IconName;
  children: ReactNode;
  actions?: ReactNode;
  testId?: string;
};

/** A full-width message strip between the toolbars and the workspace. */
export function Banner({ tone, icon, children, actions, testId }: Props) {
  return (
    <div
      className={`${styles.banner} ${styles[tone]}`}
      role={tone === 'danger' ? 'alert' : 'note'}
      data-testid={testId}
    >
      <Icon name={icon} size={16} className={styles.icon} />
      <div className={styles.text}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
