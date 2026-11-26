// @vitest-environment jsdom
/**
 * The appointment's plan panel (planner hub 2, package 9, hand-off 09): day · time · place of the occurrence; things
 * linked `before` / `after` under A5 as tick lines – a tick asks ToDos over the bus (no import) inside one undo entry;
 * the planner's own actions stand first in the foot; X3 for an event that is gone. Invented data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addLink } from '@/core/entitylinks';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import { getManifest } from '@/core/modules/registry';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { setNow } from '@/core/time/now';
import { undoDepth } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { eventRepo } from '../repo';

const mod = (id: string) => ({
  id,
  enabled: true,
  dataPolicy: null,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 't',
  deletedAt: null,
  _f: {},
});
const taskRepo = () => createCollectionRepo(getManifest('todos')!, 'task');

const panel = (id = 'ev1:2026-12-09') =>
  render(
    <MemoryRouter>
      <PlanPanelHost
        moduleId="calendar"
        id={id}
        to="/calendar"
        actions={<button type="button">Vorbereiten …</button>}
      />
    </MemoryRouter>,
  );

const asked: string[] = [];
beforeEach(async () => {
  bus.clear();
  asked.length = 0;
  for (const t of ['calendar_event', 'todos_task', '_links', '_modules']) await db.table(t).clear();
  await db.table('_modules').bulkPut([mod('calendar'), mod('todos'), mod('planner')]);
  useUiStore.setState({ toasts: [] });
  setNow(() => new Date(2026, 10, 30, 9, 0).getTime());
  await eventRepo.create(
    {
      title: 'Friseur',
      allDay: false,
      startDate: '2026-12-02',
      startTime: '15:00',
      endTime: '15:45',
      location: 'Salon am Markt',
      recurrence: { freq: 'weekly', interval: 1 },
    } as never,
    { id: 'ev1' },
  );
});
afterEach(() => {
  setNow();
  bus.clear();
});

describe('the appointment panel', () => {
  it('the occurrence’s day, time and place; no heads without linked things; the planner’s actions first', async () => {
    panel();
    expect(
      await screen.findByText(/^Mi\.?, 9\. Dez\.? · 15:00–15:45 · Salon am Markt$/),
    ).toBeTruthy();
    expect(screen.queryByText('Vorbereitung')).toBeNull();
    const foot = screen.getByRole('button', { name: 'Vorbereiten …' }).parentElement!;
    expect(foot.textContent).toMatch(/Vorbereiten …/);
    expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeTruthy();
  });

  it('linked things under „Vorbereitung“ / „Danach“; a tick asks ToDos over the bus in one undo entry', async () => {
    for (const [id, title] of [
      ['t1', 'Bargeld holen'],
      ['t2', 'Föhn zurückgeben'],
    ] as const)
      await taskRepo().create({ title, listId: 'inbox' } as never, { id });
    await addLink({
      from: { module: 'todos', id: 't1' },
      to: { module: 'calendar', id: 'ev1' },
      rel: 'before',
      label: 'Friseur',
    });
    await addLink({
      from: { module: 'todos', id: 't2' },
      to: { module: 'calendar', id: 'ev1' },
      rel: 'after',
      label: 'Friseur',
    });
    bus.on('todo.doneRequested', async (req) => {
      asked.push(req.id);
      await taskRepo().update(req.id, { done: true } as never);
    });
    panel();
    expect(await screen.findByText('Vorbereitung')).toBeTruthy();
    expect(screen.getByText('Danach')).toBeTruthy();
    const depth = undoDepth();
    fireEvent.click(screen.getByRole('checkbox', { name: '„Bargeld holen“ abhaken' }));
    await waitFor(() => expect(asked).toEqual(['t1']));
    await waitFor(() => expect(undoDepth()).toBe(depth + 1));
  });

  it('an event that is gone: X3', async () => {
    panel('nope:2026-12-09');
    expect(await screen.findByText('Gibt es nicht mehr.')).toBeTruthy();
  });
});
