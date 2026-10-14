import type { Ref, SelectHTMLAttributes } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Select.module.css';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: 'sm' | 'md';
  /** Icon shown before the value. */
  icon?: IconName;
  /** Monospaced value (numbers such as zoom levels). */
  mono?: boolean;
  /** Fills its container. */
  wide?: boolean;
  selectRef?: Ref<HTMLSelectElement>;
};

/**
 * A native <select> (keyboard, screen readers and the options list come from
 * the browser) with the product's look: a custom chevron and an optional icon.
 */
export function Select({ size = 'md', icon, mono, wide, className, selectRef, children, ...rest }: Props) {
  return (
    <span
      className={[styles.wrap, styles[size], icon && styles.withIcon, wide && styles.wide, className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 15} className={styles.icon} />}
      <select ref={selectRef} className={['field', styles.select, mono && styles.mono].filter(Boolean).join(' ')} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={14} className={styles.chevron} />
    </span>
  );
}
