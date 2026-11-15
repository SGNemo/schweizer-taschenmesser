// @vitest-environment jsdom
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { LiveSession } from '../components/LiveSession';
import { SessionEditor } from '../components/SessionEditor';
import { loadLive, startLive, type LiveState } from '../live';
import { sessionRepo } from '../repo';

let clock = new Date(2026, 10, 8, 18, 0).getTime();

function Harness({ initial, restSec = 90 }: { initial: LiveState; restSec?: number }) {
  // A tiny stand-in for the page: holds the state the dialog reports.
  const [state, setState] = useStateBox(initial);
  return (
    <LiveSession
      state={state}
      sessions={[
        { date: '2026-11-01', exercises: [{ name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 80 }] },
      ]}
      restSec={restSec}
      own={[]}
      onChange={setState}
      onClose={() => {}}
      onEnd={() => setState(undefined)}
    />
  );
}
function useStateBox(v: LiveState) {
  return useState<LiveState | undefined>(v);
}

describe('fitness live session', () => {
  beforeEach(async () => {
    clock = new Date(2026, 10, 8, 18, 0).getTime();
    setNow(() => clock);
    localStorage.clear();
    await db.table('fitness_session').clear();
  });
  afterEach(() => setNow());

  it('offers last time’s values, saves after the first set and runs a quiet rest', async () => {
    render(
      <Harness
        initial={startLive(
          { exercises: [{ name: 'Kniebeuge' }] },
          { date: '2026-11-08', time: '18:00', now: clock },
        )}
      />,
    );
    const live = screen.getByTestId('fitness-live');
    expect(within(live).getByLabelText('Wdh.')).toHaveValue(5);
    expect(within(live).getByLabelText('kg')).toHaveValue('80');
    // Nothing is written before the first set.
    expect(await sessionRepo.active().count()).toBe(0);

    fireEvent.click(within(live).getByLabelText('Aufwärmen'));
    fireEvent.change(within(live).getByLabelText('kg'), { target: { value: '40' } });
    fireEvent.click(within(live).getByRole('button', { name: 'Satz fertig' }));
    await waitFor(async () => expect(await sessionRepo.active().count()).toBe(1));
    expect(await screen.findByText('5 × 40 kg · Aufwärmen')).toBeInTheDocument();
    expect(screen.getByTestId('fitness-rest').textContent).toMatch(/Pause · 1:30/);
    expect(loadLive()?.sessionId).toBeTruthy();

    // A working set: the row's summary leaves the warm-up out.
    fireEvent.click(screen.getByRole('button', { name: 'Pause beenden' }));
    fireEvent.change(screen.getByLabelText('kg'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: 'Satz fertig' }));
    await waitFor(async () => {
      const [s] = await sessionRepo.active().toArray();
      expect(s!.exercises[0]).toMatchObject({ sets: 1, reps: 5, weightKg: 85 });
      expect(s!.exercises[0]!.log).toHaveLength(2);
    });

    clock += 40 * 60_000;
    fireEvent.click(screen.getByRole('button', { name: 'Einheit beenden' }));
    await waitFor(() => expect(loadLive()).toBeUndefined());
    const [s] = await sessionRepo.active().toArray();
    expect(s!.durationMin).toBe(40);
  });

  it('ends without writing anything when no set was logged', async () => {
    render(
      <Harness initial={startLive(undefined, { date: '2026-11-08', time: '18:00', now: clock })} />,
    );
    expect(screen.getByText('Wähle die erste Übung, dann geht es los.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Einheit beenden' }));
    await waitFor(() => expect(loadLive()).toBeUndefined());
    expect(await sessionRepo.active().count()).toBe(0);
  });
});

describe('fitness form with single sets', () => {
  beforeEach(() => setNow(() => new Date(2026, 10, 8, 12, 0).getTime()));
  afterEach(() => setNow());

  it('shows the sets of a row logged set by set and saves them with a fresh summary', async () => {
    await db.table('fitness_session').clear();
    const s = await sessionRepo.create({
      date: '2026-11-08',
      exercises: [
        {
          name: 'Rudern',
          sets: 2,
          reps: 10,
          weightKg: 50,
          log: [
            { reps: 12, weightKg: 30, warmup: true },
            { reps: 10, weightKg: 50, note: 'locker' },
            { reps: 10, weightKg: 50 },
          ],
        },
      ],
    });
    render(<SessionEditor target={s} sessions={[s]} templates={[]} onClose={() => {}} />);
    const group = screen.getByRole('group', { name: 'Rudern' });
    expect(within(group).getAllByLabelText('Wdh.')).toHaveLength(3);
    expect(within(group).getAllByLabelText('Aufwärmen')[0]).toBeChecked();
    expect(within(group).getAllByLabelText('Notiz')[1]).toHaveValue('locker');
    fireEvent.change(within(group).getAllByLabelText('kg')[2]!, { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      const row = (await sessionRepo.get(s.id))!.exercises[0]!;
      expect(row).toMatchObject({ sets: 2, reps: 10, weightKg: 55 });
      expect(row.log![1]!.note).toBe('locker');
    });
  });
});
