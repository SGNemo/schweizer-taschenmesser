/**
 * Severe-weather notification: at most one for today (07:30) and one for tomorrow (the evening before, 18:00),
 * only when the setting is on. Own hints from the cached forecast, not official warnings; `soft` (the calm policy
 * moves it out of quiet hours and folds it into the hourly summary) and `local` (never uploaded for Web Push).
 */
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { toEpoch } from '@/core/time/dates';
import { today as todayStr } from '@/core/time/now';
import { addDaysStr } from '@/core/time/dates';
import { getWeatherSettings } from '@/core/weather/settings';
import { tWeatherPage } from '@/strings.weatherPage';
import { warningLine } from './attention';
import { settings, settingsSchema } from './settings';
import { warningsNow } from './warningsToday';

const source: NotificationSource = async (range) => {
  const prefs = await getSettings('module.weather', settingsSchema, settings.defaults as never);
  if (!(prefs as { warnNotify: boolean }).warnNotify) return [];
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  const warnings = await warningsNow(today);
  if (warnings.length === 0) return [];
  const place = (await getWeatherSettings()).place;
  const slots = [
    { day: today, at: toEpoch(today, '07:30') },
    { day: tomorrow, at: toEpoch(today, '18:00') },
  ];
  const out: DueNotification[] = [];
  for (const { day, at } of slots) {
    if (at <= range.from || at > range.to) continue;
    const mine = warnings.filter((w) => w.date === day);
    if (mine.length === 0) continue;
    out.push({
      key: `weather-warn:${place}:${day}`,
      at,
      title: tWeatherPage.get().warnNotifyTitle,
      body: mine.map((w) => warningLine(w, today)).join(' · '),
      url: '/weather',
      soft: true,
      local: true,
    });
  }
  return out;
};

export default source;
