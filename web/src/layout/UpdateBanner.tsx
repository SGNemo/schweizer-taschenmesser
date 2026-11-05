import { installUpdate, postponeUpdate, useUpdateStore } from '@/core/update/controller';
import { parseReleaseNotes, type NoteSection } from '@/core/changelog/notes';
import { useInstalledBuild } from '@/core/changelog/useInstalledBuild';
import { useLang } from '@/core/i18n/lang';
import { dateTimeFormat } from '@/core/i18n/format';
import { t } from '@/strings';
import { Badge, Button, Icon, Progress } from '@/ui';
import { ReleaseNotes } from './ReleaseNotes';
import styles from './UpdateBanner.module.css';

/** Unobtrusive offer of a new version. Never forces anything; "Später" hides it for that version. */
export function UpdateBanner() {
  const lang = useLang();
  const installed = useInstalledBuild();
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
  const notes = parseReleaseNotes(info.notes, lang);
  const c = t.about.changes;
  const titleOf = (sec: NoteSection): string | undefined =>
    sec.build
      ? c.build(sec.build)
      : sec.unreleased
        ? c.unreleased
        : sec.version
          ? [
              c.version(sec.version),
              sec.date &&
                dateTimeFormat({ dateStyle: 'medium' }).format(new Date(`${sec.date}T00:00:00`)),
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined;
  const progress = state.phase === 'installing' ? state.progress : undefined;
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : undefined;

  return (
    <section className={styles.banner} aria-label={t.update.title} data-testid="update-banner">
      <div className={styles.head}>
        <span className={styles.plate} aria-hidden="true">
          <Icon name="sparkles" size={18} />
        </span>
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

      {notes.blocks.length > 0 ? (
        <details className={styles.notes} open>
          <summary>{t.update.whatsNew}</summary>
          <div className={styles.scroll}>
            {notes.sections.map((sec, i) => (
              <section key={i} className={styles.part}>
                {titleOf(sec) ? (
                  <p className={styles.version}>
                    {titleOf(sec)}{' '}
                    {sec.build && sec.build === installed ? <Badge>{c.installed}</Badge> : null}
                  </p>
                ) : null}
                <ReleaseNotes blocks={sec.blocks} />
              </section>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
