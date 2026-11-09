// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { jobRepo, sessionRepo } from '../repo';
import TimerWidget from '../widgets/TimerWidget';

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 3, 14, 0).getTime());
  for (const t of ['client', 'job', 'session']) await db.table(`timetrack_${t}`).clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('Time tracking widget (U30)', () => {
  it('idle: one figure with one context line, no repeated total', async () => {
    const job = await jobRepo.create({ name: 'Website', tone: 0, billable: true, order: 0 });
    await sessionRepo.create({
      jobId: job.id,
      date: '2026-11-03',
      startTime: '10:00',
      endTime: '12:00',
    });
    render(
      <MemoryRouter>
        <TimerWidget />
      </MemoryRouter>,
    );
    expect(await screen.findByText('2:00')).toBeVisible();
    expect(screen.getByText('heute · nichts läuft')).toBeVisible();
    expect(screen.queryByText(/Heute: 2 Std/)).toBeNull();
    expect(screen.queryByText('Nichts läuft')).toBeNull();
  });
});
