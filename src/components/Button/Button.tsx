import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: IconName;
  children: ReactNode;
};

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      <span>{children}</span>
    </button>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName;
  /** Accessible name; also shown as the tooltip. */
  label: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
};

export function IconButton({ icon, label, size = 'md', tone = 'default', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[styles.iconButton, styles[`icon-${size}`], tone === 'danger' && styles.dangerTone, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : 17} />
    </button>
  );
}
