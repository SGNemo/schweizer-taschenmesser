import { describe, expect, it } from 'vitest';
import { passwordEntropyBits, type Rng } from '@nemo/vault-core';
import { COUNTRIES, DATA, DE_DRAMA, type CountryId } from './data';
import {
  AGE_BANDS,
  asciiName,
  countryForLang,
  DEFAULT_OPTIONS,
  FIELDS,
  generatePersona,
  makeBirth,
  postcodeFits,
  rerollField,
  type AgeBandId,
  type Persona,
  type PersonaOptions,
} from './logic';

/** Seeded generator (mulberry32) so every run sees the same personas. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(max) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
    },
  };
}

const REF = '2026-11-02';
const opts = (o: Partial<PersonaOptions> = {}): PersonaOptions => ({ ...DEFAULT_OPTIONS, ...o });

const luhn = (digits: string): boolean => {
  let sum = 0;
  [...digits].reverse().forEach((c, i) => {
    let n = Number(c);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  });
  return sum % 10 === 0;
};

/** Everything that looks like an identity or payment number (never on a persona except the password). */
function identityLike(text: string): string | undefined {
  if (/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/.test(text.replaceAll(' ', ''))) return 'iban';
  for (const run of text.replace(/[ -]/g, ' ').match(/\d[\d ]{11,22}\d/g) ?? []) {
    const d = run.replaceAll(' ', '');
    if (d.length >= 13 && d.length <= 19 && luhn(d)) return 'card';
  }
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return 'ssn';
  if (/\b\d{2}\.\d{3}\.\d{3}-\d{2}\b/.test(text)) return 'cpf';
  if (/\b[A-Z]\d{8}\b/.test(text)) return 'id';
  return undefined;
}

const age = (birth: string, ref: string): number => {
  const [by, bm, bd] = birth.split('-').map(Number) as [number, number, number];
  const [ry, rm, rd] = ref.split('-').map(Number) as [number, number, number];
  return ry - by - (rm < bm || (rm === bm && rd < bd) ? 1 : 0);
};

const many = (country: CountryId, n = 150, o: Partial<PersonaOptions> = {}): Persona[] => {
  const rng = seeded(country.length * 1000 + n);
  return Array.from({ length: n }, () =>
    generatePersona(opts({ country, bio: true, gender: 'any', ...o }), rng, REF),
  );
};

describe('persona fields', () => {
  it('has only the allowed fields: no IBAN, card, ID, tax, social security or licence field', () => {
    expect([...FIELDS]).toEqual([
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
    ]);
    const allowed = new Set<string>(['country', ...FIELDS]);
    for (const c of COUNTRIES) {
      for (const p of many(c, 50)) {
        expect(Object.keys(p).filter((k) => !allowed.has(k))).toEqual([]);
      }
    }
  });

  it.each(COUNTRIES)('%s: nothing looks like an identity or payment number', (c) => {
    for (const p of many(c)) {
      for (const f of FIELDS) {
        if (f === 'password') continue;
        const v = p[f as keyof Persona];
        if (typeof v === 'string') expect(identityLike(v), `${f}: ${v}`).toBeUndefined();
      }
    }
  });

  it('the identity check itself detects what it should', () => {
    expect(identityLike('DE89 3704 0044 0532 0130 00')).toBe('iban');
    expect(identityLike('4111 1111 1111 1111')).toBe('card');
    expect(identityLike('123-45-6789')).toBe('ssn');
    expect(identityLike('+1 212 555 0142')).toBeUndefined();
    expect(identityLike('030 23125123')).toBeUndefined();
  });
});

describe('city and postcode', () => {
  it.each(COUNTRIES)('%s: the postcode belongs to the city, in the right format', (c) => {
    for (const p of many(c, 300)) {
      expect(postcodeFits(c, p.city, p.postcode), `${p.city} ${p.postcode}`).toBe(true);
    }
  });
  it('knows the formats', () => {
    expect(postcodeFits('de', 'Berlin', '10115')).toBe(true);
    expect(postcodeFits('de', 'Berlin', '80331')).toBe(false);
    expect(postcodeFits('de', 'Dresden', '01067')).toBe(true);
    expect(postcodeFits('br', 'São Paulo', '01310-100')).toBe(true);
    expect(postcodeFits('br', 'São Paulo', '01310100')).toBe(false);
    expect(postcodeFits('fr', 'Paris', '75011')).toBe(true);
    expect(postcodeFits('us', 'Boston, MA', '02108')).toBe(true);
    expect(postcodeFits('de', 'Atlantis', '10115')).toBe(false);
  });
  it('every city has a valid range or list', () => {
    for (const c of COUNTRIES) {
      for (const city of DATA[c].cities) {
        expect(Boolean(city.range) !== Boolean(city.list), city.name).toBe(true);
        if (city.range) expect(city.range[0]).toBeLessThanOrEqual(city.range[1]);
      }
    }
  });
});

describe('streets', () => {
  it('only uses the invented street names', () => {
    for (const c of COUNTRIES) {
      for (const p of many(c, 100)) {
        expect(
          DATA[c].streets.some((s) => p.street.includes(s)),
          p.street,
        ).toBe(true);
        expect(p.street).toMatch(/\d/);
      }
    }
  });
});

describe('phone numbers', () => {
  it('Germany: only the reserved drama number blocks', () => {
    const blocks = Object.values(DE_DRAMA).map((d) => `${d.area} ${d.block}`);
    for (const p of many('de', 300)) {
      expect(
        blocks.some((b) => p.phone.startsWith(b)),
        p.phone,
      ).toBe(true);
      expect(p.phone).toMatch(/^0\d{2,3} \d{7,8}$/);
    }
    const berlin = generatePersona(opts({ country: 'de' }), seeded(5), REF);
    expect(berlin.city === 'Berlin' ? berlin.phone.startsWith('030 23125') : true).toBe(true);
  });
  it('USA: 555-0100 to 555-0199', () => {
    for (const p of many('us', 200)) expect(p.phone).toMatch(/^\+1 \d{3} 555 01\d{2}$/);
  });
  it('France, Spain, Brazil: clearly invalid numbers', () => {
    for (const p of many('fr', 100)) expect(p.phone).toMatch(/^00 \d\d \d\d \d\d \d\d$/);
    for (const p of many('es', 100)) expect(p.phone).toMatch(/^0\d\d \d{3} \d{3}$/);
    for (const p of many('br', 100)) expect(p.phone).toMatch(/^\(00\) 9\d{4}-\d{4}$/);
  });
});

describe('birth date and age band', () => {
  it.each(Object.keys(AGE_BANDS) as AgeBandId[])('band %s stays inside its ages', (band) => {
    const [min, max] = AGE_BANDS[band];
    const rng = seeded(9);
    const ages = Array.from({ length: 800 }, () => age(makeBirth(band, rng, REF), REF));
    expect(Math.min(...ages)).toBeGreaterThanOrEqual(min);
    expect(Math.max(...ages)).toBeLessThanOrEqual(max);
    // the whole band is reachable
    expect(Math.min(...ages)).toBeLessThanOrEqual(min + 1);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(max - 1);
  });
  it('is always an adult and a real date', () => {
    for (const p of many('de', 200)) {
      expect(p.birth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(age(p.birth, REF)).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('names and usernames', () => {
  it('keeps names of the chosen gender and the usernames plain ASCII', () => {
    for (const c of COUNTRIES) {
      for (const p of many(c, 100, { gender: 'f' })) {
        expect(DATA[c].female).toContain(p.firstName);
        expect(p.gender).toBe('f');
        expect(p.username).toMatch(/^[a-z0-9._]{4,40}$/);
      }
      for (const p of many(c, 100, { gender: 'm' })) expect(DATA[c].male).toContain(p.firstName);
    }
  });
  it('gives no gender when none was asked for', () => {
    for (const p of many('de', 50, { gender: 'none' })) expect(p.gender).toBeUndefined();
  });
  it('transliterates', () => {
    expect(asciiName('Müller')).toBe('mueller');
    expect(asciiName('Weiß')).toBe('weiss');
    expect(asciiName('Léa')).toBe('lea');
    expect(asciiName('Noël-Ève')).toBe('noeleve');
    expect(asciiName('São')).toBe('sao');
  });
  it('includes a bio only on request, from the country’s own interests', () => {
    expect(many('de', 5, { bio: false })[0]!.bio).toBeUndefined();
    for (const c of COUNTRIES) {
      const p = many(c, 20, { bio: true })[0]!;
      expect(p.bio).toBeTruthy();
      expect(DATA[c].interests.filter((i) => p.bio!.includes(i)).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('password', () => {
  it('is strong: length, all classes, at least 80 bits', () => {
    for (const p of many('de', 100)) {
      expect(p.password).toHaveLength(16);
      expect(p.password).toMatch(/[a-z]/);
      expect(p.password).toMatch(/[A-Z]/);
      expect(p.password).toMatch(/\d/);
      expect(p.password).toMatch(/[^A-Za-z0-9]/);
      expect(p.password).not.toMatch(/[Il1O0o]/);
    }
    const bits = passwordEntropyBits({
      length: 16,
      lower: true,
      upper: true,
      digits: true,
      symbols: true,
      avoidAmbiguous: true,
    });
    expect(bits).toBeGreaterThan(80);
  });
  it('can leave out symbols and clamps the length', () => {
    const rng = seeded(3);
    const a = generatePersona(opts({ passwordSymbols: false, passwordLength: 20 }), rng, REF);
    expect(a.password).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(generatePersona(opts({ passwordLength: 3 }), rng, REF).password).toHaveLength(12);
    expect(generatePersona(opts({ passwordLength: 500 }), rng, REF).password).toHaveLength(64);
  });
  it('differs every time (real CSPRNG)', () => {
    const a = generatePersona(opts());
    const b = generatePersona(opts());
    expect(a.password).not.toBe(b.password);
  });
});

describe('rerolling one field', () => {
  const base = generatePersona(opts({ gender: 'any', bio: true }), seeded(21), REF);
  const o = opts({ gender: 'any', bio: true });
  it.each(FIELDS.filter((f) => f !== 'gender'))('%s changes only itself', (field) => {
    let moved = false;
    for (let s = 1; s < 40 && !moved; s++) {
      const next = rerollField(base, field, o, seeded(s), REF);
      for (const f of FIELDS) {
        const same = next[f as keyof Persona] === base[f as keyof Persona];
        if (f === field || (field === 'city' && (f === 'postcode' || f === 'city'))) continue;
        if (field === 'postcode' && f === 'city') continue;
        expect(same, `${field} touched ${f}`).toBe(true);
      }
      moved = next[field as keyof Persona] !== base[field as keyof Persona];
    }
    expect(moved).toBe(true);
  });
  it('city and postcode stay a matching pair', () => {
    for (let s = 1; s < 60; s++) {
      for (const f of ['city', 'postcode'] as const) {
        const next = rerollField(base, f, o, seeded(s), REF);
        expect(postcodeFits(next.country, next.city, next.postcode)).toBe(true);
      }
    }
  });
  it('gender flips the first name with it', () => {
    const next = rerollField(base, 'gender', o, seeded(2), REF);
    expect(next.gender).not.toBe(base.gender);
    const list = next.gender === 'f' ? DATA.de.female : DATA.de.male;
    expect(list).toContain(next.firstName);
    const none = generatePersona(opts({ gender: 'none' }), seeded(4), REF);
    expect(rerollField(none, 'gender', opts({ gender: 'none' }), seeded(1), REF)).toBe(none);
  });
});

describe('determinism and language', () => {
  it('same seed, same persona', () => {
    expect(generatePersona(opts(), seeded(77), REF)).toEqual(
      generatePersona(opts(), seeded(77), REF),
    );
  });
  it('starts with the country of the UI language', () => {
    expect(countryForLang('de')).toBe('de');
    expect(countryForLang('en')).toBe('us');
    expect(countryForLang('fr')).toBe('fr');
    expect(countryForLang('es')).toBe('es');
    expect(countryForLang('pt-BR')).toBe('br');
  });
});
