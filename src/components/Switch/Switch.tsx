import { useId, type ReactNode } from 'react';
import styles from './Switch.module.css';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
};

export function Switch({ checked, onChange, label, description }: Props) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}
