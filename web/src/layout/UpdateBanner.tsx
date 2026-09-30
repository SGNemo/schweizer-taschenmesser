import { installUpdate, postponeUpdate, useUpdateStore } from '@/core/update/controller';
import { notesPreview } from '@/core/update/notes';
import { t } from '@/strings';
import { Badge, Button, Progress } from '@/ui';
import styles from './UpdateBanner.module.css';

/** Unobtrusive offer of a new version. Never forces anything; "Später" hides it for that version. */
export function UpdateBanner() {
  const state = useUpdateStore((s) => s.state);
  // Only these phases belong to an offered update; everything else shows nothing here.
  const info =
    state.phase === 'available' ||
    state.phase === 'installing' ||
    state.phase === 'needs-permission' ||
    state.phase === 'error'
      ? state.info
      : undefined;
  if (!info) return null;
  const busy = state.phase === 'installing';
  const preview = notesPreview(info.notes);
  const progress = state.phase === 'installing' ? state.progress : undefined;
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : undefined;

  return (
    <section className={styles.banner} aria-label={t.update.title} data-testid="update-banner">
      <div className={styles.head}>
        <span className={styles.title}>
          {t.update.available(info.version)}{' '}
          {info.prerelease ? <Badge>{t.update.beta}</Badge> : null}
        </span>
        <div className={styles.actions}>
          <Button variant="primary" disabled={busy} onClick={() => void installUpdate(info)}>
            {state.phase === 'error' ? t.update.retry : t.update.updateNow}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void postponeUpdate(info)}>
            {t.update.later}
          </Button>
        </div>
      </div>

      {state.phase === 'installing' ? (
        <p role="status" className={styles.status}>
          {state.step === 'backup'
            ? t.update.backingUp
            : state.step === 'handover'
              ? t.update.handover
              : pct !== undefined
                ? t.update.downloadingPercent(pct)
                : t.update.downloading}
        </p>
      ) : null}
      {progress && pct !== undefined ? (
        <Progress value={progress.downloaded} max={progress.total} label={t.update.downloading} />
      ) : null}
      {state.phase === 'needs-permission' ? (
        <p role="alert" className={styles.status}>
          {t.update.needsPermission}
        </p>
      ) : null}
      {state.phase === 'error' ? (
        <p role="alert" className={styles.error}>
          {t.update.errors[state.code]}
        </p>
      ) : null}

      {preview.length > 0 ? (
        <details className={styles.notes}>
          <summary>{t.update.whatsNew}</summary>
          <ul>
            {preview.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
