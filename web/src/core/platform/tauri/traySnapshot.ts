/**
 * The tray's "Heute" block (Windows app): a small snapshot of today – at most 5 lines with a short
 * title and a time, plus where each line leads. The web app builds it, Rust only shows the labels
 * (`desktop_set_tray_today` in `src-tauri/src/capture.rs`); a click comes back as a fixed event
 * with the line's index, and the route is looked up here. Nothing of it is stored or logged.
 *
 * Read-only and narrow on purpose: only the ToDos and the calendar contribute (their public
 * `calendarItems` and `attention` contributions), never amounts, the vault or note contents.
 * Refreshed on every change to those tables (Dexie live query) and every 5 minutes (time passes).
 */
import { invoke } from '@tauri-apps/api/core';
import { liveQuery } from 'dexie';
import { loadModuleStates } from '@/core/modules/activation';
import {
  activeManifests,
  collectAttention,
  collectCalendarItems,
} from '@/core/modules/contributions';
import type { AttentionItem, CalendarItem } from '@/core/modules/types';
import { now, pad2, today } from '@/core/time/now';
import { t } from '@/strings';
import type { DesktopService, TrayToday } from '../types';

export const TRAY_LINES = 5;
export const TRAY_TITLE_CHARS = 40;
export const TRAY_REFRESH_MS = 5 * 60_000;
/** The only modules whose entries may appear in the tray. */
export const TRAY_SOURCES: readonly string[] = ['todos', 'calendar'];
/** The DOM event the shell dispatches into the main window for a tray click (detail: item id). */
export const TRAY_ITEM_EVENT = 'tm-tray-item';

export interface TrayLine {
  label: string;
  /** In-app route the line opens. */
  route: string;
  /** For a ToDo: its focus screen ("Jetzt dran anfangen"). */
  focus?: string;
}

/** Money never goes into the tray, also not inside a title ("Strom 54,30 €" → "Strom"). */
const AMOUNT =
  /(?:[€$£]|\b(?:EUR|CHF|USD|Euro)\b)\s?[-+]?\d[\d.,'’ ]*|[-+]?\d[\d.,'’]*\s?(?:[€$£]|\b(?:EUR|CHF|USD|Euro|Franken)\b)/gi;

export function trayTitle(title: string): string {
  const clean = title.replace(AMOUNT, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > TRAY_TITLE_CHARS
    ? `${clean.slice(0, TRAY_TITLE_CHARS - 1).trimEnd()}…`
    : clean;
}

/** Only app-internal paths; anything else opens the start page. */
const safeRoute = (to: string | undefined): string =>
  to && to.startsWith('/') && !to.startsWith('//') && !/[\s\\]/.test(to) ? to : '/';

export interface TrayInput {
  items: readonly CalendarItem[];
  /** "Jetzt wichtig" items of the allowed modules only (the caller filters by module). */
  attention: readonly AttentionItem[];
  day: string;
  nowHhmm: string;
}

/**
 * What the tray shows: first overdue things ("Jetzt wichtig", danger only), then today's open
 * entries that have not ended, untimed first, then by time. Titles only (no details,
 * which may hold amounts), cut to 40 characters; each title once; at most 5 lines.
 */
export function selectTrayToday(input: TrayInput): TrayLine[] {
  const lines: TrayLine[] = [];
  const seen = new Set<string>();
  const add = (title: string, line: Omit<TrayLine, 'label'>, time?: string) => {
    const text = trayTitle(title);
    const key = text.toLowerCase();
    if (!text || seen.has(key) || lines.length >= TRAY_LINES) return;
    seen.add(key);
    lines.push({ ...line, label: time ? `${time} · ${text}` : text });
  };
  for (const a of input.attention) {
    // Overdue only: what is due today comes with its time from the calendar items below.
    if (a.tone === 'danger') add(a.title, { route: safeRoute(a.to) });
  }
  const open = input.items
    .filter(
      (i) =>
        TRAY_SOURCES.includes(i.source) &&
        i.date === input.day &&
        !i.done &&
        !i.continued &&
        (i.allDay || !i.time || (i.endTime ?? i.time) >= input.nowHhmm),
    )
    .sort((a, b) =>
      (a.allDay || !a.time ? '' : a.time).localeCompare(b.allDay || !b.time ? '' : b.time),
    );
  for (const i of open) {
    const task = i.source === 'todos' && i.kind === 'task' ? i.id.split(':')[0] : undefined;
    add(
      i.title,
      {
        route: safeRoute(i.to),
        focus: task ? `/todos/focus/${encodeURIComponent(task)}` : undefined,
      },
      i.allDay ? undefined : i.time,
    );
  }
  return lines;
}

/** The labels Rust gets; an empty list hides the block. */
export function trayTodayLabels(lines: readonly TrayLine[]): TrayToday {
  const s = t.quickCapture.trayToday;
  return { heading: s.heading, items: lines.map((l) => l.label), now: s.now, timer: s.timer };
}

/** What a tray click asks for: a route to open, or the 25-minute timer. */
export type TrayAction = { kind: 'route'; route: string } | { kind: 'timer' };

let current: TrayLine[] = [];
/** Re-reads and re-sends at once (e.g. after the switch in Settings changed); set while running. */
let kick: (() => void) | undefined;

export function refreshTraySnapshot(): void {
  kick?.();
}

/** Resolves a clicked item id (`today-0`…`today-4`, `now`, `timer`) against the shown lines. */
export function trayAction(
  id: string,
  lines: readonly TrayLine[] = current,
): TrayAction | undefined {
  if (id === 'timer') return { kind: 'timer' };
  if (id === 'now') {
    const first = lines.find((l) => l.focus) ?? lines[0];
    return first ? { kind: 'route', route: first.focus ?? first.route } : undefined;
  }
  const m = /^today-([0-4])$/.exec(id);
  const line = m ? lines[Number(m[1])] : undefined;
  return line ? { kind: 'route', route: line.route } : undefined;
}

/** Reads today's lines from the allowed modules (read-only). */
export async function composeTrayToday(at = new Date(now())): Promise<TrayLine[]> {
  const states = await loadModuleStates();
  const manifests = activeManifests(states).filter((m) => TRAY_SOURCES.includes(m.id));
  if (manifests.length === 0) return [];
  const day = today();
  const [items, attention] = await Promise.all([
    collectCalendarItems({ from: day, to: day }, manifests),
    collectAttention(day, manifests),
  ]);
  return selectTrayToday({
    items,
    attention,
    day,
    nowHhmm: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
  });
}

const send = (desktop: DesktopService, today: TrayToday): Promise<void> =>
  desktop.setTrayToday
    ? desktop.setTrayToday(today)
    : invoke<void>('desktop_set_tray_today', { today });

/**
 * Keeps the tray block current while `enabled()` is true: on every change to the contributing
 * tables and every 5 minutes. When switched off it sends one empty snapshot (block hidden).
 * Returns a stop function. Sends only when the labels changed.
 */
export function startTraySnapshot(desktop: DesktopService, enabled: () => boolean): () => void {
  let last = '';
  let stopped = false;
  const push = async (lines: TrayLine[]) => {
    if (stopped) return;
    const next = enabled() ? lines : [];
    const labels = trayTodayLabels(next);
    const key = JSON.stringify(labels);
    current = next;
    if (key === last) return;
    last = key;
    try {
      await send(desktop, labels);
    } catch {
      // An older shell without the command: the tray simply keeps its old menu.
    }
  };
  const refresh = () => void composeTrayToday().then(push, () => undefined);
  const sub = liveQuery(() => composeTrayToday()).subscribe({
    next: (lines) => void push(lines),
    error: () => undefined,
  });
  const timer = setInterval(refresh, TRAY_REFRESH_MS);
  kick = refresh;
  return () => {
    stopped = true;
    if (kick === refresh) kick = undefined;
    sub.unsubscribe();
    clearInterval(timer);
  };
}

/** Listens for tray clicks the shell dispatches into the main window. */
export function onTrayItem(callback: (id: string) => void): () => void {
  const listener = (e: Event) => {
    const id = (e as CustomEvent<unknown>).detail;
    if (typeof id === 'string') callback(id);
  };
  window.addEventListener(TRAY_ITEM_EVENT, listener);
  return () => window.removeEventListener(TRAY_ITEM_EVENT, listener);
}
