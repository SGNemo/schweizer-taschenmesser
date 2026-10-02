/** Building blocks of the settings pages: one row layout for every setting, groups and the danger zone. */
import { useId, useState, type ReactNode } from 'react';
import { t } from '@/strings';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextField } from './Fields';
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
  children,
}: {
  id?: string;
  label: string;
  description?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div id={id} className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>
          {label}
          {hint ? <HelpHint text={hint} label={t.help.label} /> : null}
        </span>
        {description ? <span className={styles.description}>{description}</span> : null}
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

/**
 * Confirmation that needs the exact phrase to be typed (irreversible actions). The confirm button
 * stays disabled until the phrase matches; `onConfirm` runs once.
 */
export function TypedConfirmDialog({
  open,
  onClose,
  title,
  phrase,
  confirmLabel,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  phrase: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button onClick={close}>{t.actions.cancel}</Button>
          <Button
            variant="danger"
            disabled={typed.trim() !== phrase || busy}
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
      }
    >
      {children}
      <TextField
        label={t.settings.danger.typePhrase(phrase)}
        value={typed}
        autoComplete="off"
        data-autofocus
        onChange={(e) => setTyped(e.target.value)}
      />
    </Dialog>
  );
}
