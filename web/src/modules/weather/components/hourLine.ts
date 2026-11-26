import type { HourRow, NowDetail } from '@/core/weather/api';
import { compassIndex } from '@/core/weather/air';
import type { tWeatherPage } from '@/strings.weatherPage';
import { dec } from './parts';

type Tp = ReturnType<typeof tWeatherPage.get>;

/** Visibility is named only under this distance, m (COPY §3). */
export const VIS_SHOWN_M = 10_000;

/** "8 km", "0,9 km": whole kilometres from 1 km on, one decimal below. */
export const visKm = (m: number): string =>
  m >= 1000 ? String(Math.round(m / 1000)) : dec(m / 1000);

/** The wind direction (where it blows from) as a word: "Südwest". */
export const dirWord = (tp: Tp, deg: number): string => tp.dirName[compassIndex(deg)]!;

/**
 * The hour line under the cards (CONCEPT-INFO §2, COPY §3): felt temperature · gusts and direction · humidity ·
 * dew point · cloud · pressure · UV (by day) · visibility (under 10 km), each only with a value. For "Jetzt" it
 * repeats nothing the head says, so it starts with the gusts, and the current values win over the hour's.
 */
export function hourLineParts(tp: Tp, h: HourRow, now?: NowDetail): string[] {
  const l = tp.line;
  const gust = now?.gust ?? h.gust;
  const dir = now?.dir ?? h.dir;
  const hum = now?.hum ?? h.hum;
  const cloud = now?.cloud ?? h.cloud;
  const hpa = now?.hpa ?? h.hpa;
  return [
    ...(!now && h.feels != null ? [l.feels(h.feels)] : []),
    ...(gust != null ? [dir != null ? l.gusts(gust, dirWord(tp, dir)) : l.gustsOnly(gust)] : []),
    ...(hum != null ? [l.humidity(hum)] : []),
    ...(h.dew != null ? [l.dew(h.dew)] : []),
    ...(cloud != null ? [l.cloud(cloud)] : []),
    ...(hpa != null ? [l.hpa(hpa)] : []),
    ...(!h.night && h.uv != null && h.uv >= 1 ? [l.uv(dec(h.uv))] : []),
    ...(h.vis != null && h.vis < VIS_SHOWN_M ? [l.vis(visKm(h.vis))] : []),
  ];
}
