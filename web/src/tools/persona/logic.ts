import { csprng, generatePassword, type PasswordOptions, type Rng } from '@nemo/vault-core';
import { addDaysStr, addMonthsStr, daysBetween, today } from '@/core/time/dates';
import { COUNTRIES, DATA, DE_DRAMA, type City, type CountryId } from './data';

/**
 * An invented person for sign-ups that do not need real details, and for tests. Only these fields exist:
 * there is deliberately no IBAN, card, ID, tax, social security or driving licence number – nothing that
 * works like an identity document (logic.test.ts checks every generated value).
 */
export const FIELDS = [
  'firstName',
  'lastName',
  'username',
  'birth',
  'gender',
  'street',
  'postcode',
  'city',
  'phone',
  'bio',
  'password',
] as const;
export type Field = (typeof FIELDS)[number];

export const AGE_BANDS = {
  a18: [18, 25],
  a26: [26, 35],
  a36: [36, 50],
  a51: [51, 65],
} as const;
export type AgeBandId = keyof typeof AGE_BANDS;

export type GenderChoice = 'none' | 'any' | 'f' | 'm';

export interface PersonaOptions {
  country: CountryId;
  age: AgeBandId;
  gender: GenderChoice;
  bio: boolean;
  passwordLength: number;
  passwordSymbols: boolean;
}

export const DEFAULT_OPTIONS: PersonaOptions = {
  country: 'de',
  age: 'a26',
  gender: 'none',
  bio: false,
  passwordLength: 16,
  passwordSymbols: true,
};

export interface Persona {
  country: CountryId;
  firstName: string;
  lastName: string;
  username: string;
  /** YYYY-MM-DD */
  birth: string;
  gender?: 'f' | 'm';
  /** Street and house number as written in that country. */
  street: string;
  postcode: string;
  city: string;
  phone: string;
  bio?: string;
  password: string;
}

const pick = <T>(list: readonly T[], rng: Rng): T => list[rng.int(list.length)]!;
const digits = (n: number, rng: Rng): string =>
  Array.from({ length: n }, () => String(rng.int(10))).join('');

/** "Müller" → "mueller", "Léa" → "lea": lower case a–z and digits only. */
export function asciiName(text: string): string {
  return text
    .replaceAll('ß', 'ss')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('Ä', 'Ae')
    .replaceAll('Ö', 'Oe')
    .replaceAll('Ü', 'Ue')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function pickGender(choice: GenderChoice, rng: Rng): 'f' | 'm' {
  return choice === 'f' || choice === 'm' ? choice : pick(['f', 'm'] as const, rng);
}

export function makeFirstName(country: CountryId, gender: 'f' | 'm', rng: Rng): string {
  const d = DATA[country];
  return pick(gender === 'f' ? d.female : d.male, rng);
}

export function makeUsername(first: string, last: string, rng: Rng): string {
  const f = asciiName(first);
  const l = asciiName(last);
  const n = rng.int(90) + 10;
  switch (rng.int(4)) {
    case 0:
      return `${f}.${l}${n}`;
    case 1:
      return `${f[0] ?? ''}${l}${n}`;
    case 2:
      return `${l}${f[0] ?? ''}${rng.int(900) + 100}`;
    default:
      return `${f}_${l[0] ?? ''}${n}`;
  }
}

/** A birth date that makes the person between the band's ages today (both ends inclusive). */
export function makeBirth(band: AgeBandId, rng: Rng, ref: string = today()): string {
  const [min, max] = AGE_BANDS[band];
  const youngest = addMonthsStr(ref, -12 * min);
  const oldest = addDaysStr(addMonthsStr(ref, -12 * (max + 1)), 1);
  return addDaysStr(oldest, rng.int(daysBetween(oldest, youngest) + 1));
}

function postcodeOf(country: CountryId, city: City, rng: Rng): string {
  if (city.list) return pick(city.list, rng);
  const [lo, hi] = city.range!;
  const n = lo + rng.int(hi - lo + 1);
  if (country === 'br') return `${String(n).padStart(5, '0')}-${digits(3, rng)}`;
  return String(n).padStart(5, '0');
}

export function makeCity(country: CountryId, rng: Rng): { city: string; postcode: string } {
  const city = pick(DATA[country].cities, rng);
  return { city: city.name, postcode: postcodeOf(country, city, rng) };
}

export function makeStreet(country: CountryId, rng: Rng): string {
  const d = DATA[country];
  const no = rng.int(5) === 0 ? rng.int(180) + 20 : rng.int(30) + 1;
  return d.street(pick(d.streets, rng), no);
}

/**
 * Germany: the Bundesnetzagentur's drama numbers (a city of the table, else a random one of it). USA:
 * 555-0100 to 555-0199. France, Spain, Brazil: clearly invalid (no real number starts like this).
 */
export function makePhone(country: CountryId, cityName: string, rng: Rng): string {
  if (country === 'de') {
    const d = DE_DRAMA[cityName] ?? DE_DRAMA[pick(Object.keys(DE_DRAMA), rng)]!;
    return `${d.area} ${d.block}${digits(3, rng)}`;
  }
  if (country === 'us') {
    const area = DATA.us.cities.find((c) => c.name === cityName)?.area ?? '212';
    return `+1 ${area} 555 01${digits(2, rng)}`;
  }
  const g = (n: number) => digits(n, rng);
  if (country === 'fr') return `00 ${g(2)} ${g(2)} ${g(2)} ${g(2)}`;
  if (country === 'es') return `0${g(2)} ${g(3)} ${g(3)}`;
  return `(00) 9${g(4)}-${g(4)}`;
}

export function makeBio(country: CountryId, rng: Rng): string {
  const d = DATA[country];
  const picked: string[] = [];
  while (picked.length < 3) {
    const i = pick(d.interests, rng);
    if (!picked.includes(i)) picked.push(i);
  }
  return d.bio(picked);
}

export function makePassword(
  o: Pick<PersonaOptions, 'passwordLength' | 'passwordSymbols'>,
  rng: Rng,
): string {
  const options: PasswordOptions = {
    length: Math.min(64, Math.max(12, Math.round(o.passwordLength))),
    lower: true,
    upper: true,
    digits: true,
    symbols: o.passwordSymbols,
    avoidAmbiguous: true,
  };
  return generatePassword(options, rng);
}

export function generatePersona(
  options: PersonaOptions,
  rng: Rng = csprng,
  ref: string = today(),
): Persona {
  const gender = pickGender(options.gender, rng);
  const firstName = makeFirstName(options.country, gender, rng);
  const lastName = pick(DATA[options.country].last, rng);
  const { city, postcode } = makeCity(options.country, rng);
  return {
    country: options.country,
    firstName,
    lastName,
    username: makeUsername(firstName, lastName, rng),
    birth: makeBirth(options.age, rng, ref),
    ...(options.gender === 'none' ? {} : { gender }),
    street: makeStreet(options.country, rng),
    postcode,
    city,
    phone: makePhone(options.country, city, rng),
    ...(options.bio ? { bio: makeBio(options.country, rng) } : {}),
    password: makePassword(options, rng),
  };
}

/** New value for one field; everything else stays. City and postcode stay a matching pair. */
export function rerollField(
  p: Persona,
  field: Field,
  options: PersonaOptions,
  rng: Rng = csprng,
  ref: string = today(),
): Persona {
  const c = p.country;
  switch (field) {
    case 'firstName':
      return {
        ...p,
        firstName: makeFirstName(c, p.gender ?? pickGender(options.gender, rng), rng),
      };
    case 'lastName':
      return { ...p, lastName: pick(DATA[c].last, rng) };
    case 'username':
      return { ...p, username: makeUsername(p.firstName, p.lastName, rng) };
    case 'birth':
      return { ...p, birth: makeBirth(options.age, rng, ref) };
    case 'gender': {
      if (options.gender === 'none') return p;
      const gender =
        p.gender === 'f' ? 'm' : p.gender === 'm' ? 'f' : pickGender(options.gender, rng);
      return { ...p, gender, firstName: makeFirstName(c, gender, rng) };
    }
    case 'street':
      return { ...p, street: makeStreet(c, rng) };
    case 'postcode': {
      const city = DATA[c].cities.find((x) => x.name === p.city) ?? pick(DATA[c].cities, rng);
      return { ...p, city: city.name, postcode: postcodeOf(c, city, rng) };
    }
    case 'city': {
      const next = makeCity(c, rng);
      return { ...p, ...next };
    }
    case 'phone':
      return { ...p, phone: makePhone(c, p.city, rng) };
    case 'bio':
      return { ...p, bio: makeBio(c, rng) };
    case 'password':
      return { ...p, password: makePassword(options, rng) };
  }
}

/** Does the postcode belong to the city (tests and a last safety net)? */
export function postcodeFits(country: CountryId, cityName: string, postcode: string): boolean {
  const city = DATA[country].cities.find((c) => c.name === cityName);
  if (!city) return false;
  if (city.list) return city.list.includes(postcode);
  const [lo, hi] = city.range!;
  const m = country === 'br' ? /^(\d{5})-\d{3}$/.exec(postcode) : /^(\d{5})$/.exec(postcode);
  if (!m) return false;
  const n = Number(m[1]);
  return n >= lo && n <= hi;
}

export const isCountry = (v: unknown): v is CountryId =>
  typeof v === 'string' && (COUNTRIES as readonly string[]).includes(v);

/** Which country to start with for a UI language. */
export function countryForLang(lang: string): CountryId {
  return lang === 'en'
    ? 'us'
    : lang === 'fr'
      ? 'fr'
      : lang === 'es'
        ? 'es'
        : lang === 'pt-BR'
          ? 'br'
          : 'de';
}
