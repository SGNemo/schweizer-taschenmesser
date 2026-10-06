// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { DueNotification } from '@/core/modules/types';
import { isAcked } from '@/core/notifications/ack';
import { useCenterStore } from '@/core/notifications/centerStore';
import { setNow } from '@/core/time/now';

const due = vi.hoisted(() => ({
  list: [] as DueNotification[],
  /** Lets a test hold the next load back; resolved by default. */
  gate: Promise.resolve() as Promise<void>,
}));
vi.mock('@/core/notifications/collect', () => ({
  collectDue: async ({ from, to }: { from: number; to: number }) => {
    await due.gate;
    return due.list.filter((n) => n.at > from && n.at <= to);
  },
}));
vi.mock('@/core/modules/activation', () => ({ loadModuleStates: async () => [] }));
vi.mock('@/core/modules/contributions', () => ({ activeManifests: () => [] }));

import { NotificationBell } from './NotificationBell';
import { NotificationCenter } from './NotificationCenter';

const NOW = new Date(2026, 9, 2, 12, 0).getTime();
const HOUR = 3_600_000;
const n = (key: string, title: string, at: number): DueNotification => ({ key, title, at });
const draw = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
      <NotificationCenter />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  due.gate = Promise.resolve();
  due.list = [n('a', 'Paket abholen', NOW - 3 * HOUR), n('b', 'Müll rausbringen', NOW - HOUR)];
  useCenterStore.setState({ isOpen: false, mode: 'list', open: [] });
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('notification centre', () => {
  it('the bell counts open reminders and names the count for screen readers', async () => {
    draw();
    const bell = await screen.findByRole('button', { name: 'Erinnerungen, 2 offen' });
    expect(within(bell).getByTestId('notification-count')).toHaveTextContent('2');
    expect(screen.getByRole('status')).toHaveTextContent('2 offen');
  });

  it('shows nothing automatically: no card until the bell is used', async () => {
    draw();
    await screen.findByTestId('notification-bell');
    expect(screen.queryByTestId('center-card')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Nächste Erinnerung" shows the earliest open one, "Erledigt" answers it', async () => {
    draw();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click(await screen.findByRole('button', { name: 'Nächste Erinnerung' }));
    const card = await screen.findByTestId('center-card');
    expect(within(card).getByText('Paket abholen')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Erledigt' }));
    await waitFor(async () => expect(await isAcked('a')).toBe(true));
    await screen.findByRole('button', { name: 'Erinnerungen, 1 offen' });
    expect(screen.queryByTestId('center-card')).toBeNull();
  });

  it('a choice made while the centre is still loading is not undone when the load finishes', async () => {
    draw();
    await screen.findByRole('button', { name: 'Erinnerungen, 2 offen' });
    let release!: () => void;
    due.gate = new Promise<void>((resolve) => (release = resolve));
    fireEvent.click(screen.getByTestId('notification-bell')); // starts a load that waits at the gate
    fireEvent.click(await screen.findByRole('button', { name: 'Nächste Erinnerung' }));
    const card = await screen.findByTestId('center-card');
    expect(within(card).getByText('Paket abholen')).toBeInTheDocument();
    release();
    // Let the held-back load finish (it used to reset the view to the list).
    await new Promise((r) => setTimeout(r, 50));
    expect(
      within(screen.getByTestId('center-card')).getByText('Paket abholen'),
    ).toBeInTheDocument();
  });

  it('"Zufällige Erinnerung" offers "Noch eine" and a different one', async () => {
    draw();
    useCenterStore.getState().openCenter('random');
    const card = await screen.findByTestId('center-card');
    const first = within(card).getAllByText(/Paket abholen|Müll rausbringen/)[0]!.textContent;
    fireEvent.click(within(card).getByRole('button', { name: 'Noch eine' }));
    const second = within(await screen.findByTestId('center-card')).getAllByText(
      /Paket abholen|Müll rausbringen/,
    )[0]!.textContent;
    expect(second).not.toBe(first);
  });

  it('"Später" removes the reminder from the list; "Alle gelesen" empties it', async () => {
    draw();
    useCenterStore.getState().openCenter('next');
    const card = await screen.findByTestId('center-card');
    fireEvent.click(within(card).getByRole('button', { name: 'Später' }));
    fireEvent.click(await screen.findByRole('button', { name: 'In 1 Std' }));
    await screen.findByRole('button', { name: 'Erinnerungen, 1 offen' });
    fireEvent.click(await screen.findByRole('button', { name: 'Alle gelesen' }));
    expect(await screen.findByText('Keine offenen Erinnerungen.')).toBeInTheDocument();
  });

  it('the dialog opens from the store and closes with Escape', async () => {
    draw();
    useCenterStore.getState().openCenter('list');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    useCenterStore.getState().closeCenter();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
