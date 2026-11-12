import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { donePatch, isDue, sortRoutines, turnState, whoseTurn } from '../logic';
import { routineRepo } from '../repo';

/**
 * Home-screen widget (catalogue type checklist): what is due today, ticked in place. A tick is "Erledigt" (next
 * day, next name); the toast's "Rückgängig" puts the routine back as it was. No red, no count of days.
 */
export default function RoutinesWidget() {
  const day = today();
  const all = useLiveQuery(() => routineRepo.active().toArray(), []);
  const due = sortRoutines(all ?? [], day).filter((r) => isDue(r, day));
  // What a tick replaced, kept until the toast is gone, so "Rückgängig" restores it exactly.
  const before = new Map(due.map((r) => [r.id, turnState(r)]));
  return (
    <ChecklistWidget
      loading={!all}
      empty={all && all.length > 0 ? t.routines.nothingDue : t.routines.empty}
      emptyAction={
        all && all.length > 0 ? undefined : { label: t.routines.add, to: '/routines?new=1' }
      }
      summary={due.length ? t.routines.widgetSummary(due.length, all?.length ?? 0) : undefined}
      entries={due.map((r) => {
        const who = whoseTurn(r);
        return { key: r.id, title: who ? `${r.name} · ${who}` : r.name, checked: false };
      })}
      doneMessage={(title) => t.routines.doneToast(title.split(' · ')[0] ?? title)}
      onToggle={async (id, checked) => {
        const r = due.find((x) => x.id === id);
        if (checked && r) await routineRepo.update(id, donePatch(r, day));
        else if (!checked && before.has(id)) await routineRepo.update(id, before.get(id)!);
      }}
    />
  );
}
