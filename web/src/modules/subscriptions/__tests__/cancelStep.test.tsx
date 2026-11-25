// @vitest-environment jsdom
/**
 * The module's first cancel step (planner hub 2, package 4b; CONCEPT-ROWS idea 4, row Abos): „Gekündigt am …“ →
 * „Vermerken“ writes the day and ends the subscription before that deadline's charge; „Läuft weiter“ decides this one
 * deadline and the next period's comes as usual. Either way the planner source no longer lists the deadline. Each is
 * one undo. In the plan panel every action sits in the foot, the planner writes nothing, and „Werte ausblenden“ hides
 * the price.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setHideValues } from '@/core/focus/hideValues';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoLast } from '@/core/undo';
import { keepRunning, lastDay, markCancelled, parseRowId } from '../cancelStep';
import source from '../plannable';
import { subscriptionRepo } from '../repo';

const TODAY = '2026-11-09';
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

// Monthly on the 20th, 7 days' notice: deadlines on the 13th of each month.
const add = () =>
  subscriptionRepo.create(
    {
      name: 'Streamingdienst Beispiel',
      amountMinor: 1299,
      startDate: '2026-01-20',
      recurrence: { freq: 'monthly', interval: 1 },
      cancelNoticeDays: 7,
      active: true,
    } as never,
    { id: 's1' },
  );

const listed = async () =>
  (await source.list({ today: TODAY, until: '2027-01-31' })).map((i) => i.id);

beforeEach(async () => {
  for (const t of ['subscriptions_subscription', '_modules', '_settings'])
    await db.table(t).clear();
  await db.table('_modules').bulkPut([mod('subscriptions'), mod('planner')]);
  await setHideValues(false);
  resetUndoJournal();
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime());
});
afterEach(() => setNow());

describe('cancel step', () => {
  it('reads a plan row id, nothing else', () => {
    expect(parseRowId('s1:2026-11-13')).toEqual({
      subId: 's1',
      deadline: { date: '2026-11-13', trial: false },
    });
    expect(parseRowId('s1:trial:2026-11-30')).toEqual({
      subId: 's1',
      deadline: { date: '2026-11-30', trial: true },
    });
    for (const bad of ['s1', 's1:13.11.2026', '', ':', 's1:2026-11-13:x'])
      expect(parseRowId(bad)).toBeUndefined();
  });

  it('„Vermerken“: the day and the end before that charge; the deadline leaves the plan; one undo', async () => {
    const s = await add();
    expect(await listed()).toEqual(['s1:2026-11-13']);
    expect(lastDay(s, { date: '2026-11-13', trial: false })).toBe('2026-11-19');
    await markCancelled(s, { date: '2026-11-13', trial: false }, '2026-11-08');
    const after = await subscriptionRepo.get('s1');
    expect(after?.cancelledOn).toBe('2026-11-08');
    expect(after?.recurrence.until).toBe('2026-11-19');
    expect(await listed()).toEqual([]);
    await undoLast();
    expect((await subscriptionRepo.get('s1'))?.recurrence.until).toBeUndefined();
    expect(await listed()).toEqual(['s1:2026-11-13']);
  });

  it('„Läuft weiter“: this deadline is decided, the next period’s comes as usual', async () => {
    const s = await add();
    await keepRunning(s, { date: '2026-11-13', trial: false });
    expect(await listed()).toEqual(['s1:2026-12-13']);
    expect((await subscriptionRepo.get('s1'))?.recurrence.until).toBeUndefined();
  });
});

describe('the subscription panel', () => {
  const panel = (id = 's1:2026-11-13') =>
    render(
      <MemoryRouter>
        <PlanPanelHost moduleId="subscriptions" id={id} to="/subscriptions?open=s1" />
      </MemoryRouter>,
    );

  it('name, price, „Kündigen bis“; „Gekündigt am …“ shows the day, „Vermerken“ writes – nothing of the planner', async () => {
    await add();
    panel();
    expect(await screen.findByText('Streamingdienst Beispiel')).toBeInTheDocument();
    expect(screen.getByText(/^Kündigen bis Fr 13\. Nov/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Gekündigt am')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gekündigt am …' }));
    const day = screen.getByLabelText('Gekündigt am');
    // Today by default (the field shows it in the reader's format).
    expect((day as HTMLInputElement).value).toBe('09.11.2026');
    const writes: string[] = [];
    const hit = (name: string) => () => void writes.push(name);
    const hooks = db.tables.map((tb) => {
      const h = hit(tb.name);
      tb.hook('updating', h);
      tb.hook('creating', h);
      return () => {
        tb.hook('updating').unsubscribe(h);
        tb.hook('creating').unsubscribe(h);
      };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vermerken' }));
    await waitFor(async () => expect((await subscriptionRepo.get('s1'))?.cancelledOn).toBe(TODAY));
    hooks.forEach((off) => off());
    expect(writes.some((w) => w.startsWith('planner_'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
  });

  it('„Läuft weiter“ from the panel', async () => {
    await add();
    panel();
    fireEvent.click(await screen.findByRole('button', { name: 'Läuft weiter' }));
    await waitFor(async () =>
      expect((await subscriptionRepo.get('s1'))?.keptDeadline).toBe('2026-11-13'),
    );
  });

  it('„Werte ausblenden“ hides the price; a foreign id is X3', async () => {
    await setHideValues(true);
    await add();
    const { container, unmount } = panel();
    await screen.findByText('Streamingdienst Beispiel');
    expect(container.textContent).not.toMatch(/12,99/);
    unmount();
    panel('nope');
    expect(await screen.findByText('Gibt es nicht mehr.')).toBeInTheDocument();
  });
});

describe('the page’s cancel step (`?do=cancel`)', () => {
  it('opens for the next deadline; „Gekündigt am …“ → „Vermerken“ writes, then it closes', async () => {
    const { default: SubscriptionsPage } = await import('../routes/SubscriptionsPage');
    await add();
    render(
      <MemoryRouter initialEntries={['/subscriptions?open=s1&do=cancel']}>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Streamingdienst Beispiel kündigen?',
    });
    expect(dialog).toHaveTextContent(/Kündigen bis Fr 13\. Nov/);
    expect((await subscriptionRepo.get('s1'))?.cancelledOn).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Gekündigt am …' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vermerken' }));
    await waitFor(async () =>
      expect((await subscriptionRepo.get('s1'))?.recurrence.until).toBe('2026-11-19'),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /kündigen\?/ })).toBeNull());
  });
});
