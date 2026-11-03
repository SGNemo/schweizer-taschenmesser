/**
 * Profiles: a named set of the allow-listed settings (`values.ts`) that switches many at once. Three
 * built-ins ("Ruhig", "Arbeit", "Abends"), own ones in the synced scope `profiles`; which profile is
 * active is not stored but derived (the profile whose values all match right now). Optional schedules
 * (device-local) switch a profile at a time while the app is open; a switch by hand holds until the
 * next scheduled time. Nothing security related is in a profile (`values.ts`, pinned by a test).
 */
import { z } from 'zod';
import { now, toDateString } from '@/core/time/now';
import { TIME_RE } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tSettings3 } from '@/strings.settings3';
import { sameValue } from './changed';
import { readValues, valuesSchema, writeValues, ALL_VALUE_KEYS, type Values } from './values';
import { getSettings, setSettings, useSettings } from './settings';

export const PROFILES_SCOPE = 'profiles';
const MAX_PROFILES = 12;

export const profileSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(40),
  values: valuesSchema,
});
export type Profile = z.infer<typeof profileSchema>;

const profilesSettingsSchema = z.object({ items: z.array(profileSchema).max(MAX_PROFILES) });
const DEFAULT_PROFILES = { items: [] as Profile[] };

export type BuiltinId = 'quiet' | 'work' | 'evening';
export const BUILTIN_IDS: readonly BuiltinId[] = ['quiet', 'work', 'evening'];

/** What each built-in sets. Calm things only; reminders keep arriving, quiet hours are the same switch as in Settings. */
const BUILTIN_VALUES: Record<BuiltinId, Values> = {
  quiet: { colorMode: 'calm', motion: 'reduce', homeView: 'calm', quietHours: true },
  work: { density: 'compact', colorMode: 'full', calmAttention: true, maxPerHour: 3 },
  evening: { theme: 'dark', colorMode: 'calm', motion: 'reduce', quietHours: true },
};

/** The built-in profiles in the current language. */
export function builtinProfiles(): Profile[] {
  const names = tSettings3.get().profiles.builtin;
  return BUILTIN_IDS.map((id) => ({
    id,
    name: names[id],
    values: BUILTIN_VALUES[id] as Profile['values'],
  }));
}

export const isBuiltinProfile = (id: string): boolean =>
  (BUILTIN_IDS as readonly string[]).includes(id);

export async function loadCustomProfiles(): Promise<Profile[]> {
  const s = await getSettings(PROFILES_SCOPE, profilesSettingsSchema, DEFAULT_PROFILES);
  return s.items;
}

/** Custom profiles for components (empty until loaded). */
export function useCustomProfiles(): Profile[] {
  const [v] = useSettings(PROFILES_SCOPE, profilesSettingsSchema, DEFAULT_PROFILES);
  return v?.items ?? [];
}

const newId = () => `p-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Saves the current values of every profile key as a new profile. Returns it, or `undefined` when the name is empty or the limit is reached. */
export async function saveCurrentAsProfile(name: string): Promise<Profile | undefined> {
  const clean = name.trim().slice(0, 40);
  const items = await loadCustomProfiles();
  if (!clean || items.length >= MAX_PROFILES) return undefined;
  const profile: Profile = {
    id: newId(),
    name: clean,
    values: (await readValues(ALL_VALUE_KEYS)) as Profile['values'],
  };
  await setSettings(PROFILES_SCOPE, { items: [...items, profile] });
  return profile;
}

export async function deleteProfile(id: string): Promise<Profile | undefined> {
  const items = await loadCustomProfiles();
  const gone = items.find((p) => p.id === id);
  if (!gone) return undefined;
  await setSettings(PROFILES_SCOPE, { items: items.filter((p) => p.id !== id) });
  return gone;
}

/** Puts a deleted profile back (the toast's undo). */
export async function restoreProfile(profile: Profile): Promise<void> {
  const items = await loadCustomProfiles();
  if (!items.some((p) => p.id === profile.id)) {
    await setSettings(PROFILES_SCOPE, { items: [...items, profile] });
  }
}

/** Is every value of the profile what is set right now? */
export function matches(profile: Profile, current: Values): boolean {
  const keys = Object.keys(profile.values) as (keyof Values)[];
  return keys.length > 0 && keys.every((k) => sameValue(profile.values[k as never], current[k]));
}

/** Switches to a profile and confirms with a toast whose action puts the previous values back. */
export async function applyProfile(
  profile: Profile,
  how: 'manual' | 'schedule' = 'manual',
): Promise<void> {
  const before = await writeValues(profile.values);
  const p = tSettings3.get().profiles;
  useUiStore
    .getState()
    .toast(how === 'schedule' ? p.scheduleApplied(profile.name) : p.applied(profile.name), {
      label: t.ui.undo,
      run: () => void writeValues(before),
    });
}

/* ---- schedules (device-local) ---- */

export const scheduleSchema = z.object({
  id: z.string().min(1).max(40),
  profileId: z.string().min(1).max(40),
  /** 0 = Sunday … 6 = Saturday (`Date.getDay`). */
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  time: z.string().regex(TIME_RE),
});
export type Schedule = z.infer<typeof scheduleSchema>;

const SCHEDULES_KEY = 'tm-profile-schedules';
const LAST_KEY = 'tm-profile-last';

export function readSchedules(): Schedule[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SCHEDULES_KEY) ?? '[]');
    return z.array(scheduleSchema).catch([]).parse(raw);
  } catch {
    return [];
  }
}

export function writeSchedules(items: readonly Schedule[]): void {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(items));
  } catch {
    // storage blocked: schedules simply do not persist
  }
}

export const newSchedule = (profileId: string): Schedule => ({
  id: newId(),
  profileId,
  days: [1, 2, 3, 4, 5],
  time: '20:00',
});

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * The schedule that is due at `at`: of today's matching schedules whose time has passed, the latest.
 * `last` is the key of the one already run, so it runs once per day and time and a switch by hand
 * after it stays until the next scheduled time. Pure.
 */
export function dueSchedule(
  at: Date,
  schedules: readonly Schedule[],
  last?: string,
): { schedule: Schedule; key: string } | undefined {
  const time = hhmm(at);
  let best: Schedule | undefined;
  for (const s of schedules) {
    if (!s.days.includes(at.getDay()) || s.time > time) continue;
    if (!best || s.time >= best.time) best = s;
  }
  if (!best) return undefined;
  const key = `${toDateString(at)}|${best.id}|${best.time}`;
  return key === last ? undefined : { schedule: best, key };
}

/** Runs the due schedule, if any (skips a profile that no longer exists). */
export async function runDueSchedule(): Promise<void> {
  const schedules = readSchedules();
  if (schedules.length === 0) return;
  let last: string | undefined;
  try {
    last = localStorage.getItem(LAST_KEY) ?? undefined;
  } catch {
    last = undefined;
  }
  const due = dueSchedule(new Date(now()), schedules, last);
  if (!due) return;
  try {
    localStorage.setItem(LAST_KEY, due.key);
  } catch {
    // without storage it would run again next minute: stop here
    return;
  }
  const profile = [...builtinProfiles(), ...(await loadCustomProfiles())].find(
    (p) => p.id === due.schedule.profileId,
  );
  if (profile) await applyProfile(profile, 'schedule');
}

/** Checks schedules now and every minute while the app is open. Returns the stop function. */
export function startProfileScheduler(): () => void {
  void runDueSchedule();
  const timer = setInterval(() => void runDueSchedule(), 60_000);
  return () => clearInterval(timer);
}
