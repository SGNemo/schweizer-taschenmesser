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
import { formatAddress } from '@/core/mail/address';
import { withPrefix } from '@/core/mail/reply';
import { mailText } from '@/core/mail/prefill';
import { safeThreadId } from '@/core/mail/service';
import type { MailAccountRef, MailMessage } from '@/core/mail/types';
import {
  PanelLoading,
  PanelNote,
  PanelText,
  PlanPanelFoot,
  usePlanRow,
} from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Button } from '@/ui';
import { closeAnswered } from '../answered';
import { DEMO_ACCOUNT, DEMO_EMAIL, loadPlanThread, type CachedThreadView } from '../cache';
import { emptyCompose, type ComposeState } from '../composeState';
import { personName, shortWhen, subjectOf } from '../format';
import { QUEUE_PANEL } from '../pile';
import { openPlanCompose } from '../planCompose';
import { PlanQueue } from './PlanQueue';
import { settings } from '../settings';
import { composeOf } from './ThreadView';

const DEMO_REF: MailAccountRef = { key: DEMO_ACCOUNT, connectorId: 'demo', email: DEMO_EMAIL };

/** The thread on this device: the account that holds it, its header and its newest cached message. */
async function readThread(raw: string) {
  const thread = safeThreadId(raw);
  if (!thread) return null;
  const accounts = [...(await listMailAccounts()), DEMO_REF];
  const found = await loadPlanThread(
    accounts.map((a) => a.key),
    thread,
  );
  const account = accounts.find((a) => a.key === found?.accountKey);
  if (!found || !account) return null;
  return { account, th: found.view, newest: found.messages.at(-1) };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The newest message is his own: the cache's flag, or the sender address (a background refresh drops the flag). */
const mine = (th: CachedThreadView, account: MailAccountRef) =>
  !!th.lastFromMe || (!!account.email && same(th.from.email, account.email));

/**
 * The reply's start: from the newest cached message (quote, In-Reply-To), or – when its body is not on this device or
 * older than the header – from the header alone (to the sender, „Re: …“, same thread; no quote).
 */
function replyOf(
  th: CachedThreadView,
  newest: MailMessage | undefined,
  account: MailAccountRef,
): [ComposeState, string] {
  if (newest && newest.date >= th.date) return composeOf('reply', newest, account);
  return [
    emptyCompose({
      // His own message last: no guess at the recipient.
      to: mine(th, account) ? '' : formatAddress(th.from),
      subject: withPrefix('Re', th.subject),
      threadId: th.id,
    }),
    t.mail.write.compose.titleReply,
  ];
}

export default function MailPlanPanel(props: PlanPanelProps) {
  // The pile's queue line (package 2) is this module's panel under a fixed id no thread id can take.
  return props.id === QUEUE_PANEL ? <PlanQueue /> : <ThreadPanel {...props} />;
}

function ThreadPanel({ id }: PlanPanelProps) {
  const row = usePlanRow();
  const read = useLiveQuery(() => readThread(id), [id]);
  const [prefs] = useSettings('module.mail', settings.schema, settings.defaults);
  const [busy, setBusy] = useState(false);
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
  // Plain text only, its line breaks kept; the box clamps it to six lines (four in a narrow window). No `lang`: the
  // mail does not say its language.
  const fresh = newest && newest.date >= th.date ? newest : undefined;
  const body = fresh ? (fresh.text ?? mailText(fresh, 1200)).slice(0, 1200) : th.snippet;
  // „Beantwortet?“ as on the mail row: only while mail shows it (its setting) and the row is the ToDo.
  const showAnswered = (prefs as { showAnswered?: boolean } | undefined)?.showAnswered !== false;
  const answered = showAnswered && mine(th, account) && row?.moduleId === 'todos';
  const done = () => {
    if (busy || !row) return;
    setBusy(true);
    void closeAnswered(row.id).finally(() => setBusy(false));
  };
  return (
    <>
      <PanelText kind="meta">
        {personName(th.from)} · {shortWhen(th.date)}
      </PanelText>
      <PanelText kind="title">{subjectOf(th.subject)}</PanelText>
      {body ? (
        <PanelText kind="body" data-testid="mail-plan-body">
          {body}
        </PanelText>
      ) : null}
      <PlanPanelFoot>
        {answered ? (
          <>
            <PanelText kind="meta" as="span">
              {t.mail.answered.question}
            </PanelText>
            <Button
              variant="secondary"
              aria-busy={busy}
              disabled={busy}
              onClick={done}
              // As on the mail row: which mail is done, for a list of buttons (starts with the visible word).
              aria-label={t.mail.answered.doneFor(subjectOf(th.subject))}
            >
              {t.mail.answered.done}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              const [state, title] = replyOf(th, newest, account);
              openPlanCompose({ state, title, account });
            }}
          >
            {t.mail.write.reply}
          </Button>
        )}
      </PlanPanelFoot>
    </>
  );
}
