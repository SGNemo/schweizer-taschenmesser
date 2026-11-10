// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type { DueNotification } from '@/core/modules/types';
import { useCenterStore } from '@/core/notifications/centerStore';
import { ReadAidContext } from '@/core/text/ReadableText';
import { setNow } from '@/core/time/now';

const due = vi.hoisted(() => ({ list: [] as DueNotification[] }));
vi.mock('@/core/notifications/collect', () => ({
  collectDue: async ({ from, to }: { from: number; to: number }) =>
    due.list.filter((n) => n.at > from && n.at <= to),
}));
vi.mock('@/core/modules/activation', () => ({ loadModuleStates: async () => [] }));
vi.mock('@/core/modules/contributions', () => ({ activeManifests: () => [] }));

import { NotificationBell } from './NotificationBell';
import { NotificationCenter } from './NotificationCenter';

/**
 * Reading aid at 100 % in the notification centre (UI audit 2026-11, package 0a-1b): a reminder of the vault names a
 * document, so its row and its card stay unmarked, as the vault page itself does; every other reminder is marked. The
 * seed data has no open vault reminder on its reference day, so this runs here and not in `e2e/seed/readaid.seed.spec.ts`.
 */
const NOW = new Date(2026, 9, 2, 12, 0).getTime();
const HOUR = 3_600_000;

beforeEach(async () => {
  setNow(() => NOW);
  due.list = [
    { key: 'todos:1', title: 'Paket abholen', at: NOW - 3 * HOUR, url: '/todos' },
    {
      key: 'vault:1:2026-10-20',
      title: 'Handyvertrag kündigen bis',
      body: 'Frist endet am Zwanzigsten',
      at: NOW - HOUR,
      url: '/vault',
    },
  ];
  useCenterStore.setState({ isOpen: false, mode: 'list', open: [] });
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

const draw = () =>
  render(
    <ReadAidContext.Provider value={{ cover: 100, share: 0.4, blocked: false }}>
      <MemoryRouter>
        <NotificationBell />
        <NotificationCenter />
      </MemoryRouter>
    </ReadAidContext.Provider>,
  );

const marks = (el: Element | null) => el?.querySelectorAll('[data-rs]').length ?? 0;

const rowOf = async (text: string) => {
  const list = await screen.findByRole('list');
  return [...list.querySelectorAll('li')].find((li) => li.textContent?.includes(text)) ?? null;
};

describe('notification centre with the reading aid at 100 %', () => {
  it('marks an ordinary reminder and leaves the vault reminder untouched', async () => {
    draw();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    const plain = await rowOf('Paket abholen');
    const vault = await rowOf('Handyvertrag');
    expect(plain).not.toBeNull();
    expect(vault).not.toBeNull();
    expect(marks(plain!.querySelector('[data-row]'))).toBeGreaterThan(0);
    expect(marks(vault!.querySelector('[data-row]'))).toBe(0);
  });

  it('leaves title and body on the card of a vault reminder untouched', async () => {
    draw();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click((await rowOf('Handyvertrag'))!.querySelector<HTMLElement>('[data-row]')!);
    const card = await screen.findByTestId('center-card');
    const spans = [...card.children].filter((e) => e.tagName === 'SPAN');
    // label (the time, marked like everywhere), then title and body of the reminder.
    expect(spans.map((e) => e.textContent)).toEqual([
      expect.stringContaining('Heute'),
      'Handyvertrag kündigen bis',
      'Frist endet am Zwanzigsten',
    ]);
    expect(marks(spans[1]!)).toBe(0);
    expect(marks(spans[2]!)).toBe(0);
  });

  it('marks title and body on the card of an ordinary reminder', async () => {
    draw();
    fireEvent.click(await screen.findByTestId('notification-bell'));
    fireEvent.click((await rowOf('Paket abholen'))!.querySelector<HTMLElement>('[data-row]')!);
    const card = await screen.findByTestId('center-card');
    const spans = [...card.children].filter((e) => e.tagName === 'SPAN');
    expect(marks(spans[1]!)).toBeGreaterThan(0);
  });
});
