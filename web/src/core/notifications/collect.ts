/**
 * Everything that wants to notify, in one place: the modules' sources plus the app's own ("Später",
 * end of a focus round), passed through the calm policy (quiet hours, limit per hour). All channels
 * (in-app scheduler, Android schedule, Web Push upload) call this, so they agree.
 */
import { automationDue } from '@/core/automation/notices';
import { focusEndDue } from '@/core/focus/notify';
import { collectNotifications } from '@/core/modules/contributions';
import type { DueNotification, ModuleManifest } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { getFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { getGameSettings, quietChannelWanted } from './gameMode';
import { getMute } from './mute';
import { manifestsForChannel, type Channel } from './channels';
import { applyPolicy } from './policy';
import { getSnoozed, snoozedDue } from './snooze';

/** Quiet hours may move automatic extras by up to this much, so the query starts that early. */
const WIDEN_MS = 14 * 60 * 60 * 1000;

/**
 * `channel` limits the module sources to those not switched off for it in Settings → Benachrichtigungen
 * (the app's own "Später" and focus-round notices always pass); without it every source counts.
 */
export async function collectDue(
  range: { from: number; to: number },
  manifests: readonly ModuleManifest[],
  channel?: Channel,
): Promise<DueNotification[]> {
  const wide = { from: range.from - WIDEN_MS, to: range.to };
  const settings = await getFocusSettings();
  const [fromModules, snoozed, focus, rules] = await Promise.all([
    collectNotifications(wide, manifestsForChannel(manifests, settings.notifyChannels, channel)),
    getSnoozed().catch(() => []),
    focusEndDue().catch(() => []),
    automationDue(wide).catch(() => []),
  ]);
  const own = [...snoozedDue(snoozed, wide, getPlatform().kind), ...focus, ...rules];
  const adjusted = applyPolicy(
    [...fromModules, ...own],
    {
      quiet: settings.quietHours ? { from: settings.quietFrom, to: settings.quietTo } : undefined,
      maxPerHour: settings.maxPerHour,
      // A pause that already ended still covers the repeats that fell inside it.
      mute: getMute(wide.from),
      quietAll: quietChannelWanted(getPlatform().kind, getGameSettings()),
    },
    t.notifications.summary,
  );
  return adjusted.filter((n) => n.at > range.from && n.at <= range.to);
}
