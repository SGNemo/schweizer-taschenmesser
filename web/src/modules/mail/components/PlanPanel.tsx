/**
 * A planned mail's panel under its ToDo's plan row (planner hub 2, package 4c; hand-off 04, COPY X12): the host mounts
 * it for a ToDo whose first `origin` link is a thread. Line 1 sender · day, line 2 the subject, then the newest
 * message's first lines as plain text from this device's cache – no HTML, no images, nothing fetched. „Antworten“
 * opens mail's own compose window over the planner (review, „Senden“, „Entwurf speichern“ as built: nothing is sent
 * or saved without a tap there); when the newest message is his own, „Beantwortet?“ and „Erledigt“ instead (the ToDo
 * is ticked through the bus, as on the mail row). Mail content stays in this module's component: the planner never
 * reads, copies, searches or logs it. The id is untrusted (`safeThreadId`).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { listMailAccounts } from '@/core/mail/accounts';
import { mailText } from '@/core/mail/prefill';
import { safeThreadId } from '@/core/mail/service';
import type { MailAccountRef } from '@/core/mail/types';
import { PanelLoading, PanelNote, PlanPanelFoot, usePlanRow } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { t } from '@/strings';
import { Button } from '@/ui';
import { closeAnswered } from '../answered';
import { DEMO_ACCOUNT, DEMO_EMAIL, loadThread, loadThreadBodies } from '../cache';
import type { ComposeState } from '../composeState';
import { personName, shortWhen, subjectOf } from '../format';
import { ComposeDialog } from './ComposeDialog';
import { composeOf } from './ThreadView';
import styles from './mail.module.css';

const DEMO_REF: MailAccountRef = { key: DEMO_ACCOUNT, connectorId: 'demo', email: DEMO_EMAIL };

/** The thread on this device: the account that holds it, its header and its newest cached message. */
async function readThread(raw: string) {
  const thread = safeThreadId(raw);
  if (!thread) return null;
  for (const account of [...(await listMailAccounts()), DEMO_REF]) {
    const th = await loadThread(account.key, thread);
    if (!th) continue;
    const newest = (await loadThreadBodies(account.key, thread)).at(-1);
    return { account, th, newest };
  }
  return null;
}

export default function MailPlanPanel({ id }: PlanPanelProps) {
  const row = usePlanRow();
  const read = useLiveQuery(() => readThread(id), [id]);
  const [compose, setCompose] = useState<{ state: ComposeState; title: string } | undefined>();
  if (read === undefined) return <PanelLoading />;
  // Not on this device (another device's cache, a foreign id): said, nothing fetched.
  if (read === null)
    return (
      <>
        <PanelNote>{t.planner.panel.unavailable}</PanelNote>
        <PlanPanelFoot />
      </>
    );
  const { account, th, newest } = read;
  // Plain text only, a few lines: the box clamps it to six (four in a narrow window).
  const body = newest ? mailText(newest, 1200) : th.snippet;
  const answered = !!th.lastFromMe && row?.moduleId === 'todos';
  return (
    <>
      <p className={styles.planMeta}>
        {personName(th.from)} · {shortWhen(th.date)}
      </p>
      <p className={styles.planSubject}>{subjectOf(th.subject)}</p>
      {body ? (
        <p className={styles.planBody} data-testid="mail-plan-body">
          {body}
        </p>
      ) : null}
      <PlanPanelFoot>
        {answered ? (
          <>
            <span className={styles.planMeta}>{t.mail.answered.question}</span>
            <Button variant="secondary" onClick={() => void closeAnswered(row!.id)}>
              {t.mail.answered.done}
            </Button>
          </>
        ) : newest ? (
          <Button
            variant="secondary"
            onClick={() => {
              const [state, title] = composeOf('reply', newest, account);
              setCompose({ state, title });
            }}
          >
            {t.mail.write.reply}
          </Button>
        ) : null}
      </PlanPanelFoot>
      {compose ? (
        <ComposeDialog
          account={account}
          initial={compose.state}
          title={compose.title}
          onClose={() => setCompose(undefined)}
        />
      ) : null}
    </>
  );
}
