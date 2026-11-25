/**
 * Mail's strip at the foot of the planner page (`contributions.planPageFoot`, planner hub 2, package 4c), mounted once by
 * the page so closing a row never hides it:
 *  - the compose window a plan row opened („Antworten“, `planCompose.ts`) – outside the row, so Esc or a row that
 *    leaves never takes a typed reply along;
 *  - the send window of a confirmed reply („Wird gesendet … · Zurückziehen“, `PendingSendBar`): „Zurückziehen“
 *    reopens the compose window with the withdrawn text, so nothing typed is lost.
 */
import { useEffect } from 'react';
import { t } from '@/strings';
import { closePlanCompose, openPlanCompose, usePlanCompose } from '../planCompose';
import { ComposeDialog } from './ComposeDialog';
import { PendingSendBar } from './PendingSendBar';

export default function MailPlanFoot() {
  const open = usePlanCompose((s) => s.open);
  // Leaving the planner takes an open window along (its text lives in the window): it never pops up on the next visit.
  useEffect(() => () => usePlanCompose.setState({ open: undefined, returnTo: undefined }), []);
  return (
    <>
      <PendingSendBar
        // The bar also holds a mail sent from the mail page a moment ago: the neutral title, as the mail page uses.
        onReopen={(state, account) =>
          openPlanCompose({ state, account, title: t.mail.write.compose.titleNew })
        }
      />
      {open ? (
        <ComposeDialog
          account={open.account}
          initial={open.state}
          title={open.title}
          onClose={closePlanCompose}
        />
      ) : null}
    </>
  );
}
