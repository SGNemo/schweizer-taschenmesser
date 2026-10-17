/**
 * Calm defaults (focus audit 2): a fresh installation starts with the calm home view and without
 * streaks, week review and the "Jetzt" strips on module pages. An installation that already existed
 * keeps what it had: at the first start of this version its values are written explicitly (only
 * where nothing was stored), so a changed default never changes an existing app. Device-local
 * marker in `_meta`; running again changes nothing.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { setSettings, settingsRepo } from '@/core/settings/settings';
import { FOCUS_SCOPE } from '@/core/settings/focus';

export const DEFAULTS_ERA_KEY = 'focus.defaultsEra';
const HOME_VIEW_STORAGE_KEY = 'tm-home-view';

/** What these settings were before the calm defaults (kept for installations that already existed). */
export const LEGACY_FOCUS_DEFAULTS = { moduleNow: true, streaks: true, weekReview: true } as const;

export async function applyDefaultsEra(
  fresh: boolean,
  setHomeView: (view: 'all') => void,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const meta = database.table<{ key: string; value: unknown }, string>('_meta');
  if (await meta.get(DEFAULTS_ERA_KEY)) return;
  if (!fresh) {
    const row = (await settingsRepo.get(FOCUS_SCOPE)) as Record<string, unknown> | undefined;
    const missing = Object.entries(LEGACY_FOCUS_DEFAULTS).filter(([key]) => !row || !(key in row));
    if (missing.length > 0) {
      await setSettings(FOCUS_SCOPE, Object.fromEntries(missing));
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(HOME_VIEW_STORAGE_KEY);
    } catch {
      // Storage blocked: the view stays on its default for this session.
    }
    if (stored === null) setHomeView('all');
  }
  await meta.put({ key: DEFAULTS_ERA_KEY, value: 1 });
}
