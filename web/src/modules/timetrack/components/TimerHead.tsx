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
  showStop = true,
}: {
  sessions: readonly Stored<Session>[];
  running?: Stored<Session>;
  firstJob?: Stored<Job>;
  /** False while the running card (with its own Stopp) is on the page. */
  showStop?: boolean;
}) {
  const d = new Date(now());
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return (
    <HeroSlot area="signature">
      <div className={styles.timerHead} data-testid="timer-head">
        <HourStrip
          events={sessions.map((s) => ({ time: s.startTime, endTime: s.endTime }))}
          now={hhmm}
        />
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
