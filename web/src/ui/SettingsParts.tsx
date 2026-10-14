/** Building blocks of the settings pages: one row layout for every setting, groups and the danger zone. */
import { ReadableText } from './ReadableText';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { t } from '@/strings';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { HelpHint } from './HelpHint';
import styles from './SettingsParts.module.css';

/**
 * Label and short description on the left, the control on the right (stacked on narrow containers).
 * `id` is the deep-link anchor (`<section>--<field>`). The control keeps its own accessible name
 * (`labelHidden`), so the visible label is not announced twice.
 */
export function SettingRow({
  id,
  label,
  description,
  hint,
  stacked,
  children,
}: {
  id?: string;
  label: string;
  description?: string;
  hint?: string;
  /** Control below the text instead of beside it (wide controls such as tile pickers). */
  stacked?: boolean;
  children?: ReactNode;
}) {
  return (
    <div id={id} className={[styles.row, stacked ? styles.stacked : ''].join(' ')}>
      <div className={styles.text}>
        <span className={styles.label}>
          {label}
          {hint ? <HelpHint text={hint} label={t.help.label} /> : null}
        </span>
        {description ? (
          <span className={styles.description}>
            <ReadableText text={description} />
          </span>
        ) : null}
      </div>
      {children ? <div className={styles.control}>{children}</div> : null}
    </div>
  );
}

/**
 * A titled block of a settings category. `bare` skips the card for content that brings its own cards
 * (the older sync / backup / AI sections).
 */
export function SettingsGroup({
  id,
  title,
  description,
  hint,
  bare,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  hint?: string;
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.group} aria-labelledby={id}>
      <header className={styles.groupHead}>
        {/* The heading carries the deep-link anchor; the page highlights its section. */}
        <h2 id={id}>{title}</h2>
        {hint ? <HelpHint text={hint} label={t.help.label} /> : null}
      </header>
      {description ? <p className={styles.groupDescription}>{description}</p> : null}
      {bare ? children : <div className={styles.card}>{children}</div>}
    </section>
  );
}

/** Destructive actions, set apart from the normal rows. */
export function DangerZone({ id, children }: { id?: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section id={id} className={styles.danger} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.dangerTitle}>
        {t.settings.danger.title}
      </h3>
      {children}
    </section>
  );
}

/** A click this soon after the second question appears is ignored (a double click is not two yeses). */
const ARM_MS = 600;

/**
 * Confirmation for irreversible actions: the first click on `confirmLabel` only asks once more
 * ("Bist du sicher?"); the action runs on the second, separate click. That second button works
 * only after a short moment, so one hasty double click can never confirm twice. `onConfirm` runs
 * once.
 */
export function DoubleConfirmDialog({
  open,
  onClose,
  title,
  confirmLabel,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setArmed(true), ARM_MS);
    return () => {
      clearTimeout(timer);
      setArmed(false);
    };
  }, [asking]);
  const close = () => {
    setAsking(false);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        asking ? (
          <>
            <Button onClick={() => setAsking(false)} data-autofocus>
              {t.settings.danger.back}
            </Button>
            <Button
              variant="danger"
              disabled={!armed || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close}>{t.actions.cancel}</Button>
            <Button variant="danger" onClick={() => setAsking(true)}>
              {confirmLabel}
            </Button>
          </>
        )
      }
    >
      {children}
      {asking ? (
        <div role="alert" data-testid="confirm-again">
          <p>
            <strong>{t.settings.danger.againTitle}</strong>
          </p>
          <p>{t.settings.danger.againText}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
