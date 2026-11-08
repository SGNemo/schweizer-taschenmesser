import { useState } from 'react';
import { setSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Form, FormActions, SelectField, TextField } from '@/ui';
import { kcalText } from '../data';
import { ACTIVITY, SEXES, estimateKcal, type Activity, type Sex } from '../goal';
import { DEFAULTS } from '../settings';
import styles from '../fitness.module.css';

/**
 * The daily kcal goal: typed directly, or worked out from the formula fields. Weight, height and age
 * live only in this dialog's state; only the resulting number is saved (`module.fitness.kcalGoal`).
 */
export function GoalDialog({
  open,
  current,
  onClose,
}: {
  open: boolean;
  current: number;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.fitness.goal.title}>
      {open ? <Fields current={current} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Fields({ current, onClose }: { current: number; onClose: () => void }) {
  const g = t.fitness.goal;
  const [goal, setGoal] = useState(current ? String(current) : '');
  const [calc, setCalc] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('none');
  const [activity, setActivity] = useState<Activity>('light');
  const estimate = estimateKcal({
    weightKg: Number(weight.replace(',', '.')),
    heightCm: Number(height),
    age: Number(age),
    sex,
    activity,
  });

  async function save() {
    const v = Math.round(Number(goal || 0));
    if (!Number.isFinite(v) || v < 0 || v > 9999) return;
    await setSettings('module.fitness', { kcalGoal: v }, DEFAULTS);
    useUiStore.getState().toast(g.saved);
    onClose();
  }

  return (
    <Form onSubmit={save}>
      <TextField
        label={g.direct}
        hint={g.directHint}
        type="number"
        inputMode="numeric"
        min={0}
        max={9999}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        data-autofocus
      />
      {calc ? (
        <section aria-label={g.calc}>
          <p className={styles.hint}>{g.calcIntro}</p>
          <div className={styles.split}>
            <TextField
              label={g.weight}
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              autoComplete="off"
            />
            <TextField
              label={g.height}
              type="number"
              inputMode="numeric"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              autoComplete="off"
            />
            <TextField
              label={g.age}
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              autoComplete="off"
            />
          </div>
          <SelectField label={g.sex} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {g.sexes[s]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={g.activity}
            value={activity}
            onChange={(e) => setActivity(e.target.value as Activity)}
          >
            {ACTIVITY.map((a) => (
              <option key={a} value={a}>
                {g.activities[a]}
              </option>
            ))}
          </SelectField>
          <p className={styles.result} aria-live="polite" data-testid="fitness-estimate">
            {estimate ? g.result(kcalText(estimate)) : g.noResult}
          </p>
          {estimate ? (
            <Button variant="secondary" size="sm" onClick={() => setGoal(String(estimate))}>
              {g.take}
            </Button>
          ) : null}
          <p className={styles.hint}>{g.hint}</p>
        </section>
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setCalc(true)}>
            {g.calc}
          </Button>
        </div>
      )}
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}
