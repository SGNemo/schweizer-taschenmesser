// @vitest-environment jsdom
/**
 * The notification limits TOGETHER (docs/design/FOCUS-GUIDELINES.md "Notification limits"): hourly
 * cap, quiet hours, "Stumm", "Zock-Modus" and repeats, driven through the real calendar source,
 * `collectDue` and `checkDue` with a fixed clock. Every test names the rule it protects.
 * Single rules are covered in policy.test.ts, mute.test.ts, gameDelivery.test.ts, ack.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import type * as PlatformModule from '@/core/platform';
import type { PlatformKind } from '@/core/platform/types';
import type { ModuleManifest } from '@/core/modules/types';
import calendarSource from '@/modules/calendar/notifications';
import { eventRepo } from '@/modules/calendar/repo';
import { patchFocusSettings } from '@/core/settings/focus';
import { toEpoch } from '@/core/time/dates';
import { setNow } from '@/core/time/now';
import { ackNotification } from './ack';
import { collectDue } from './collect';
import { withGameDelivery } from './gameDelivery';
import { getGameSettings, setGameSettings } from './gameMode';
import { setMute } from './mute';
import { checkDue } from './scheduler';

const platform = vi.hoisted(() => ({ kind: 'web' as PlatformKind }));
vi.mock('@/core/platform', async (importOriginal) => {
  const real = await importOriginal<typeof PlatformModule>();
  return {
    ...real,
    getPlatform: () => Object.assign(Object.create(real.getPlatform()), { kind: platform.kind }),
  };
});

const D = '2026-10-05';
const T = (time: string, date = D) => toEpoch(date, time);
const MIN = 60_000;

const manifests = [
  { contributions: { notifications: async () => ({ default: calendarSource }) } },
] as unknown as ModuleManifest[];

interface Shown {
  at: number;
  title: string;
  tag?: string;
  quiet?: boolean;
}

/** One device: the scheduler ticking every 5 minutes against the real sources. */
function device(start: string, startDate = D) {
  let clock = T(start, startDate);
  let cursor: number | undefined = clock; // as after the first run, which only sets the cursor
  const shown: Shown[] = [];
  const tones: number[] = [];
  setNow(() => clock);
  const base = {
    permission: () => 'granted' as const,
    show: async (n: { title: string; tag?: string; quiet?: boolean }) => {
      shown.push({ at: clock, title: n.title, tag: n.tag, quiet: n.quiet });
    },
  };
  const service = withGameDelivery(base as never, {
    kind: platform.kind,
    settings: () => getGameSettings(platform.kind),
    tone: async () => void tones.push(clock),
  });
  const deps = {
    service: { permission: base.permission, show: service.show },
    loadDue: (range: { from: number; to: number }) => collectDue(range, manifests),
    getCursor: async () => cursor,
    setCursor: async (c: number) => void (cursor = c),
    now: () => clock,
  };
  return {
    shown,
    tones,
    /** Runs the scheduler up to `time` (5-minute ticks). */
    async until(time: string, date = D) {
      for (const end = T(time, date); clock < end;) {
        clock = Math.min(clock + 5 * MIN, end);
        await checkDue(deps);
      }
    },
    clock: () => clock,
    times: () => shown.map((s) => new Date(s.at).toTimeString().slice(0, 5)),
  };
}

const reminder = (title: string, time: string, over: Record<string, unknown> = {}) =>
  eventRepo.create({
    title,
    kind: 'reminder',
    allDay: false,
    startDate: D,
    startTime: time,
    notify: { enabled: true, minutesBefore: 0 },
    ...over,
  } as never);

beforeEach(async () => {
  for (const t of ['calendar_event', '_settings', '_meta']) await db.table(t).clear();
  localStorage.clear();
  platform.kind = 'web';
});
afterEach(() => {
  setNow();
});

describe('notification limits together', () => {
  it('quiet hours end a repeat series at the day edge; an answer in the morning adds nothing', async () => {
    // Rules: repeats in quiet hours are dropped, not moved; the series is not resumed in the morning.
    await patchFocusSettings({ repeatMinutes: 60, repeatMax: 20 });
    const e = await reminder('Paket', '10:00');
    const d = device('09:55');
    await d.until('23:55');
    // 10:00 itself plus repeats 11:00 … 21:00; 22:00 … 06:00 are dropped.
    expect(d.times()).toEqual(
      ['10:00', ...Array.from({ length: 11 }, (_, i) => `${11 + i}:00`)].map((x) => x),
    );
    await d.until('08:00', '2026-10-06');
    expect(d.shown).toHaveLength(12); // nothing piles up at 07:00
    await ackNotification(`event:${e.id}:${D}T10:00`);
    await d.until('12:00', '2026-10-06');
    expect(d.shown).toHaveLength(12);
  });

  it('an answer mid-series stops the repeats on the next tick', async () => {
    // Rule: "Erledigt"/"Später" ends the series.
    const e = await reminder('Paket', '10:00');
    const d = device('09:55');
    await d.until('10:35');
    expect(d.times()).toEqual(['10:00', '10:30']);
    await ackNotification(`event:${e.id}:${D}T10:00`);
    await d.until('14:00');
    expect(d.times()).toEqual(['10:00', '10:30']);
  });

  it('three reminders in one hour: nothing over the cap, repeats never displace first-time reminders', async () => {
    // Rules: max N per hour (N-1 kept + one summary); first-time reminders go before repeats.
    for (const [t, time] of [
      ['Eins', '09:00'],
      ['Zwei', '09:10'],
      ['Drei', '09:20'],
    ] as const)
      await reminder(t, time);
    const hour = { from: T('08:55'), to: T('09:59') };
    // The whole hour at once (Android schedule, Web Push upload): firsts stay, repeats are folded.
    const all = await collectDue(hour, manifests);
    expect(all.map((n) => n.title)).toEqual(['Eins', 'Zwei', 'Weitere Erinnerungen · 4']);
    expect(all[2]!.body).toContain('Drei');
    // The open app sees the hour tick by tick: the three firsts are within the cap, no repeat follows.
    const d = device('08:55');
    await d.until('09:59');
    expect(d.shown.map((s) => s.title)).toEqual(['Eins', 'Zwei', 'Drei']);
  });

  it('with the cap off (0) nothing is folded', async () => {
    // Rule: maxPerHour 0 = unlimited.
    await patchFocusSettings({ maxPerHour: 0, followUp: false });
    for (const time of ['09:00', '09:10', '09:20', '09:30']) await reminder(`R${time}`, time);
    const d = device('08:55');
    await d.until('09:59');
    expect(d.shown).toHaveLength(4);
  });

  it('"Stumm" mid-series drops the repeats inside the pause and the series goes on after it', async () => {
    // Rules: a repeat inside a pause is dropped (not moved); explicit reminders still arrive, quiet.
    await reminder('Paket', '10:00');
    await reminder('Termin', '11:15');
    const d = device('09:55');
    await d.until('10:40');
    setMute('1h', d.clock()); // 10:40 → 11:40
    await d.until('13:05');
    expect(
      d.shown.map((s) => [new Date(s.at).toTimeString().slice(0, 5), s.title, !!s.quiet]),
    ).toEqual([
      ['10:00', 'Paket', false],
      ['10:30', 'Noch offen: Paket', false],
      ['11:15', 'Termin', true], // explicit: arrives, without sound
      // r2 (11:00) and r3 (11:30) were inside the pause: dropped, and they do not count toward
      // the cap of hour 11, so the Termin's own first repeat (11:45) still arrives.
      ['11:45', 'Noch offen: Termin', false],
      ['12:00', 'Noch offen: Paket', false],
      ['12:15', 'Noch offen: Termin', false],
      ['12:30', 'Noch offen: Paket', false],
      ['13:00', 'Noch offen: Paket', false],
    ]);
  });

  it('"Zock-Modus" on and off mid-series: only what arrives in between is quiet, tone only when not muted', async () => {
    // Rules: game mode = quiet (+ the app's tone on desktop) for what arrives while it is on; a
    // reminder already quiet by "Stumm" never gets the tone.
    platform.kind = 'desktop'; // the tone exists on the desktop only
    await reminder('Paket', '10:00');
    const d = device('09:55');
    await d.until('10:10');
    setGameSettings({ mode: 'on' }, 'desktop');
    await d.until('11:10'); // r1 10:30, r2 11:00
    setGameSettings({ mode: 'off' }, 'desktop');
    await d.until('12:10'); // r3 11:30, r4 12:00
    expect(d.shown.map((s) => !!s.quiet)).toEqual([false, true, true, false, false]);
    expect(d.tones).toHaveLength(2);
    setGameSettings({ mode: 'on' }, 'desktop');
    setMute('1h', d.clock()); // 12:10 → 13:10
    await reminder('Termin', '12:45');
    await d.until('13:10'); // r5 12:30 and r6 13:00 are inside the pause: dropped
    expect(d.shown.map((s) => s.title).slice(5)).toEqual(['Termin']);
    expect(d.shown[5]).toMatchObject({ quiet: true });
    expect(d.tones).toHaveLength(2); // already quiet by "Stumm": no tone, ever
  });

  it('two devices: an answer that reaches the second device late ends its series from then on', async () => {
    // Rule: an answer is one synced field; until it arrives the other device may fire once more
    // (documented limit), afterwards never.
    const e = await reminder('Paket', '10:00');
    const b = device('09:55');
    await b.until('10:50'); // answered on device A at 10:40, not synced yet
    expect(b.times()).toEqual(['10:00', '10:30']);
    await b.until('11:05');
    expect(b.times()).toEqual(['10:00', '10:30', '11:00']);
    await ackNotification(`event:${e.id}:${D}T10:00`); // the sync arrives
    await b.until('15:00');
    expect(b.times()).toEqual(['10:00', '10:30', '11:00']);
  });

  it("a new day brings the new occurrence: yesterday's answer does not silence a daily reminder", async () => {
    // Rule: answers are per occurrence key (`…:<date>T<time>`); day change keeps the cap per hour too.
    const e = await reminder('Tabletten', '20:00', { recurrence: { freq: 'daily', interval: 1 } });
    await ackNotification(`event:${e.id}:${D}T20:00`);
    const d = device('19:55');
    await d.until('23:55');
    expect(d.times()).toEqual(['20:00']);
    await d.until('21:00', '2026-10-06');
    expect(d.times()).toEqual(['20:00', '20:00', '20:30', '21:00']);
    expect(d.shown[1]!.at).toBe(T('20:00', '2026-10-06'));
  });

  it('a reminder at 23:50 fires (explicit); its repeats across midnight are dropped', async () => {
    // Rules: explicit reminders are never moved or dropped; repeats in quiet hours are dropped.
    await reminder('Spät', '23:50');
    const d = device('23:45');
    await d.until('04:00', '2026-10-06');
    expect(d.times()).toEqual(['23:50']);
  });

  it('staged soft leads of a quiet night collapse into the morning without a flood', async () => {
    // Rules: soft extras move to the end of the quiet hours; the cap then folds the pile there.
    await patchFocusSettings({ staggered: true, stages: [60, 30, 15, 5], followUp: false });
    for (const time of ['23:30', '23:40', '23:50'])
      await reminder(`E${time}`, time, { notify: { enabled: true, minutesBefore: 0 } });
    // evaluate the whole night in one go, as after a closed app
    const out = await collectDue({ from: T('22:00'), to: T('07:30', '2026-10-06') }, manifests);
    const morning = out.filter((n) => n.at === T('07:00', '2026-10-06'));
    expect(morning.length).toBeLessThanOrEqual(3);
    expect(out.filter((n) => !n.soft && n.key.startsWith('event:')).map((n) => n.at)).toEqual([
      T('23:30'),
      T('23:40'),
      T('23:50'),
    ]);
  });

  it('DST night: 02:30 does not exist on 2026-03-29 (Europe/Berlin); the reminder fires once, at 03:30', async () => {
    // Documented edge case: the wall-clock time is normalised forward by the platform.
    const before = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
    try {
      expect(new Date(2026, 2, 29, 2, 30).getHours()).toBe(3);
      const e = await reminder('Nacht', '02:30', { startDate: '2026-03-29' });
      const out = await collectDue(
        { from: new Date(2026, 2, 29, 0, 0).getTime(), to: new Date(2026, 2, 29, 12, 0).getTime() },
        manifests,
      );
      const first = out.filter((n) => n.key.startsWith(`event:${e.id}:`) && !n.key.includes(':r'));
      expect(first).toHaveLength(1);
      expect(new Date(first[0]!.at).getHours()).toBe(3);
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });
});
