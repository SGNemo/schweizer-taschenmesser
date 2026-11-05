import type { Stored } from '@/core/db/types';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Icon } from '@/ui';
import { HeroSlot, Stopwatch } from '@/ui/identity';
import { sessionMinutes } from '../logic';
import { startSession, stopSession } from '../repo';
import type { Job, Session } from '../schema';
import styles from '../timetrack.module.css';

/** A working day for the dial: the arc is full after eight tracked hours (shape only; the figure says the time). */
const DAY_MINUTES = 8 * 60;

/**
 * The signature slot of the time head: a stopwatch dial whose arc is today's tracked time (C25: a round shape of its
 * own, not the calendar's hour strip), and Start/Stopp as the one main action of the page (C29; Start = the first
 * project, the tiles below pick another). Pause stays on the running card.
 */
export function TimerHead({
  sessions,
  running,
  firstJob,
  showStop = true,
}: {
  sessions: readonly Stored<Session>[];
  running?: Stored<Session>;
  firstJob?: Stored<Job>;
  /** False while the running card (with its own Stopp) is on the page. */
  showStop?: boolean;
}) {
  const at = now();
  const tracked = sessions.reduce((sum, s) => sum + sessionMinutes(s, at), 0);
  return (
    <HeroSlot area="signature">
      <div className={styles.timerHead} data-testid="timer-head">
        <Stopwatch fill={tracked / DAY_MINUTES} running={!!running && !running.pausedAt} />
        {running ? (
          showStop ? (
            <Button
              variant="primary"
              onClick={() => {
                const minutes = sessionMinutes(running, now());
                void stopSession(running).then(() =>
                  useUiStore.getState().toast(t.timetrack.stoppedToast(minutes)),
                );
              }}
            >
              <Icon name="close" size={18} />
              {t.timetrack.stop}
            </Button>
          ) : null
        ) : firstJob ? (
          <Button
            variant="primary"
            aria-label={`${t.timetrack.start}: ${firstJob.name}`}
            onClick={() =>
              void startSession(firstJob.id).then(() =>
                useUiStore.getState().toast(t.timetrack.startedToast(firstJob.name)),
              )
            }
          >
            <Icon name="play" size={18} />
            {t.timetrack.start}
          </Button>
        ) : null}
      </div>
    </HeroSlot>
  );
}
