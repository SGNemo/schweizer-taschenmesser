// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { useIdle } from '../idle';
import { getRunning, jobRepo, sessionRepo } from '../repo';
import TimetrackPage from '../routes/TimetrackPage';

const draw = (url = '/timetrack') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TimetrackPage />
    </MemoryRouter>,
  );
const job = () =>
  jobRepo.create({ name: 'Website', tone: 0, billable: true, rateCents: 6000, order: 0 });

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 3, 10, 0).getTime());
  for (const t of ['client', 'job', 'session']) await db.table(`timetrack_${t}`).clear();
  useIdle.getState().clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('Time tracking page', () => {
  it('starts with an empty state that asks for a project', async () => {
    draw();
    expect(await screen.findByText(/Noch keine Projekte/)).toBeVisible();
  });

  it('the empty page says one thing with one filled step; idle and day texts wait for a project (U10)', async () => {
    draw();
    const empty = await screen.findByTestId('timetrack-empty');
    const step = within(empty).getByRole('button', { name: 'Projekt anlegen' });
    expect(step.className).toMatch(/primary/);
    expect(screen.queryByText('Nichts läuft.')).toBeNull();
    expect(screen.queryByText('Heute noch keine Zeit erfasst.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zeiteintrag eintragen' }).className).not.toMatch(
      /primary/,
    );
  });

  it('with a project the idle line and the day list are back', async () => {
    await job();
    draw();
    expect(await screen.findByText('Nichts läuft.')).toBeVisible();
    expect(screen.getByText('Heute noch keine Zeit erfasst.')).toBeVisible();
    expect(screen.queryByTestId('timetrack-empty')).toBeNull();
  });

  it('one click on a project starts the timer, Stopp ends it', async () => {
    const j = await job();
    draw();
    await userEvent.click(await screen.findByRole('button', { name: 'Website starten' }));
    await waitFor(async () => expect((await getRunning())?.jobId).toBe(j.id));
    const card = await screen.findByTestId('running-card');
    await userEvent.click(within(card).getByRole('button', { name: 'Stopp' }));
    await waitFor(async () => expect(await getRunning()).toBeUndefined());
    expect((await sessionRepo.active().toArray())[0]?.startTime).toBe('10:00');
  });

  it('starting another project stops the running one', async () => {
    const a = await job();
    await jobRepo.create({ name: 'Buchhaltung', tone: 1, billable: true, order: 1 });
    draw();
    await userEvent.click(await screen.findByRole('button', { name: 'Website starten' }));
    await waitFor(async () => expect((await getRunning())?.jobId).toBe(a.id));
    setNow(() => new Date(2026, 10, 3, 11, 0).getTime());
    await userEvent.click(screen.getByRole('button', { name: 'Buchhaltung starten' }));
    await waitFor(async () => {
      const all = await sessionRepo.active().toArray();
      expect(all).toHaveLength(2);
      expect(all.filter((s) => !s.endTime)).toHaveLength(1);
      expect(all.find((s) => s.jobId === a.id)?.endTime).toBe('11:00');
    });
  });

  it('the idle question changes nothing until a choice is made; "als Pause abziehen" books the gap', async () => {
    const j = await job();
    const s = await sessionRepo.create({
      jobId: j.id,
      date: '2026-11-03',
      startTime: '09:00',
      breakMin: 0,
    });
    draw();
    await screen.findByTestId('running-card');
    act(() => useIdle.getState().ask(new Date(2026, 10, 3, 9, 30).getTime(), 30));
    expect(await screen.findByTestId('idle-prompt')).toBeVisible();
    expect((await sessionRepo.get(s.id))?.breakMin).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Als Pause abziehen' }));
    await waitFor(async () => expect((await sessionRepo.get(s.id))?.breakMin).toBe(30));
    expect(screen.queryByTestId('idle-prompt')).toBeNull();
  });

  it('"Dort stoppen, wo ich weg war" ends the session at the last input', async () => {
    const j = await job();
    const s = await sessionRepo.create({
      jobId: j.id,
      date: '2026-11-03',
      startTime: '09:00',
      breakMin: 0,
    });
    draw();
    await screen.findByTestId('running-card');
    act(() => useIdle.getState().ask(new Date(2026, 10, 3, 9, 40).getTime(), 20));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Dort stoppen, wo ich weg war' }),
    );
    await waitFor(async () => expect((await sessionRepo.get(s.id))?.endTime).toBe('09:40'));
  });

  it('the report adds the day up with the amount in whole cents', async () => {
    const j = await job();
    await sessionRepo.create({
      jobId: j.id,
      date: '2026-11-03',
      startTime: '08:00',
      endTime: '10:15',
      breakMin: 0,
    });
    draw('/timetrack?view=report');
    expect(await screen.findByTestId('report-total')).toHaveTextContent('2 Std 15 Min');
    expect(screen.getByTestId('report-amount')).toHaveTextContent('135,00');
  });
});
