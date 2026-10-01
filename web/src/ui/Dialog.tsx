import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '@/strings';
import { IconButton } from './Button';
import { Icon } from './icons';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `sheet` slides up from the bottom on phones; `full` fills the screen (setup assistant). */
  variant?: 'center' | 'sheet' | 'full';
  /** `wide` lets a `sheet` grow to 900 px from 900 px viewport width (tools). */
  size?: 'default' | 'wide';
  /** Shown in the header before the title (e.g. a back button). */
  headerStart?: ReactNode;
}

/** Modal built on the native <dialog>: focus trap, Esc handling and inert background for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'center',
  size = 'default',
  headerStart,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      // React's autoFocus runs before the dialog is open, so focus explicitly afterwards.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={[
        styles.dialog,
        variant === 'sheet' ? styles.sheet : '',
        variant === 'full' ? styles.full : '',
        size === 'wide' ? styles.wide : '',
      ].join(' ')}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className={styles.inner}>
          <div className={styles.head}>
            {headerStart}
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton label={t.actions.close} onClick={onClose}>
              <Icon name="close" />
            </IconButton>
          </div>
          {children}
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
