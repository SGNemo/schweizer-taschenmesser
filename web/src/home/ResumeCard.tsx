import { useNavigate } from 'react-router';
import { dismissContext, isAway, shouldOfferResume, useResumeContext } from '@/core/focus/context';
import { isOver } from '@/core/focus/session';
import { useFocusSession } from '@/core/focus/state';
import { useFocusSettings } from '@/core/settings/focus';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './ResumeCard.module.css';

/**
 * "Woran war ich?": after a longer break the home screen offers the way back to where the user
 * was (and a focus round that is still open). A question, never an alarm; "Nein, danke" ends it.
 */
export function ResumeCard() {
  const [settings] = useFocusSettings();
  const ctx = useResumeContext();
  const session = useFocusSession();
  const navigate = useNavigate();
  if (!settings.resumeCard || ctx === undefined || session === undefined) return null;
  const place = shouldOfferResume(ctx ?? undefined, now()) ? ctx : null;
  // A focus round that is still open is mentioned after the same kind of break.
  const running = isAway(ctx ?? undefined, now()) && session?.path ? session : null;
  const target = place?.path ?? running?.path;
  if (!target) return null;
  return (
    <section className={styles.card} aria-label={t.focus.resume.title} data-testid="resume-card">
      <div className={styles.text}>
        <span className={styles.title}>{t.focus.resume.title}</span>
        {place ? <span className={styles.meta}>{t.focus.resume.last(place.title)}</span> : null}
        {running ? (
          <span className={styles.meta}>
            {t.focus.resume.focusRunning(running.title)}
            {isOver(running, now()) ? ` · ${t.focus.mode.timeUp}` : ''}
          </span>
        ) : null}
      </div>
      <div className={styles.actions}>
        <Button
          variant="primary"
          onClick={() => {
            void dismissContext();
            void navigate(target);
          }}
        >
          {t.focus.resume.back}
        </Button>
        <Button variant="ghost" onClick={() => void dismissContext()}>
          {t.focus.resume.dismiss}
        </Button>
      </div>
    </section>
  );
}
