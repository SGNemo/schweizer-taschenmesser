// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { setPlatform, type DesktopService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import type { TrayToday } from '@/core/platform/types';
import type { AttentionItem, CalendarItem } from '@/core/modules/types';
import { setNow } from '@/core/time/now';
import { saveCapture } from '@/quickCapture/targets';

const invoke = vi.hoisted(() =>
  vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => null),
);
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  TRAY_ITEM_EVENT,
  composeTrayToday,
  onTrayItem,
  selectTrayToday,
  startTraySnapshot,
  trayAction,
  trayTitle,
  trayTodayLabels,
} from './traySnapshot';

const DAY = '2026-09-30';
const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: 'x',
  source: 'calendar',
  kind: 'event',
  title: 'Termin',
  date: DAY,
  allDay: false,
  to: '/calendar',
  ...over,
});
const attention = (over: Partial<AttentionItem>): AttentionItem => ({
  id: 'a',
  tone: 'danger',
  icon: 'alert',
  title: 'Überfällig',
  to: '/todos',
  ...over,
});

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
  invoke.mockClear();
});
afterEach(() => {
  setNow();
  setPlatform(undefined);
});

describe('trayTitle', () => {
  it('cuts to 40 characters with an ellipsis', () => {
    const long = 'Ein sehr langer Titel, der weit über vierzig Zeichen hinausgeht';
    expect(trayTitle(long)).toHaveLength(40);
    expect(trayTitle(long).endsWith('…')).toBe(true);
    expect(trayTitle('Kurz')).toBe('Kurz');
  });

  it('never carries an amount', () => {
    for (const title of [
      'Strom 54,30 € zahlen',
      'Strom € 54,30 zahlen',
      'Strom 54.30 EUR zahlen',
      'Strom CHF 1’234.50 zahlen',
      'Strom 54 Euro zahlen',
    ]) {
      expect(trayTitle(title), title).toBe('Strom zahlen');
    }
    expect(trayTitle('Zahnarzt 9 Uhr')).toBe('Zahnarzt 9 Uhr');
  });
});

describe('selectTrayToday', () => {
  it('lists overdue things first, then today by time, at most 5, each title once', () => {
    const lines = selectTrayToday({
      day: DAY,
      nowHhmm: '10:00',
      attention: [
        attention({ title: 'Steuer abgeben' }),
        attention({ title: 'Nur ein Hinweis', tone: 'warning' }),
        attention({ title: 'Zahnarzt heute', tone: 'accent' }),
      ],
      items: [
        item({ title: 'Sport', time: '18:00' }),
        item({ title: 'Zahnarzt', time: '11:30', to: '/calendar?event=1' }),
        item({ title: 'Schon vorbei', time: '08:00', endTime: '09:00' }),
        item({ title: 'Geburtstag Oma', allDay: true }),
        item({ title: 'Erledigt', time: '12:00', done: true }),
        item({ title: 'Morgen', date: '2026-10-01', time: '09:00' }),
        item({ title: 'Steuer abgeben', source: 'todos', kind: 'task', id: 't1', to: '/todos' }),
        item({
          title: 'Einkaufen',
          source: 'todos',
          kind: 'task',
          id: 't2:2026-09-30',
          to: '/todos',
        }),
        item({ title: 'Noch eins', time: '20:00' }),
      ],
    });
    expect(lines.map((l) => l.label)).toEqual([
      'Steuer abgeben',
      'Geburtstag Oma',
      'Einkaufen',
      '11:30 · Zahnarzt',
      '18:00 · Sport',
    ]);
    expect(lines[3]!.route).toBe('/calendar?event=1');
    expect(lines[2]!.focus).toBe('/todos/focus/t2');
  });

  it('negative list: no vault, no money modules, no notes, no foreign routes', () => {
    const lines = selectTrayToday({
      day: DAY,
      nowHhmm: '10:00',
      attention: [],
      items: [
        item({ source: 'accounts', title: 'Bank-Login' }),
        item({ source: 'finance', title: 'Miete 900 €' }),
        item({ source: 'invoices', title: 'Rechnung Strom' }),
        item({ source: 'notes', title: 'Geheime Notiz' }),
        item({ title: 'Kino', to: 'https://example.org' }),
        item({ title: 'Kino2', to: '//evil.example/x' }),
      ],
    });
    expect(lines.map((l) => l.label)).toEqual(['Kino', 'Kino2']);
    expect(lines.every((l) => l.route === '/')).toBe(true);
  });

  it('an empty day is an empty block', () => {
    expect(selectTrayToday({ day: DAY, nowHhmm: '10:00', attention: [], items: [] })).toEqual([]);
    expect(trayTodayLabels([]).items).toEqual([]);
  });
});

describe('trayAction', () => {
  const lines = [
    { label: '11:30 · Zahnarzt', route: '/calendar' },
    { label: 'Einkaufen', route: '/todos', focus: '/todos/focus/t2' },
  ];
  it('maps a click to the line route, "now" to the first ToDo focus, "timer" to the timer', () => {
    expect(trayAction('today-0', lines)).toEqual({ kind: 'route', route: '/calendar' });
    expect(trayAction('today-1', lines)).toEqual({ kind: 'route', route: '/todos' });
    expect(trayAction('now', lines)).toEqual({ kind: 'route', route: '/todos/focus/t2' });
    expect(trayAction('now', [lines[0]!])).toEqual({ kind: 'route', route: '/calendar' });
    expect(trayAction('timer', lines)).toEqual({ kind: 'timer' });
  });
  it('ignores unknown ids and lines that are not there', () => {
    expect(trayAction('today-4', lines)).toBeUndefined();
    expect(trayAction('today-9', lines)).toBeUndefined();
    expect(trayAction('/settings', lines)).toBeUndefined();
    expect(trayAction('now', [])).toBeUndefined();
  });
});

describe('composeTrayToday', () => {
  it('reads today from ToDos and calendar of the database', async () => {
    await saveCapture('event', { title: 'Zahnarzt', date: DAY, time: '15:00' });
    await saveCapture('todo', { title: 'Strom 54,30 € zahlen', date: DAY });
    const lines = await composeTrayToday();
    expect(lines.map((l) => l.label)).toEqual(['Strom zahlen', '15:00 · Zahnarzt']);
  });
});

describe('startTraySnapshot', () => {
  it('sends the labels, hides the block when switched off, and dispatches clicks', async () => {
    const setTrayToday = vi.fn(async (_today: TrayToday) => undefined);
    const desktop = {
      ...createWebPlatform().desktop,
      supported: true,
      setTrayToday,
    } as DesktopService;
    let on = true;
    const stop = startTraySnapshot(desktop, () => on);
    await vi.waitFor(() => expect(setTrayToday).toHaveBeenCalled());
    const first = setTrayToday.mock.calls[0]![0];
    expect(first.heading).toBe('Heute');
    on = false;
    const { refreshTraySnapshot } = await import('./traySnapshot');
    refreshTraySnapshot();
    await vi.waitFor(() => expect(setTrayToday.mock.calls.at(-1)![0]).toMatchObject({ items: [] }));
    stop();

    const seen: string[] = [];
    const off = onTrayItem((id) => seen.push(id));
    window.dispatchEvent(new CustomEvent(TRAY_ITEM_EVENT, { detail: 'today-1' }));
    window.dispatchEvent(new CustomEvent(TRAY_ITEM_EVENT, { detail: 42 }));
    off();
    expect(seen).toEqual(['today-1']);
  });

  it('falls back to the Tauri command when the platform has no setTrayToday', async () => {
    const desktop = { ...createWebPlatform().desktop, supported: true } as DesktopService;
    const stop = startTraySnapshot(desktop, () => true);
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('desktop_set_tray_today', expect.anything()),
    );
    stop();
  });
});
