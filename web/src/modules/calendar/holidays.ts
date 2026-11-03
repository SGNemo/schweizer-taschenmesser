import { addDaysStr } from '@/core/time/dates';

/**
 * Public holidays, computed offline (no network, no data file to age). Rules per region; the names
 * are looked up by `HolidayId` in the UI strings. Regional exceptions that depend on the community
 * (e.g. Mariä Himmelfahrt in parts of Bavaria) are left out on purpose: better silent than wrong.
 */
export const HOLIDAY_REGIONS = [
  'off',
  'de',
  'de-bw',
  'de-by',
  'de-be',
  'de-bb',
  'de-hb',
  'de-hh',
  'de-he',
  'de-mv',
  'de-ni',
  'de-nw',
  'de-rp',
  'de-sl',
  'de-sn',
  'de-st',
  'de-sh',
  'de-th',
  'at',
  'ch',
] as const;
export type HolidayRegion = (typeof HOLIDAY_REGIONS)[number];

export type HolidayId =
  | 'newYear'
  | 'epiphany'
  | 'womensDay'
  | 'goodFriday'
  | 'easterSunday'
  | 'easterMonday'
  | 'labourDay'
  | 'ascension'
  | 'whitSunday'
  | 'whitMonday'
  | 'corpusChristi'
  | 'swissNationalDay'
  | 'assumption'
  | 'childrensDay'
  | 'unityDay'
  | 'austriaNationalDay'
  | 'reformationDay'
  | 'allSaints'
  | 'repentance'
  | 'immaculate'
  | 'christmas'
  | 'boxingDay';

export interface Holiday {
  date: string;
  id: HolidayId;
}

/** Easter Sunday (Gregorian), "Anonymous Gregorian" algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Wednesday before 23 November (Buß- und Bettag). */
function repentanceDay(year: number): string {
  const nov23 = `${year}-11-23`;
  // Day of week of 23 Nov (0 = Sunday); go back to the Wednesday strictly before it.
  const dow = new Date(Date.UTC(year, 10, 23)).getUTCDay();
  const back = (dow - 3 + 7) % 7 || 7;
  return addDaysStr(nov23, -back);
}

type State =
  | 'bw'
  | 'by'
  | 'be'
  | 'bb'
  | 'hb'
  | 'hh'
  | 'he'
  | 'mv'
  | 'ni'
  | 'nw'
  | 'rp'
  | 'sl'
  | 'sn'
  | 'st'
  | 'sh'
  | 'th';

const DE_ONLY_IN: Partial<Record<HolidayId, State[]>> = {
  epiphany: ['bw', 'by', 'st'],
  womensDay: ['be', 'mv'],
  corpusChristi: ['bw', 'by', 'he', 'nw', 'rp', 'sl'],
  assumption: ['sl'],
  childrensDay: ['th'],
  reformationDay: ['bb', 'hb', 'hh', 'mv', 'ni', 'sn', 'st', 'sh', 'th'],
  allSaints: ['bw', 'by', 'nw', 'rp', 'sl'],
  repentance: ['sn'],
  easterSunday: ['bb'],
  whitSunday: ['bb'],
};

/** Holidays of `year` in `region`, sorted by date. `off` returns nothing. */
export function holidaysOf(year: number, region: HolidayRegion): Holiday[] {
  if (region === 'off') return [];
  const easter = easterSunday(year);
  const fromEaster = (n: number) => addDaysStr(easter, n);
  const fixed = (md: string) => `${year}-${md}`;
  const at = (id: HolidayId, date: string): Holiday => ({ id, date });

  let list: Holiday[];
  if (region === 'at') {
    list = [
      at('newYear', fixed('01-01')),
      at('epiphany', fixed('01-06')),
      at('easterMonday', fromEaster(1)),
      at('labourDay', fixed('05-01')),
      at('ascension', fromEaster(39)),
      at('whitMonday', fromEaster(50)),
      at('corpusChristi', fromEaster(60)),
      at('assumption', fixed('08-15')),
      at('austriaNationalDay', fixed('10-26')),
      at('allSaints', fixed('11-01')),
      at('immaculate', fixed('12-08')),
      at('christmas', fixed('12-25')),
      at('boxingDay', fixed('12-26')),
    ];
  } else if (region === 'ch') {
    list = [
      at('newYear', fixed('01-01')),
      at('goodFriday', fromEaster(-2)),
      at('easterMonday', fromEaster(1)),
      at('ascension', fromEaster(39)),
      at('whitMonday', fromEaster(50)),
      at('swissNationalDay', fixed('08-01')),
      at('christmas', fixed('12-25')),
      at('boxingDay', fixed('12-26')),
    ];
  } else {
    const state = region === 'de' ? null : (region.slice(3) as State);
    const dated: Record<HolidayId, string | undefined> = {
      newYear: fixed('01-01'),
      epiphany: fixed('01-06'),
      womensDay: fixed('03-08'),
      goodFriday: fromEaster(-2),
      easterSunday: easter,
      easterMonday: fromEaster(1),
      labourDay: fixed('05-01'),
      ascension: fromEaster(39),
      whitSunday: fromEaster(49),
      whitMonday: fromEaster(50),
      corpusChristi: fromEaster(60),
      swissNationalDay: undefined,
      assumption: fixed('08-15'),
      childrensDay: fixed('09-20'),
      unityDay: fixed('10-03'),
      austriaNationalDay: undefined,
      reformationDay: fixed('10-31'),
      allSaints: fixed('11-01'),
      repentance: repentanceDay(year),
      immaculate: undefined,
      christmas: fixed('12-25'),
      boxingDay: fixed('12-26'),
    };
    const national: HolidayId[] = [
      'newYear',
      'goodFriday',
      'easterMonday',
      'labourDay',
      'ascension',
      'whitMonday',
      'unityDay',
      'christmas',
      'boxingDay',
    ];
    list = [];
    for (const id of Object.keys(dated) as HolidayId[]) {
      const date = dated[id];
      if (!date) continue;
      const only = DE_ONLY_IN[id];
      if (national.includes(id)) list.push(at(id, date));
      // Regional ones appear only for a chosen state ("Deutschland" = national days only).
      else if (state && only?.includes(state)) list.push(at(id, date));
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** Holidays inside [from, to] (YYYY-MM-DD, inclusive), across year boundaries. */
export function holidaysBetween(from: string, to: string, region: HolidayRegion): Holiday[] {
  if (region === 'off') return [];
  const out: Holiday[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const h of holidaysOf(y, region)) if (h.date >= from && h.date <= to) out.push(h);
  }
  return out;
}

/** Map date → holiday id for quick lookup in the grids. */
export function holidayMap(
  from: string,
  to: string,
  region: HolidayRegion,
): Map<string, HolidayId> {
  return new Map(holidaysBetween(from, to, region).map((h) => [h.date, h.id]));
}
