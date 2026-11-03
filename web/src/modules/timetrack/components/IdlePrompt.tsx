import type { Stored } from '@/core/db/types';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button } from '@/ui';
import { useIdle } from '../idle';
import { sessionRepo, stopSession } from '../repo';
import type { Session } from '../schema';
import styles from '../timetrack.module.css';

/**
 * "Warst du die ganze Zeit dabei?": opens after a gap while the timer ran. Three plain choices, the
 * first one changes nothing; the app never corrects the time by itself.
 */
export function IdlePrompt({ session }: { session: Stored<Session> }) {
  const { since, minutes, clear } = useIdle();
  if (since === null) return null;
  return (
    <section className={styles.idle} aria-labelledby="idle-title" data-testid="idle-prompt">
      <h2 id="idle-title">{t.timetrack.idle.title}</h2>
      <p className={styles.meta}>{t.timetrack.idle.body(minutes)}</p>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={clear}>
          {t.timetrack.idle.keep}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void changeWithUndo(() =>
              sessionRepo.update(session.id, { breakMin: session.breakMin + minutes }),
            );
            clear();
          }}
        >
          {t.timetrack.idle.deduct}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void changeWithUndo(() => stopSession(session, since));
            clear();
          }}
        >
          {t.timetrack.idle.stopAt}
        </Button>
      </div>
    </section>
  );
}
