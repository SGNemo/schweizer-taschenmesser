/**
 * Default set of a fresh installation (UI audit 2026-11, package V-1): a new device starts with lists, budgets and,
 * in the desktop app, downloads switched on. Existing installations and sync partners stay as they are, so the set is
 * never written as a `_modules` row (that table syncs: a row written by a default would switch the module on for the
 * whole household by last-write-wins). It lives device-local in `_meta` and only fills the gap where no row exists:
 *
 *   `defaults.version`  number of the default set this device started with; written once on a fresh installation,
 *                       never raised later (a newer set is for installations from then on)
 *   `defaults.off`      modules of the set this device took out again without a household choice (only the profile
 *                       step of the setup writes it)
 *
 * Every explicit choice in the app (library, import, error card) writes a row as before, and a row always wins.
 * `_meta` is neither synced nor part of a backup.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

export const DEFAULTS_VERSION_KEY = 'defaults.version';
export const DEFAULTS_OFF_KEY = 'defaults.off';
/** The set a fresh installation gets today. */
export const CURRENT_DEFAULTS_VERSION = 4;

/**
 * Modules per default set. `downloads` only exists in the desktop app (`manifest.platforms`), so it is simply not
 * among the available manifests elsewhere.
 */
const SETS: Readonly<Record<number, readonly string[]>> = {
  4: ['lists', 'budgets', 'downloads'],
};

/** The modules a fresh installation gets today (for lists outside the app: README, user docs, website catalog). */
export const currentDefaultSet = (): readonly string[] => SETS[CURRENT_DEFAULTS_VERSION] ?? [];

export interface DefaultsOverlay {
  /** Modules that count as on where no row says otherwise. */
  on: ReadonlySet<string>;
}

export const NO_OVERLAY: DefaultsOverlay = { on: new Set() };

const metaOf = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

/**
 * The test builds (`vite build --mode e2e` / `e2e-seed`, the same test `isE2eBuild` in core/platform/web.ts uses)
 * keep the default set off, so every fresh test context is the app the suites, the stimulus measurement and the
 * seed guards were written for; one spec switches it on for its context (`localStorage.__tmDefaultsOn`). Release,
 * Dev-Preview and the native apps build in production mode and never get here.
 */
function switchedOff(): boolean {
  const mode = import.meta.env.MODE;
  if (mode !== 'e2e' && mode !== 'e2e-seed') return false;
  try {
    return localStorage.getItem('__tmDefaultsOn') !== '1';
  } catch {
    return true;
  }
}

/** A fresh installation notes the default set it starts with; anything else is left alone. Running again changes nothing. */
export async function markFreshDefaults(
  fresh: boolean,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  if (!fresh || switchedOff()) return;
  const meta = metaOf(database);
  if (await meta.get(DEFAULTS_VERSION_KEY)) return;
  await meta.put({ key: DEFAULTS_VERSION_KEY, value: CURRENT_DEFAULTS_VERSION });
}

/** The overlay of this device: empty without `defaults.version` (every installation that existed before). */
export async function loadDefaultsOverlay(
  database: TaschenmesserDB = defaultDb,
): Promise<DefaultsOverlay> {
  const meta = metaOf(database);
  const version = (await meta.get(DEFAULTS_VERSION_KEY))?.value;
  const set = typeof version === 'number' ? SETS[version] : undefined;
  if (!set) return NO_OVERLAY;
  const off = (await meta.get(DEFAULTS_OFF_KEY))?.value;
  const taken = new Set(Array.isArray(off) ? off.filter((x) => typeof x === 'string') : []);
  return { on: new Set(set.filter((id) => !taken.has(id))) };
}

async function writeOff(
  change: (off: Set<string>) => void,
  database: TaschenmesserDB,
): Promise<void> {
  const meta = metaOf(database);
  const stored = (await meta.get(DEFAULTS_OFF_KEY))?.value;
  const off = new Set<string>(
    Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : [],
  );
  const before = off.size;
  change(off);
  if (off.size === before) return;
  await meta.put({ key: DEFAULTS_OFF_KEY, value: [...off].sort() });
}

/** This device does without a module of its default set; nothing is said to the household. */
export const takeOutOfDefaults = (
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> => writeOff((off) => off.add(moduleId), database);

/** An explicit "on" ends a device-local "off" (the row written next to it is what counts from then on). */
export const putBackIntoDefaults = (
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> => writeOff((off) => off.delete(moduleId), database);
