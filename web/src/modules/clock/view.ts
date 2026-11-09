/** Texts of one place for the page and the widget: the time in the locale's format and the context line. */
import { dateTimeFormat } from '@/core/i18n/format';
import { t } from '@/strings';
import { diffLabel, placeTime, type PlaceTime } from './logic';

export interface PlaceLine extends PlaceTime {
  /** "23:07" or "11:07 PM", as the locale writes it; never seconds. */
  shown: string;
  /** "morgen · +8 h", "gleiche Zeit". */
  context: string;
  /** "Nacht" / "Tag". */
  dayPart: string;
}

const HOUR_MINUTE = { hour: '2-digit', minute: '2-digit' } as const;

/** The time of an instant in a zone, formatted for the UI locale (24 h or 12 h follows it). */
export const formatZoneTime = (at: number, zone: string): string =>
  dateTimeFormat({ ...HOUR_MINUTE, timeZone: zone }).format(at);

export function placeLine(at: number, zone: string, hereZone: string): PlaceLine {
  const p = placeTime(at, zone, hereZone);
  const c = t.clock;
  const day = p.dayDiff > 0 ? c.tomorrow : p.dayDiff < 0 ? c.yesterday : undefined;
  const context = [day, diffLabel(p.diffMinutes) ?? c.sameTime].filter(Boolean).join(' · ');
  return {
    ...p,
    shown: formatZoneTime(at, zone),
    context,
    dayPart: p.night ? c.night : c.day,
  };
}
