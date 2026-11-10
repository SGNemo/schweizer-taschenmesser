import { useState } from 'react';
import { changedFields } from '@/core/db/patch';
import type { Stored } from '@/core/db/types';
import { nowTime, today } from '@/core/time/dates';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { AdvancedFields, Button, Dialog, Form, FormActions, TextField } from '@/ui';
import { kcalText } from '../data';
import { foodSuggestions } from '../logic';
import { mealRepo } from '../repo';
import { mealSchema, type Meal } from '../schema';
import styles from '../fitness.module.css';

export type MealTarget = Stored<Meal> | 'new' | null;

const int = (s: string): number | undefined => {
  const v = Number(s);
  return s.trim() && Number.isInteger(v) && v >= 0 ? v : undefined;
};
const str = (n: number | undefined) => (n === undefined ? '' : String(n));

export function MealEditor({
  target,
  meals,
  onClose,
}: {
  target: MealTarget;
  /** Own meals: the food memory (text → last kcal). */
  meals: readonly Meal[];
  onClose: () => void;
}) {
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={target && target !== 'new' ? t.fitness.editMeal : t.fitness.addMeal}
    >
      {target ? (
        <Fields
          key={target === 'new' ? 'new' : target.id}
          target={target}
          meals={meals}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

function Fields({
  target,
  meals,
  onClose,
}: {
  target: NonNullable<MealTarget>;
  meals: readonly Meal[];
  onClose: () => void;
}) {
  const existing = target === 'new' ? null : target;
  const [opened] = useState(existing);
  const [text, setText] = useState(existing?.text ?? '');
  const [kcal, setKcal] = useState(str(existing?.kcal));
  const [date, setDate] = useState(existing?.date ?? today());
  const [time, setTime] = useState(existing?.time ?? (existing ? '' : nowTime()));
  const [protein, setProtein] = useState(str(existing?.proteinG));
  const [carbs, setCarbs] = useState(str(existing?.carbsG));
  const [fat, setFat] = useState(str(existing?.fatG));
  const [error, setError] = useState('');
  const foods = foodSuggestions(meals);
  const listId = 'fitness-foods';

  /** A known food fills its last kcal while the kcal field is still empty. */
  function pickText(value: string) {
    setText(value);
    const hit = foods.find((f) => f.text.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
    if (hit && !kcal) setKcal(String(hit.kcal));
  }

  async function save() {
    const data = {
      text: text.trim(),
      kcal: int(kcal) ?? -1,
      date,
      time: time || undefined,
      proteinG: int(protein),
      carbsG: int(carbs),
      fatG: int(fat),
    };
    const parsed = mealSchema.safeParse(data);
    if (!parsed.success) return setError(t.fitness.form.invalid);
    if (existing) await mealRepo.update(existing.id, changedFields(opened ?? existing, data));
    else await mealRepo.create(parsed.data);
    onClose();
  }

  return (
    <Form onSubmit={save}>
      <datalist id={listId}>
        {foods.map((f) => (
          <option key={f.text} value={f.text}>
            {t.fitness.line.kcal(kcalText(f.kcal))}
          </option>
        ))}
      </datalist>
      <TextField
        label={t.fitness.form.text}
        hint={t.fitness.form.textHint}
        list={listId}
        value={text}
        onChange={(e) => pickText(e.target.value)}
        required
        data-autofocus
      />
      <div className={styles.split}>
        <TextField
          label={t.fitness.form.kcal}
          type="number"
          inputMode="numeric"
          min={0}
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          required
        />
        <TextField
          label={t.fitness.form.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <TextField
          label={t.fitness.form.time}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      <AdvancedFields
        moduleId="fitness"
        hasData={Boolean(existing?.proteinG ?? existing?.carbsG ?? existing?.fatG)}
      >
        <div className={styles.split}>
          <TextField
            label={t.fitness.form.protein}
            type="number"
            inputMode="numeric"
            min={0}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
          <TextField
            label={t.fitness.form.carbs}
            type="number"
            inputMode="numeric"
            min={0}
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <TextField
            label={t.fitness.form.fat}
            type="number"
            inputMode="numeric"
            min={0}
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </div>
      </AdvancedFields>
      {error ? <p role="alert">{error}</p> : null}
      <FormActions
        start={
          existing ? (
            <Button
              variant="danger"
              onClick={async () => {
                await deleteWithUndo(() => mealRepo.remove(existing.id));
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
