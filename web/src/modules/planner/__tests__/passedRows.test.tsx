// @vitest-environment jsdom
/**
 * „Training vom Sa – eintragen?“ under today's sheet (`PassedTrainings`): a training with a time whose day passed
 * unlogged, from the real fitness source; „Weglassen“ and „Eintragen“ each take it away, with no count and no tone.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { PassedTrainings } from '../components/PassedTrainings';
import { itemRepo } from '../repo';

const NOW = new Date(2026, 10, 16, 10, 0).getTime(); // Monday 2026-11-16
const TODAY = '2026-11-16';
const fitness = getManifest('fitness')!;
const sessionRepo = createCollectionRepo(fitness, 'session');

const moduleOn = (id: string) =>
  db.table('_modules').put({
    id,
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

const plan = (date: string, time?: string) =>
  sessionRepo.create({
    date,
    ...(time ? { time } : {}),
    title: 'Oberkörper',
    durationMin: 60,
    exercises: [],
    planned: true,
  });

const show = () =>
  render(
    <MemoryRouter>
      <PassedTrainings today={TODAY} titles={{}} />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'fitness_session',
    'fitness_template',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
  await moduleOn('fitness');
  await moduleOn('planner');
});
afterEach(() => setNow());

describe('a training whose day passed unlogged', () => {
  it('is asked once, calmly; an untimed one, one older than a week and one ahead are not', async () => {
    await plan('2026-11-14', '18:00');
    await plan('2026-11-13');
    await plan('2026-11-08', '18:00');
    await plan('2026-11-17', '18:00');
    show();
    const card = await screen.findByTestId('planner-passed');
    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/^Training vom .+ – eintragen\?/);
    expect(rows[0]).toHaveTextContent('Training: Oberkörper · 18:00');
    expect(card.textContent).not.toMatch(/\d+ (Trainings|verpasst)|überfällig|vergessen/i);
  });

  it('„Weglassen“ keeps the day on the planner row and the question goes', async () => {
    const s = await plan('2026-11-14', '18:00');
    show();
    fireEvent.click(await screen.findByRole('button', { name: /weglassen$/ }));
    await waitFor(() => expect(screen.queryByTestId('planner-passed')).toBeNull());
    expect((await itemRepo.get(`fitness:${s.id}`))?.skipped).toBe('2026-11-14');
    expect((await sessionRepo.get(s.id))?.planned).toBe(true);
  });

  it('„Eintragen“ logs it through the source and the question goes', async () => {
    const s = await plan('2026-11-14', '18:00');
    show();
    fireEvent.click(await screen.findByRole('button', { name: /eintragen$/ }));
    await waitFor(() => expect(screen.queryByTestId('planner-passed')).toBeNull());
    expect((await sessionRepo.get(s.id))?.planned).toBeFalsy();
  });

  it('nothing passed: no card', async () => {
    const { container } = show();
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });
});
