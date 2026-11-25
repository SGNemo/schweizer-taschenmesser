/**
 * Mail's strip at the foot of the planner page (`contributions.planPageFoot`, planner hub 2, package 4c): the send
 * window of a reply written from a plan row („Wird gesendet … · Zurückziehen“, `PendingSendBar`), mounted once by the
 * page so closing the row never hides it. „Zurückziehen“ reopens mail's own compose window over the planner with the
 * withdrawn text, so nothing typed is lost.
 */
import { useState } from 'react';
import type { MailAccountRef } from '@/core/mail/types';
import { t } from '@/strings';
import type { ComposeState } from '../composeState';
import { ComposeDialog } from './ComposeDialog';
import { PendingSendBar } from './PendingSendBar';

export default function MailPlanFoot() {
  const [compose, setCompose] = useState<
    { state: ComposeState; account: MailAccountRef } | undefined
  >();
  return (
    <>
      <PendingSendBar onReopen={(state, account) => setCompose({ state, account })} />
      {compose ? (
        <ComposeDialog
          account={compose.account}
          initial={compose.state}
          title={t.mail.write.compose.titleReply}
          onClose={() => setCompose(undefined)}
        />
      ) : null}
    </>
  );
}
