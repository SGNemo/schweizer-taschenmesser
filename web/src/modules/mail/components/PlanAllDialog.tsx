import { useState } from 'react';
import { t } from '@/strings';
import { Button, Checkbox, Dialog } from '@/ui';
import type { CachedThreadView } from '../cache';
import styles from './mail.module.css';

/**
 * „Alle in den Plan…“: the mails of the folder or filter with a tick each – personal senders ticked, bulk
 * mail and mails already in the plan not – and one button. Nothing is written before that button.
 */
export function PlanAllDialog({
  threads,
  planned,
  titleOf,
  onPlan,
  onClose,
}: {
  threads: readonly CachedThreadView[];
  planned: ReadonlySet<string>;
  /** Exactly the title the ToDo would get (never an address). */
  titleOf: (th: CachedThreadView) => string;
  onPlan: (picked: CachedThreadView[]) => void;
  onClose: () => void;
}) {
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(threads.filter((th) => th.personal && !planned.has(th.id)).map((th) => th.id)),
  );
  const toggle = (id: string, on: boolean) =>
    setTicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const picked = threads.filter((th) => ticked.has(th.id));
  return (
    <Dialog open onClose={onClose} title={t.mail.plan.allTitle} size="roomy">
      <p className={styles.hint}>{t.mail.plan.allIntro}</p>
      <ul className={styles.planList} data-testid="mail-plan-all">
        {threads.map((th, i) => (
          <li key={th.id}>
            <Checkbox
              data-autofocus={i === 0 || undefined}
              label={planned.has(th.id) ? `${titleOf(th)} · ${t.mail.plan.mark}` : titleOf(th)}
              checked={ticked.has(th.id)}
              onChange={(e) => toggle(th.id, e.target.checked)}
            />
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button variant="primary" disabled={picked.length === 0} onClick={() => onPlan(picked)}>
          {t.mail.plan.allSave(picked.length)}
        </Button>
      </div>
    </Dialog>
  );
}
