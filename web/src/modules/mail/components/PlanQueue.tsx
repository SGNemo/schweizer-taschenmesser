/**
 * Mail's queue line in the planner's „E-Mails durchgehen“ (planner hub 2, package 2, CONCEPT-ROWS idea 2 (7)): COPY P3
 * „4 warten“, the button P15 „In den Plan … (4)“ and the jump P8. P15 opens this module's own `PlanAllDialog` over the
 * planner – one tick per mail, bulk mail and mails whose ToDo was deleted unticked, nothing written before the dialog's
 * own button; afterwards those mails are ToDos and stand in the pile as member lines. Mail's code all the way.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { PanelLoading } from '@/core/modules/PlanPanelHost';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, PanelLine, PanelLines } from '@/ui';
import type { CachedThreadView } from '../cache';
import { deletedThreads, planMany, plannedThreads, planTitle } from '../planMail';
import { QUEUE_ROUTE, waitingQueue } from '../queue';
import { PlanAllDialog } from './PlanAllDialog';

async function readQueue() {
  const accounts = await Promise.all(
    (await waitingQueue()).map(async ({ account, threads }) => ({
      account,
      threads,
      planned: await plannedThreads(account.key),
      deleted: await deletedThreads(threads.map((th) => th.id)),
    })),
  );
  // The line counts what is not in the plan yet; a mail in the plan is a member line of its own.
  const count = accounts.reduce(
    (n, a) => n + a.threads.filter((th) => !a.planned.has(th.id)).length,
    0,
  );
  return { accounts, count };
}

export function PlanQueue() {
  const states = useModuleStates();
  const queue = useLiveQuery(readQueue, []);
  // One dialog per account (its ToDos carry that account's link); the first with waiting mail first.
  const [open, setOpen] = useState<number | undefined>();
  if (queue === undefined) return <PanelLoading />;
  const name = t.mail.meta.name;
  // The next account (after `after`) with a mail not in the plan yet: one dialog per account, one after another.
  const nextWaiting = (after: number) => {
    const i = queue.accounts.findIndex(
      (a, idx) => idx > after && a.threads.some((th) => !a.planned.has(th.id)),
    );
    return i < 0 ? undefined : i;
  };
  const dialog = open === undefined ? undefined : queue.accounts[open];
  return (
    <>
      <PanelLines>
        <PanelLine
          action={
            queue.count > 0 ? (
              <Button variant="ghost" onClick={() => setOpen(nextWaiting(-1))}>
                {t.planner.pile.planAll(queue.count)}
              </Button>
            ) : undefined
          }
          expand={<Link to={QUEUE_ROUTE}>{t.planner.pile.jump(name)}</Link>}
        >
          {t.planner.pile.waiting(queue.count)}
        </PanelLine>
      </PanelLines>
      {dialog ? (
        <PlanAllDialog
          threads={dialog.threads}
          titleOf={(th: CachedThreadView) => planTitle(dialog.account, th)}
          planned={dialog.planned}
          deleted={dialog.deleted}
          plannerOn={!!states?.planner}
          onClose={() => setOpen(undefined)}
          onPlan={(picked) => {
            const at = open!;
            setOpen(nextWaiting(at));
            // A failed save says so in mail's own words (no content); nothing half-written stays (planMany's undo).
            planMany(dialog.account, picked, () => undefined, dialog.deleted).catch(() =>
              useUiStore.getState().toast(t.mail.plan.failed),
            );
          }}
        />
      ) : null}
    </>
  );
}
