import type { Stored } from '@/core/db/types';
import { useNow } from '@/core/focus/useNow';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Icon, categoryColor } from '@/ui';
import { pauseSession, resumeSession, stopSession } from '../repo';
import { sessionMinutes } from '../logic';
import type { Job, Session } from '../schema';
import { duration } from './format';
import styles from '../timetrack.module.css';

/** The running timer: name, since when, Pause/Weiter and Stopp. */
export function RunningCard({ session, job }: { session: Stored<Session>; job?: Stored<Job> }) {
  const nowMs = useNow(30_000);
  const name = job?.name ?? session.note ?? t.timetrack.noJob;
  return (
    <section className={styles.running} aria-label={t.timetrack.running} data-testid="running-card">
      <div>
        <p className={styles.runningName}>
          {job ? (
            <span
              className={styles.dot}
              style={{ background: categoryColor(job.tone) }}
              aria-hidden="true"
            />
          ) : null}{' '}
          {name}
        </p>
        <p className={styles.meta}>
          {session.pausedAt ? `${t.timetrack.paused} · ` : ''}
          {t.timetrack.since(session.startTime)} · {duration(sessionMinutes(session, nowMs))}
        </p>
      </div>
      <div className={styles.actions}>
        {session.pausedAt ? (
          <Button
            variant="secondary"
            onClick={() => void changeWithUndo(() => resumeSession(session))}
          >
            <Icon name="play" size={18} />
            {t.timetrack.resume}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void changeWithUndo(() => pauseSession(session))}
          >
            <Icon name="pause" size={18} />
            {t.timetrack.pause}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => {
            const minutes = sessionMinutes(session, now());
            void stopSession(session).then(() =>
              useUiStore.getState().toast(t.timetrack.stoppedToast(minutes)),
            );
          }}
        >
          <Icon name="close" size={18} />
          {t.timetrack.stop}
        </Button>
      </div>
    </section>
  );
}
