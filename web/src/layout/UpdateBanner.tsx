import { useState } from 'react';
import { installUpdate, postponeUpdate, useUpdateStore } from '@/core/update/controller';
import { parseReleaseNotes, type NoteSection } from '@/core/changelog/notes';
import { useInstalledBuild } from '@/core/changelog/useInstalledBuild';
import { useLang } from '@/core/i18n/lang';
import { dateTimeFormat } from '@/core/i18n/format';
import { t } from '@/strings';
import { Badge, Button, Icon, Progress } from '@/ui';
import { ReleaseNotes } from './ReleaseNotes';
import styles from './UpdateBanner.module.css';

/** Without a known installed build (not a preview install) only the newest builds are shown first. */
const UNKNOWN_BASE_BUILDS = 10;

/** Unobtrusive offer of a new version. Never forces anything; "Später" hides it for that version. */
export function UpdateBanner() {
  const lang = useLang();
  const installed = useInstalledBuild();
  const [showAll, setShowAll] = useState(false);
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
  // What the update brings: every build since the installed one (it ends the list, marked), newest first, scrollable;
  // nothing older. Without a known installed build the newest few, the rest on request.
  const withBuild = notes.sections.filter((sec) => sec.build !== undefined);
  const fresh = notes.sections.filter((sec) => !(sec.build && installed && sec.build < installed));
  const unknownBase = installed === undefined && withBuild.length > UNKNOWN_BASE_BUILDS;
  const visible = unknownBase && !showAll ? fresh.slice(0, UNKNOWN_BASE_BUILDS) : fresh;
  const renderSection = (sec: NoteSection, i: number) => (
    <section key={`${sec.build ?? sec.version ?? 'x'}-${i}`} className={styles.part}>
      {titleOf(sec) ? (
        <p className={sec.blocks.length === 0 ? styles.versionEmpty : styles.version}>
          {titleOf(sec)}{' '}
          {sec.build && sec.build === installed ? <Badge>{c.installed}</Badge> : null}
          {sec.blocks.length === 0 ? <span className={styles.muted}> · {c.noChanges}</span> : null}
        </p>
      ) : null}
      {sec.blocks.length > 0 ? <ReleaseNotes blocks={sec.blocks} /> : null}
    </section>
  );
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
            {visible.map(renderSection)}
            {visible.length < fresh.length ? (
              <Button variant="ghost" onClick={() => setShowAll(true)}>
                {c.showMore} ({fresh.length - visible.length})
              </Button>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
