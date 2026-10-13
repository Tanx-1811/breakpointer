import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './ErrorState.module.css';

type Props = {
  icon: IconName;
  title: string;
  body: string;
  tone?: 'neutral' | 'danger';
  children?: ReactNode;
};

/** Centered message with actions, used for errors and empty workspaces. */
export function ErrorState({ icon, title, body, tone = 'neutral', children }: Props) {
  return (
    <div className={styles.state} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className={`${styles.icon} ${styles[tone]}`}>
        <Icon name={icon} size={22} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
