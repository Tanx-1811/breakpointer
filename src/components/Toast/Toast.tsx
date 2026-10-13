import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';

type ToastTone = 'info' | 'success' | 'error';

export type ToastOptions = {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onAction: () => void };
};

type ToastItem = ToastOptions & { id: number };

const MAX_TOASTS = 3;

const ToastContext = createContext<(toast: ToastOptions) => void>(() => {});

export function useToast() {
  return use(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback((toast: ToastOptions) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...toast, id }].slice(-MAX_TOASTS));
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      <div className={styles.region} role="region" aria-label={t('toast.region')}>
        <ol className={styles.list} aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </ol>
      </div>
    </ToastContext>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const duration = toast.action ? 8000 : 4500;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [paused, duration, onDismiss]);

  const tone = toast.tone ?? 'info';
  return (
    <li
      className={`${styles.toast} ${styles[tone]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon
        name={tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'info'}
        size={16}
        className={styles.icon}
      />
      <span className={styles.message}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action!.onAction();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <IconButton icon="close" size="sm" label={t('common.dismiss')} onClick={onDismiss} className={styles.close} />
    </li>
  );
}
