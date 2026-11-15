import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, ItemList, ItemRow } from '@/ui';
import { PRESETS, presetTemplates, weekdayOrder, type PresetId } from '../plan';
import { templateRepo } from '../repo';
import type { Template } from '../schema';
import styles from '../fitness.module.css';

/**
 * „Trainingsplan“ (deep package 3): weekdays per template as seven toggles, saved on every tap; three
 * splits to start with. Nothing here creates a session – a plan day only shows until it is done.
 */
export function PlanDialog({
  open,
  templates,
  weekStart,
  onClose,
}: {
  open: boolean;
  templates: readonly Stored<Template>[];
  weekStart: 1 | 7;
  onClose: () => void;
}) {
  const p = t.fitness.plan;
  const order = weekdayOrder(weekStart);

  async function toggle(id: string, wd: number) {
    // From the stored record: two quick taps on one template never undo each other.
    const days = (await templateRepo.get(id))?.weekdays ?? [];
    const next = days.includes(wd) ? days.filter((d) => d !== wd) : [...days, wd];
    await templateRepo.update(id, { weekdays: next.length ? next.sort() : undefined });
  }

  async function apply(id: PresetId) {
    const list = presetTemplates(id);
    await undoableWithToast(p.preset[id].name, p.applied(list.length), async () => {
      // Read now, not from the last render: a second tap finds the templates the first one made.
      const stored = await templateRepo.active().toArray();
      for (const tpl of list) {
        // A template of the same title keeps its exercises and gets the preset's days.
        const same = stored.find(
          (x) => x.title.trim().toLocaleLowerCase() === tpl.title.toLocaleLowerCase(),
        );
        if (same) await templateRepo.update(same.id, { weekdays: tpl.weekdays });
        else await templateRepo.create(tpl);
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={p.title}>
      <p className={styles.hint}>{p.intro}</p>
      {templates.length === 0 ? <p>{p.none}</p> : null}
      {templates.length ? (
        <ul className={styles.planList} data-testid="fitness-plan">
          {templates.map((tpl) => (
            <li key={tpl.id} className={styles.planRow}>
              <p className={styles.groupLabel}>
                {tpl.title}
                {tpl.weekdays?.length ? null : (
                  <span className={styles.hint}> · {p.notInPlan}</span>
                )}
              </p>
              <div className={styles.weekdays} role="group" aria-label={tpl.title}>
                {order.map((wd) => (
                  <button
                    key={wd}
                    type="button"
                    className={styles.weekday}
                    aria-pressed={!!tpl.weekdays?.includes(wd)}
                    aria-label={p.dayToggle(tpl.title, p.weekdayNames[wd - 1]!)}
                    onClick={() => void toggle(tpl.id, wd)}
                  >
                    {p.weekdays[wd - 1]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.groupLabel}>{p.presets}</p>
      <p className={styles.hint}>{p.presetHint}</p>
      <ItemList>
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <ItemRow
            key={id}
            title={p.preset[id].name}
            meta={p.preset[id].detail}
            end={
              <Button
                size="sm"
                variant="secondary"
                aria-label={p.presetUseFor(p.preset[id].name)}
                onClick={() => void apply(id)}
              >
                {p.presetUse}
              </Button>
            }
          />
        ))}
      </ItemList>
    </Dialog>
  );
}
