import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  /** Icon after the label (e.g. a chevron). */
  iconEnd?: IconName;
  /** Keyboard shortcut shown in the tooltip. */
  shortcut?: string;
  /** Tooltip text; defaults to none (the label is visible). */
  tooltip?: string;
  children: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  shortcut,
  tooltip,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      type="button"
      className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      data-tooltip={tooltip}
      data-shortcut={shortcut}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      <span className={styles.label}>{children}</span>
      {iconEnd && <Icon name={iconEnd} size={iconSize - 2} className={styles.iconEnd} />}
    </button>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName;
  /** Accessible name; also shown as the tooltip. */
  label: string;
  /** Keyboard shortcut shown in the tooltip. */
  shortcut?: string;
  size?: 'xs' | 'sm' | 'md';
  tone?: 'default' | 'danger' | 'accent';
  variant?: 'ghost' | 'secondary';
  /** Toggle buttons: exposes aria-pressed and the "on" style. */
  pressed?: boolean;
};

export function IconButton({
  icon,
  label,
  shortcut,
  size = 'md',
  tone = 'default',
  variant = 'ghost',
  pressed,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={label}
      data-shortcut={shortcut}
      className={[
        styles.iconButton,
        styles[`icon-${size}`],
        variant === 'secondary' && styles.iconSecondary,
        tone === 'danger' && styles.dangerTone,
        tone === 'accent' && styles.accentTone,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <Icon name={icon} size={size === 'md' ? 17 : size === 'sm' ? 15 : 14} />
    </button>
  );
}
