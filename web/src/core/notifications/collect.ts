/**
 * Everything that wants to notify, in one place: the modules' sources plus the app's own ("Später",
 * end of a focus round), passed through the calm policy (quiet hours, limit per hour). All channels
 * (in-app scheduler, Android schedule, Web Push upload) call this, so they agree.
 */
import { focusEndDue } from '@/core/focus/notify';
import { collectNotifications } from '@/core/modules/contributions';
import type { DueNotification, ModuleManifest } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { getFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { applyPolicy } from './policy';
import { getSnoozed, snoozedDue } from './snooze';

/** Quiet hours may move automatic extras by up to this much, so the query starts that early. */
const WIDEN_MS = 14 * 60 * 60 * 1000;

export async function collectDue(
  range: { from: number; to: number },
  manifests: readonly ModuleManifest[],
): Promise<DueNotification[]> {
  const wide = { from: range.from - WIDEN_MS, to: range.to };
  const [fromModules, snoozed, focus, settings] = await Promise.all([
    collectNotifications(wide, manifests),
    getSnoozed().catch(() => []),
    focusEndDue().catch(() => []),
    getFocusSettings(),
  ]);
  const own = [...snoozedDue(snoozed, wide, getPlatform().kind), ...focus];
  const adjusted = applyPolicy(
    [...fromModules, ...own],
    {
      quiet: settings.quietHours ? { from: settings.quietFrom, to: settings.quietTo } : undefined,
      maxPerHour: settings.maxPerHour,
    },
    t.notifications.summary,
  );
  return adjusted.filter((n) => n.at > range.from && n.at <= range.to);
}
