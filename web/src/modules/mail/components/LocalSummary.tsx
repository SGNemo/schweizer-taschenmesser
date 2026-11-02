import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { summarizeMail, type LocalAnswer } from '@/core/mail/localAssist';
import type { MailMessage } from '@/core/mail/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './mail.module.css';

type State =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'done'; answer: LocalAnswer }
  | { phase: 'none' }
  | { phase: 'failed' };

/**
 * "Kurz zusammenfassen" (only offered when the user switched the local model on): the mail goes to the
 * local model on this machine and nowhere else; the answer is shown here and not stored. No local model
 * ready = a hint, never another model.
 */
export function LocalSummary({ message }: { message: MailMessage }) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => abort.current?.abort(), []);

  async function run() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ phase: 'working' });
    try {
      const answer = await summarizeMail(message, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState(answer ? { phase: 'done', answer } : { phase: 'none' });
    } catch {
      if (!controller.signal.aborted) setState({ phase: 'failed' });
    }
  }

  if (state.phase === 'idle')
    return (
      <div className={styles.row}>
        <Button onClick={() => void run()}>{t.mail.local.summarize}</Button>
        <span className={styles.hint}>{t.mail.local.privacy}</span>
      </div>
    );
  if (state.phase === 'working')
    return (
      <p className={styles.hint} role="status">
        {t.mail.local.working}
      </p>
    );
  return (
    <section className={styles.notice} data-testid="mail-local-summary" aria-live="polite">
      {state.phase === 'done' ? (
        <>
          <strong>
            {t.mail.local.title(
              state.answer.source === 'built-in' ? t.mail.local.builtIn : t.mail.local.ollama,
            )}
          </strong>
          <p>{state.answer.text}</p>
          <p className={styles.hint}>{t.mail.local.notStored}</p>
        </>
      ) : state.phase === 'none' ? (
        <>
          <p>{t.mail.local.none}</p>
          <Link to={settingsPath('ki', 'ai-local')}>{t.mail.local.noneAction}</Link>
        </>
      ) : (
        <p role="alert">{t.mail.local.failed}</p>
      )}
      <Button onClick={() => setState({ phase: 'idle' })}>{t.mail.local.close}</Button>
    </section>
  );
}
