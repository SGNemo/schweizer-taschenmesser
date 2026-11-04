import type { Stored } from '@/core/db/types';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Icon } from '@/ui';
import { HeroSlot, HourStrip } from '@/ui/identity';
import { sessionMinutes } from '../logic';
import { startSession, stopSession } from '../repo';
import type { Job, Session } from '../schema';
import styles from '../timetrack.module.css';

/**
 * Right half of the time head: today's sessions as blocks on the hour strip, and Start/Stopp as the one main action
 * (Start = the first project; the chips below pick another). Pause stays on the running card.
 */
export function TimerHead({
  sessions,
  running,
  firstJob,
}: {
  sessions: readonly Stored<Session>[];
  running?: Stored<Session>;
  firstJob?: Stored<Job>;
}) {
  const d = new Date(now());
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return (
    <HeroSlot>
      <div className={styles.timerHead} data-testid="timer-head">
        <HourStrip
          events={sessions.map((s) => ({ time: s.startTime, endTime: s.endTime }))}
          now={hhmm}
        />
        {running ? (
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
        ) : firstJob ? (
          <Button
            variant="primary"
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
