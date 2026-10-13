import { useRef, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Segmented.module.css';

type Option<T extends string> = { value: T; label: string; icon?: IconName };

type Props<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Show icons only; labels become tooltips and accessible names. */
  iconOnly?: boolean;
  size?: 'sm' | 'md';
};

/** A radio group styled as a segmented control, with arrow-key navigation. */
export function Segmented<T extends string>({ label, value, options, onChange, iconOnly, size = 'md' }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={`${styles.group} ${styles[size]}`}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            className={styles.option}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.icon && <Icon name={option.icon} size={15} />}
            {!iconOnly && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
