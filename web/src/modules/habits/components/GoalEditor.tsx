import { changedFields } from '@/core/db/patch';
import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { weekdayShort } from '@/core/recurrence/describe';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { AdvancedFields, Button, Dialog, Form, FormActions, SelectField, TextField } from '@/ui';
import { entryRepo, goalRepo } from '../repo';
import { goalSchema, type Goal } from '../schema';
import styles from '../habits.module.css';

export type GoalTarget = Stored<Goal> | 'new' | null;

type TemplateId = 'water' | 'walk' | 'stretch' | 'pill';
/** Starting points; the name and unit come from the strings, the rest is fixed here. */
const TEMPLATES: Record<TemplateId, Partial<Goal>> = {
  water: {
    kind: 'count',
    target: 8,
    reminder: { kind: 'window', from: '09:00', to: '19:00', everyMin: 120 },
  },
  walk: { kind: 'yesno', target: 1, weekdays: [1, 2, 3, 4, 5] },
  stretch: { kind: 'yesno', target: 1, period: 'week', weeklyTimes: 3 },
  pill: { kind: 'yesno', target: 1, reminder: { kind: 'time', time: '08:00' } },
};

export function GoalEditor({
  target,
  nextOrder,
  onClose,
}: {
  target: GoalTarget;
  nextOrder: number;
  onClose: () => void;
}) {
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={target === 'new' || target === null ? t.habits.add : t.habits.edit}
    >
      {target ? (
        <Fields
          key={target === 'new' ? 'new' : target.id}
          target={target}
          nextOrder={nextOrder}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  nextOrder,
  onClose,
}: {
  target: NonNullable<GoalTarget>;
  nextOrder: number;
  onClose: () => void;
}) {
  const existing = target === 'new' ? null : target;
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(existing);
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<Goal['kind']>(existing?.kind ?? 'yesno');
  const [goal, setGoal] = useState(String(existing?.target ?? 1));
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [period, setPeriod] = useState<Goal['period']>(existing?.period ?? 'day');
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? []);
  const [weekly, setWeekly] = useState(String(existing?.weeklyTimes ?? 3));
  const [remKind, setRemKind] = useState<'off' | 'time' | 'window'>(
    existing?.reminder?.kind ?? 'off',
  );
  const rem = existing?.reminder;
  const [time, setTime] = useState(rem?.kind === 'time' ? rem.time : '08:00');
  const [from, setFrom] = useState(rem?.kind === 'window' ? rem.from : '09:00');
  const [to, setTo] = useState(rem?.kind === 'window' ? rem.to : '19:00');
  const [every, setEvery] = useState(String(rem?.kind === 'window' ? rem.everyMin : 120));
  const [error, setError] = useState('');

  function template(id: TemplateId) {
    const tpl = TEMPLATES[id];
    setName(t.habits.templates[id].name);
    setUnit(t.habits.templates[id].unit);
    setKind(tpl.kind ?? 'yesno');
    setGoal(String(tpl.target ?? 1));
    setPeriod(tpl.period ?? 'day');
    setWeekdays(tpl.weekdays ?? []);
    setWeekly(String(tpl.weeklyTimes ?? 3));
    const r = tpl.reminder;
    setRemKind(r?.kind ?? 'off');
    if (r?.kind === 'time') setTime(r.time);
    if (r?.kind === 'window') {
      setFrom(r.from);
      setTo(r.to);
      setEvery(String(r.everyMin));
    }
  }

  async function save() {
    const data = {
      name: name.trim(),
      kind,
      target: kind === 'count' ? Number(goal) || 1 : 1,
      unit: kind === 'count' ? unit.trim() || undefined : undefined,
      period,
      weekdays: period === 'day' && weekdays.length > 0 ? [...weekdays].sort() : undefined,
      weeklyTimes: Number(weekly) || 3,
      reminder:
        remKind === 'time'
          ? { kind: 'time' as const, time }
          : remKind === 'window'
            ? { kind: 'window' as const, from, to, everyMin: Number(every) || 120 }
            : undefined,
      order: existing?.order ?? nextOrder,
      archived: existing?.archived,
    };
    const parsed = goalSchema.safeParse(data);
    if (!parsed.success || (remKind === 'window' && from >= to)) return setError(t.errors.generic);
    if (existing) await goalRepo.update(existing.id, changedFields(opened ?? existing, data));
    else await goalRepo.create(data);
    onClose();
  }

  return (
    <Form onSubmit={() => void save()}>
      {existing ? null : (
        <div className={styles.days} role="group" aria-label={t.habits.form.templates}>
          {(['water', 'walk', 'stretch', 'pill'] as const).map((id) => (
            <Button key={id} variant="secondary" size="sm" onClick={() => template(id)}>
              {t.habits.templates[id].name}
            </Button>
          ))}
        </div>
      )}
      <TextField
        label={t.habits.form.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
      />
      <SelectField
        label={t.habits.form.kind}
        value={kind}
        onChange={(e) => setKind(e.target.value as Goal['kind'])}
      >
        <option value="yesno">{t.habits.form.yesno}</option>
        <option value="count">{t.habits.form.count}</option>
      </SelectField>
      {kind === 'count' ? (
        <div className={styles.split}>
          <TextField
            label={t.habits.form.target}
            type="number"
            inputMode="numeric"
            min={1}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <TextField
            label={t.habits.form.unit}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
      ) : null}
      <SelectField
        label={t.habits.form.reminder}
        value={remKind}
        onChange={(e) => setRemKind(e.target.value as 'off' | 'time' | 'window')}
        hint={remKind === 'window' ? t.habits.form.reminderHint : undefined}
      >
        <option value="off">{t.habits.form.reminderOff}</option>
        <option value="time">{t.habits.form.reminderTime}</option>
        <option value="window">{t.habits.form.reminderWindow}</option>
      </SelectField>
      {remKind === 'time' ? (
        <TextField
          label={t.habits.form.at}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      ) : null}
      {remKind === 'window' ? (
        <div className={styles.split}>
          <TextField
            label={t.habits.form.from}
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            label={t.habits.form.to}
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <TextField
            label={t.habits.form.every}
            type="number"
            inputMode="numeric"
            min={15}
            value={every}
            onChange={(e) => setEvery(e.target.value)}
          />
        </div>
      ) : null}
      <AdvancedFields moduleId="habits" hasData={period === 'week' || weekdays.length > 0}>
        <SelectField
          label={t.habits.form.period}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Goal['period'])}
        >
          <option value="day">{t.habits.form.day}</option>
          <option value="week">{t.habits.form.week}</option>
        </SelectField>
        {period === 'week' ? (
          <TextField
            label={t.habits.form.weeklyTimes}
            type="number"
            inputMode="numeric"
            min={1}
            max={7}
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
          />
        ) : (
          <div role="group" aria-label={t.habits.form.weekdays}>
            <p className={styles.meta}>
              {t.habits.form.weekdays} · {t.habits.form.weekdaysHint}
            </p>
            <div className={styles.days}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={styles.chip}
                  aria-pressed={weekdays.includes(d)}
                  onClick={() =>
                    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
                  }
                >
                  {weekdayShort(d)}
                </button>
              ))}
            </div>
          </div>
        )}
      </AdvancedFields>
      {error ? <p role="alert">{error}</p> : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                const entries = (
                  await entryRepo.table.where('goalId').equals(existing.id).toArray()
                )
                  .filter((e) => e.deletedAt === null)
                  .map((e) => e.id);
                await deleteWithUndo(async () => {
                  await entryRepo.removeMany(entries);
                  await goalRepo.remove(existing.id);
                });
                onClose();
              }}
            >
              {t.actions.delete}
            </Button>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
