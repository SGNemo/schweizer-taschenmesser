// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { eventRepo } from '../repo';
import NextWidget from '../widgets/NextWidget';

const NOW = new Date(2026, 9, 2, 10, 0).getTime();
const draw = () =>
  render(
    <MemoryRouter>
      <NextWidget />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('calendar_event').clear();
  await db.table('_settings').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('calendar "Als Nächstes" widget', () => {
  it('shows the time until the next appointment today with its title', async () => {
    await eventRepo.create({
      title: 'Friseur',
      allDay: false,
      startDate: '2026-10-02',
      startTime: '13:00',
    });
    await eventRepo.create({
      title: 'Vorbei',
      allDay: false,
      startDate: '2026-10-02',
      startTime: '08:00',
    });
    draw();
    expect(await screen.findByText('in 3 Std')).toBeInTheDocument();
    expect(screen.getByText(/13:00 Friseur/)).toBeInTheDocument();
  });

  it('is calm and friendly when nothing is left today', async () => {
    draw();
    expect(await screen.findByText('Heute ist nichts mehr geplant.')).toBeInTheDocument();
  });

  it('can be switched off', async () => {
    await patchFocusSettings({ timeToNext: false });
    draw();
    expect(
      await screen.findByText('Die Zeit bis zum nächsten Termin ist ausgeschaltet.'),
    ).toBeInTheDocument();
  });
});
