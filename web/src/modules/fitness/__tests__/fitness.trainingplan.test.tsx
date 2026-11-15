// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { PlanDialog } from '../components/PlanDialog';
import {
  isoWeekday,
  parsePlanItemId,
  planDays,
  planItemId,
  presetTemplates,
  PRESETS,
  sessionFromTemplate,
  weekdayOrder,
} from '../plan';
import plannable from '../plannable';
import { sessionRepo, templateRepo } from '../repo';
import { templateSchema } from '../schema';

const tpl = (title: string, weekdays?: number[]) => ({
  title,
  exercises: [{ name: 'Kniebeuge', sets: 3, reps: 5 }],
  ...(weekdays ? { weekdays } : {}),
});

describe('fitness training plan (logic)', () => {
  it('knows ISO weekdays and orders them by the week start', () => {
    expect(isoWeekday('2026-11-09')).toBe(1); // Monday
    expect(isoWeekday('2026-11-15')).toBe(7); // Sunday
    expect(weekdayOrder(7)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });

  it('derives plan days, skipping a day that has any session already', () => {
    const days = planDays(
      [tpl('Oberkörper', [1, 4]), tpl('Beine', [2]), tpl('Ohne Tage')],
      [{ date: '2026-11-12' }],
      '2026-11-09',
      '2026-11-15',
    );
    expect(days.map((d) => `${d.date} ${d.template.title}`)).toEqual([
      '2026-11-09 Oberkörper',
      '2026-11-10 Beine',
    ]);
  });

  it('makes a logged session from a template and round-trips the planner id', () => {
    expect(sessionFromTemplate({ ...tpl('Beine', [2]), durationMin: 50 }, '2026-11-10')).toEqual({
      date: '2026-11-10',
      title: 'Beine',
      durationMin: 50,
      exercises: [{ name: 'Kniebeuge', sets: 3, reps: 5 }],
    });
    expect(parsePlanItemId(planItemId('abc:1', '2026-11-10'))).toEqual({
      templateId: 'abc:1',
      date: '2026-11-10',
    });
    expect(parsePlanItemId('someSession')).toBeUndefined();
  });

  it('builds valid preset templates from the catalogue', () => {
    for (const id of Object.keys(PRESETS) as (keyof typeof PRESETS)[])
      for (const x of presetTemplates(id)) expect(templateSchema.safeParse(x).success).toBe(true);
    expect(presetTemplates('ppl3').map((x) => x.title)).toEqual(['Drücken', 'Ziehen', 'Beine']);
  });
});

describe('fitness training plan (planner and dialog)', () => {
  beforeEach(async () => {
    setNow(() => new Date(2026, 10, 9, 8, 0).getTime()); // Monday
    await db.table('fitness_session').clear();
    await db.table('fitness_template').clear();
  });
  afterEach(() => setNow());

  it('offers plan days to the planner and logs one when ticked off', async () => {
    const a = await templateRepo.create(tpl('Oberkörper', [1, 3]));
    await sessionRepo.create({
      date: '2026-11-11',
      exercises: [{ name: 'Laufen', durationMin: 30 }],
    });
    const items = await plannable.list({ today: '2026-11-09', until: '2026-11-15' });
    expect(items.map((i) => i.id)).toEqual([planItemId(a.id, '2026-11-09')]);
    expect(items[0]).toMatchObject({
      earliest: '2026-11-09',
      due: { date: '2026-11-09', hard: true },
    });

    await plannable.onDone!(items[0]!.id);
    const all = await sessionRepo.active().toArray();
    expect(all.find((x) => x.title === 'Oberkörper')).toMatchObject({ date: '2026-11-09' });
    // Done: the day is taken, nothing is offered again; the estimate never writes a record.
    expect(await plannable.list({ today: '2026-11-09', until: '2026-11-10' })).toEqual([]);
    await plannable.onEstimate!(items[0]!.id, 30);
    expect((await templateRepo.get(a.id))!.durationMin).toBeUndefined();
  });

  it('toggles weekdays per template and applies a preset', async () => {
    const a = await templateRepo.create(tpl('Oberkörper'));
    const { rerender } = render(
      <PlanDialog open templates={[a]} weekStart={1} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Oberkörper am Donnerstag' }));
    await waitFor(async () => expect((await templateRepo.get(a.id))!.weekdays).toEqual([4]));
    rerender(
      <PlanDialog
        open
        templates={[(await templateRepo.get(a.id))!]}
        weekStart={1}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Oberkörper am Donnerstag' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Plan Ober- und Unterkörper, 4 × pro Woche übernehmen' }),
    );
    await waitFor(async () => expect(await templateRepo.active().count()).toBe(2));
    // The existing „Oberkörper“ keeps its exercises and takes the preset's days.
    const upper = (await templateRepo.active().toArray()).find((x) => x.title === 'Oberkörper')!;
    expect(upper.weekdays).toEqual([1, 4]);
    expect(upper.exercises).toEqual([{ name: 'Kniebeuge', sets: 3, reps: 5 }]);
    expect(within(screen.getByTestId('fitness-plan')).getByText('Oberkörper')).toBeInTheDocument();
  });
});
