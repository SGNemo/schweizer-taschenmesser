// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { eventRepo } from '../repo';
import { RemindersTab } from '../components/RemindersTab';

const NOW = new Date(2026, 9, 2, 10, 0).getTime();
const draw = () =>
  render(
    <MemoryRouter>
      <RemindersTab newRequested={false} onNewHandled={() => undefined} />
    </MemoryRouter>,
  );
const add = (title: string, startDate: string, extra: Record<string, unknown> = {}) =>
  eventRepo.create({
    title,
    allDay: false,
    kind: 'reminder',
    startDate,
    startTime: '18:00',
    notify: { minutesBefore: 0, enabled: true },
    ...extra,
  });

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('calendar_event').clear();
  await db.table('_settings').clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('RemindersTab', () => {
  it('groups by date and keeps "Erledigt" folded; a row has one main button and a "⋯" menu', async () => {
    await add('Heute dran', '2026-10-02');
    await add('Später dran', '2026-11-01');
    await add('Vorbei', '2026-09-01');
    draw();
    const today = await screen.findByRole('button', { name: /Heute dran/ });
    expect(today).toBeVisible();
    expect(screen.getByRole('button', { name: 'Später einklappen' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // the finished group exists but is folded
    expect(screen.getByRole('button', { name: 'Erledigt ausklappen' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /Vorbei/, hidden: true })).not.toBeVisible();
    // one "Erledigt" per open one-off row, no switch left in the row
    expect(screen.getAllByRole('button', { name: 'Erledigt' })).toHaveLength(2);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('"Erledigt" in the row moves a one-off reminder into the folded group (and keeps it)', async () => {
    const user = userEvent.setup();
    await add('Tabletten', '2026-10-02');
    draw();
    const row = (await screen.findByRole('button', { name: /Tabletten/ })).closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Erledigt' }));
    const stored = (await eventRepo.active().toArray())[0]!;
    expect(stored.notify?.enabled).toBe(false);
    expect(await screen.findByRole('button', { name: 'Erledigt ausklappen' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Tabletten/ })).toBeNull();
  });

  it('the menu offers Später (one-off only), Pausieren, Bearbeiten and Löschen; a repeat has no Erledigt', async () => {
    const user = userEvent.setup();
    await add('Wasser', '2026-10-02', { recurrence: { freq: 'daily', interval: 1 } });
    await add('Einmal', '2026-10-03');
    draw();
    const repeat = (await screen.findByRole('button', { name: /Wasser/ })).closest('li')!;
    expect(within(repeat).queryByRole('button', { name: 'Erledigt' })).toBeNull();
    await user.click(within(repeat).getByRole('button', { name: 'Weitere Aktionen' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'In 1 Std' })).toBeNull();
    for (const name of ['Pausieren', 'Bearbeiten', 'Löschen'])
      expect(within(menu).getByRole('menuitem', { name })).toBeVisible();
    await user.keyboard('{Escape}');

    const once = screen.getByRole('button', { name: /Einmal/ }).closest('li')!;
    await user.click(within(once).getByRole('button', { name: 'Weitere Aktionen' }));
    await user.click(screen.getByRole('menuitem', { name: 'In 1 Std' }));
    const moved = (await eventRepo.active().toArray()).find((e) => e.title === 'Einmal')!;
    expect(moved).toMatchObject({ startDate: '2026-10-02', startTime: '11:00' });
  });
});
