// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Forecast } from '@/core/weather/api';
import {
  sceneOf,
  SKY_KEYS,
  type SceneHour,
  type SceneState,
  type SkyKey,
} from '@/core/weather/scene';
import { compactPath, countElements, G, phoneView, sceneSvg, type SceneOptions } from './draw';

/**
 * Round 2, package A (handoff A "Acceptance"): the data → level → layer chain as tables, the body seen in every sky,
 * the ceilings of A11Y §4, the motion's off switches and the glow that runs once.
 */

/* ---- data → scene ---- */
const forecast = (night: boolean): Forecast => ({
  temp: 12,
  group: 'clear',
  time: night ? '2026-07-02T01:00' : '2026-07-02T12:00',
  now: { night },
  days: [
    {
      date: '2026-07-02',
      min: 8,
      max: 20,
      group: 'clear',
      rain: 0,
      sunrise: '05:20',
      sunset: '21:30',
    },
  ],
});
const MOON = { lit: 0.8, tilt: 30, alt: 35, az: 170, full: false, superMoon: false };
function hourScene(
  h: SceneHour,
  o: {
    night?: boolean;
    moon?: boolean;
    motion?: boolean;
    theme?: 'light' | 'dark';
    level?: 'full' | 'plain';
    calm?: boolean;
  } = {},
): SceneState {
  const night = !!o.night;
  return sceneOf({
    forecast: forecast(night),
    hour: { time: night ? '2026-07-02T01:00' : '2026-07-02T12:00', temp: 12, night, ...h },
    at: 0,
    nowMs: 0,
    lat: 47,
    theme: o.theme ?? 'light',
    moon: o.moon === false ? undefined : MOON,
    motion: o.motion,
    level: o.level,
    calm: o.calm,
  });
}
function draw(s: SceneState, opts: SceneOptions = {}) {
  const out = sceneSvg(s, { quietX: 640, ...opts });
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${out.inner}</svg>`,
    'image/svg+xml',
  );
  const q = (sel: string) => doc.querySelectorAll(sel);
  return { out, doc, q, has: (sel: string) => q(sel).length > 0 };
}

describe('data → layers (CONCEPT §3, one table per row group)', () => {
  it.each([
    [{ code: 0, cloud: 5 }, 0],
    [{ code: 1, cloud: 30 }, 2],
    [{ code: 2, cloud: 50 }, 4],
    [{ code: 3, cloud: 80 }, 11], // nine clouds and two faint ones over the quiet side
  ] as const)('cloud %o → %i cumulus', (h, n) => {
    const { q } = draw(hourScene(h));
    expect(
      q('[data-layer="clouds"] > g[transform]').length +
        q('[data-layer="clouds"] > g[opacity] > g').length,
    ).toBe(n);
    expect(q('[data-part="deck"]').length).toBe(0);
  });

  it('a deck of four rolls over 85 %; banks only with a dry deck, the schein with a wet one', () => {
    const dry = draw(hourScene({ code: 3, cloud: 95 }));
    expect(dry.q('[data-part="deck"]').length).toBe(4);
    expect(dry.q('[data-part="banks"] [data-bank]').length).toBe(6);
    expect(dry.has('[data-part="opening"]')).toBe(true);
    expect(dry.has('[data-part="schein"]')).toBe(false);
    const wet = draw(hourScene({ code: 63, cloud: 100 }));
    expect(wet.has('[data-part="banks"]')).toBe(false);
    expect(wet.has('[data-part="schein"]')).toBe(true);
  });

  it.each([
    [{ code: 0, cloud: 0, sunMin: 60 }, 12],
    [{ code: 2, cloud: 50, sunMin: 30 }, 8],
    [{ code: 3, cloud: 80, sunMin: 10 }, 0],
  ] as const)('how sunny %o → %i rays', (h, rays) => {
    const { q } = draw(hourScene(h));
    const r = q('[data-part="rays"]')[0]?.getAttribute('d') ?? '';
    expect((r.match(/z/g) ?? []).length).toBe(rays);
  });

  it.each([
    [61, 1, 46],
    [63, 2, 96],
    [65, 3, 170],
    [80, 1, 21], // showers: under their cloud only (0.45)
  ] as const)('rain WMO %i → level %i, %i strokes', (code, lvl, strokes) => {
    const { q } = draw(hourScene({ code, cloud: 100 }));
    const g = q('[data-layer="precip"]')[0]!;
    expect(g.getAttribute('data-level')).toBe(String(lvl));
    const segs = [...g.querySelectorAll('path')]
      .filter((p) => p.getAttribute('data-part') !== 'splash')
      .reduce((n, p) => n + (p.getAttribute('d')!.match(/m/g) ?? []).length, 0);
    // the quiet side keeps every second stroke: between the half and the whole count
    expect(segs).toBeLessThanOrEqual(strokes);
    expect(segs).toBeGreaterThanOrEqual(Math.floor(strokes / 2));
    expect(q('[data-part="splash"]').length).toBe(
      lvl >= 2 && code !== 80 ? 1 : code === 80 ? 0 : 0,
    );
    expect(q('[data-part="puddles"]').length).toBe(1);
  });

  it.each([
    [71, 1],
    [73, 2],
    [75, 3],
  ] as const)('snow WMO %i → level %i', (code, lvl) => {
    const { q } = draw(hourScene({ code, cloud: 100, temp: -2 }));
    expect(q('[data-layer="precip"]')[0]!.getAttribute('data-level')).toBe(String(lvl));
  });

  it.each([
    [{ code: 95, mm: 1, gust: 20, cloud: 70 }, 1],
    [{ code: 95, mm: 4 }, 2],
    [{ code: 95, mm: 12 }, 4],
    [{ code: 99 }, 4],
  ] as const)('thunder %o → %i bolts, one glow, never moving', (h, bolts) => {
    const { q } = draw(hourScene(h, { motion: true }));
    expect(q('[data-part="bolt"]').length).toBe(bolts);
    expect(q('[data-part="glow"]').length).toBe(1);
    for (const b of q('[data-part="bolt"]')) expect(b.closest('[class]')).toBeNull();
  });

  it('hail with 96 and 99, none with 95', () => {
    expect(draw(hourScene({ code: 96 })).q('[data-part="hail"]').length).toBe(1);
    expect(draw(hourScene({ code: 99 })).q('[data-part="hail"]').length).toBe(1);
    expect(draw(hourScene({ code: 95 })).q('[data-part="hail"]').length).toBe(0);
  });

  it('fog 1: the massif at 35 %, three bands; fog 2: the massif gone, a veil', () => {
    const f1 = draw(hourScene({ code: 45, vis: 800 }));
    expect(f1.q('[data-layer="ridgeAlp"]')[0]!.getAttribute('opacity')).toBe('0.35');
    expect(f1.q('[data-layer="fog"] rect').length).toBe(3);
    const f2 = draw(hourScene({ code: 45, vis: 200 }));
    expect(f2.has('[data-layer="ridgeAlp"]')).toBe(false);
    expect(f2.q('[data-layer="ridgeFar"]')[0]!.getAttribute('opacity')).toBe('0.22');
    expect(f2.has('[data-layer="fog"] [data-part="veil"]')).toBe(true);
  });

  it.each([
    [{ wind: 5 }, { mirror: 1, ripples: 0, whitecaps: 0, leaves: 0, streaks: 0, spindrift: 0 }],
    [{ wind: 25 }, { mirror: 1, ripples: 1, whitecaps: 0, leaves: 0, streaks: 0, spindrift: 0 }],
    [{ wind: 40 }, { mirror: 0, ripples: 1, whitecaps: 0, leaves: 1, streaks: 1, spindrift: 0 }],
    [{ wind: 55 }, { mirror: 0, ripples: 1, whitecaps: 1, leaves: 1, streaks: 1, spindrift: 0 }],
  ] as const)('wind %o draws its parts', (h, parts) => {
    const { q } = draw(hourScene({ code: 1, cloud: 20, ...h }));
    for (const [part, n] of Object.entries(parts))
      expect(q(`[data-part="${part}"]`).length, part).toBe(n);
  });

  it('wind to the left mirrors smoke, flag, leaves and streaks; the flag stays clear of the shed', () => {
    const right = draw(hourScene({ code: 1, cloud: 20, wind: 40, dir: 90 }));
    const left = draw(hourScene({ code: 1, cloud: 20, wind: 40, dir: 270 }));
    const flag = (d: ReturnType<typeof draw>) => d.q('[data-part="flag"]')[0]!.getAttribute('d')!;
    expect(flag(right)).not.toBe(flag(left));
    // the cloth starts at the pole top and reaches at most 38 units to the lee: the shed (x 1350 …) is right of the pole
    expect(flag(left)).toMatch(/^m1340/);
    expect(left.q('[data-part="streaks"]')[0]!.getAttribute('d')).not.toBe(
      right.q('[data-part="streaks"]')[0]!.getAttribute('d'),
    );
  });

  it.each([
    [{ code: 0, temp: -1 }, ['hoar', 'iceRim'], ['ice']],
    [{ code: 0, temp: -6 }, ['hoar', 'ice'], ['iceRim']],
    [{ code: 0, temp: 31 }, ['shimmer'], ['hoar']],
    [{ code: 0, snowDepth: 0.02 }, ['caps'], ['roofLoad']],
    [{ code: 0, snowDepth: 0.3 }, ['roofLoad', 'ice'], ['grass', 'leafy']],
  ] as const)('frost, heat and snow cover %o', (h, yes, no) => {
    const { has } = draw(hourScene(h));
    for (const p of yes) expect(has(`[data-part="${p}"]`), p).toBe(true);
    for (const p of no) expect(has(`[data-part="${p}"]`), p).toBe(false);
  });

  it('lights in the windows at night and under a rain sky, not on a fair day', () => {
    expect(
      draw(hourScene({ code: 0 }, { night: true })).has(
        '[data-part="window"][fill="var(--scene-window)"]',
      ),
    ).toBe(true);
    expect(
      draw(hourScene({ code: 63, cloud: 100 })).has(
        '[data-part="window"][fill="var(--scene-window)"]',
      ),
    ).toBe(true);
    expect(
      draw(hourScene({ code: 0 })).has('[data-part="window"][fill="var(--scene-window)"]'),
    ).toBe(false);
  });

  it('the landscape is the same in every scene: six mountains, cabin, shed, jetty, boat, fence, flag, the lake', () => {
    const { has, q } = draw(hourScene({ code: 0 }));
    for (const id of ['outlier', 'main', 'edge', 'shoulder', 'west', 'east'])
      expect(q(`[data-part="${id}"]`).length, id).toBe(1);
    for (const p of [
      'cabin',
      'shed',
      'jetty',
      'boat',
      'fence',
      'flag',
      'pole',
      'smoke',
      'lake',
      'trees',
      'treesBehind',
      'staffel',
      'leafy',
    ])
      expect(has(`[data-part="${p}"]`), p).toBe(true);
  });
});

/* ---- the body (CONCEPT §2, sentence 9) ---- */
const SKY_STATES: [SkyKey | string, SceneHour, { night?: boolean }][] = [
  ['day', { code: 0, cloud: 5 }, {}],
  ['heat', { code: 0, temp: 32 }, {}],
  ['overcast', { code: 3, cloud: 95 }, {}],
  ['drizzle', { code: 53, cloud: 100 }, {}],
  ['rain', { code: 63, cloud: 100 }, {}],
  ['storm', { code: 95, mm: 4 }, {}],
  ['snow', { code: 73, cloud: 100 }, {}],
  ['fog', { code: 45, vis: 200 }, {}],
  ['night', { code: 0 }, { night: true }],
  ['night-overcast', { code: 3, cloud: 95 }, { night: true }],
  ['night-rain', { code: 63, cloud: 100 }, { night: true }],
  ['night-snow', { code: 73, cloud: 100 }, { night: true }],
  ['night-fog', { code: 45, vis: 200 }, { night: true }],
  ['night storm', { code: 99 }, { night: true }],
];
describe('the body is seen whenever it is above the horizon', () => {
  it.each(SKY_STATES)('%s: a body, drawn after every cloud sheet', (_name, h, o) => {
    const s = hourScene(h, o);
    const { out, q } = draw(s);
    const bodies = q('[data-layer="body"]');
    expect(bodies.length).toBe(1);
    const markup = out.inner;
    const at = markup.indexOf('data-layer="body"');
    expect(at).toBeGreaterThan(markup.lastIndexOf('data-part="deck"'));
    expect(at).toBeGreaterThan(markup.lastIndexOf('data-part="billows"'));
    expect(bodies[0]!.getAttribute('data-mode')).toBe(s.mode);
  });

  it('between the banks: only the one bank in front reaches over the disc, covering less than a quarter of it', () => {
    const s = hourScene({ code: 3, cloud: 95 }, { night: true });
    const { out } = draw(s);
    const b = out.body!;
    for (const [bi, bank] of G.banks.entries()) {
      // the bank's lower edge: its lobes and its flat base, as ellipses; sample the disc on a grid
      let inside = 0;
      let total = 0;
      for (let dx = -b.r; dx <= b.r; dx += 1)
        for (let dy = -b.r; dy <= b.r; dy += 1) {
          if (dx * dx + dy * dy > b.r * b.r) continue;
          total++;
          const x = b.x + dx - (b.x + bank.at[0]);
          const y = b.y + dy - (b.y + bank.at[1]);
          const hit =
            bank.l.some((l) => (x - l[0]) ** 2 + (y - l[1]) ** 2 <= l[2] ** 2) ||
            ((x - bank.base[0]) / bank.base[2]) ** 2 + ((y - bank.base[1]) / bank.base[3]) ** 2 <=
              1;
          if (hit) inside++;
        }
      expect(inside / total, `bank ${bi}`).toBeLessThan(0.25);
    }
  });

  it('a moon below the horizon: no body, no lit rims, no opening', () => {
    const s = sceneOf({
      forecast: forecast(true),
      at: 0,
      nowMs: 0,
      lat: 47,
      theme: 'light',
      moon: { ...MOON, alt: -5 },
      hour: { time: '2026-07-02T01:00', code: 3, cloud: 95, night: true },
    });
    const { has } = draw(s);
    expect(has('[data-layer="body"]')).toBe(false);
    expect(has('[data-part="banks"]')).toBe(false);
    expect(has('[data-part="opening"]')).toBe(false);
  });

  it('"Schlicht": sky and body only; under a deck the body pale', () => {
    const { q, out } = draw(hourScene({ code: 3, cloud: 95 }, { level: 'plain' }));
    expect([...q('svg > g > [data-layer]')].map((e) => e.getAttribute('data-layer'))).toEqual([
      'sky',
      'body',
    ]);
    expect(out.inner).toContain('data-mode="schein"');
  });
});

/* ---- ceilings (A11Y §4) ---- */
const HEAVY: [string, SceneHour, { night?: boolean }][] = [
  ['storm 3 + hail + wind 3', { code: 99, wind: 60, mm: 12 }, {}],
  ['snow 3 + wind 3', { code: 75, wind: 60, snowDepth: 0.3, temp: -3 }, {}],
  ['overcast night, banks', { code: 3, cloud: 95 }, { night: true }],
  ['broken cover (3)', { code: 2, cloud: 80, wind: 25 }, {}],
  ['rain 3 + fog 2 + wind 2', { code: 65, wind: 40, cloud: 100 }, {}],
];
describe('ceilings (A11Y §4)', () => {
  it.each(HEAVY)(
    '%s: ≤ 220 elements, ≤ 64 KB, ≤ 9 animated groups – wide and phone, still and moving',
    (_n, h, o) => {
      for (const motion of [false, true])
        for (const opts of [
          {},
          { phone: true, view: phoneView(412, 256), quietX: G.phone.quietX },
        ] as SceneOptions[]) {
          const { out } = draw(hourScene(h, { ...o, motion }), opts);
          expect(countElements(out.inner)).toBeLessThanOrEqual(220);
          expect(out.inner.length / 1024).toBeLessThanOrEqual(64);
          expect((out.inner.match(/class="sc-/g) ?? []).length).toBeLessThanOrEqual(9);
        }
    },
  );
});

/* ---- motion (CONCEPT §7) ---- */
const css = readFileSync(resolve(__dirname, 'WeatherScene.module.css'), 'utf8');
describe('motion (CONCEPT §7, A11Y §3)', () => {
  it('no motion classes at all without motion, in "Ruhig" or in "Schlicht"', () => {
    for (const o of [
      { motion: false },
      { motion: true, calm: true },
      { motion: true, level: 'plain' as const },
    ])
      expect(draw(hourScene({ code: 99, wind: 60 }, o)).out.inner).not.toContain('class="sc-');
  });

  it('with motion: rain falls, clouds drift, smoke rises, the flag waves, trees sway, the glow has its copy', () => {
    const m = draw(hourScene({ code: 3, cloud: 80, wind: 40 }, { motion: true })).out.inner;
    for (const c of ['sc-drift', 'sc-smoke', 'sc-flag', 'sc-sway']) expect(m, c).toContain(c);
    const t = draw(hourScene({ code: 95, mm: 4 }, { motion: true })).out.inner;
    expect(t).toContain('sc-fall');
    expect((t.match(/sc-glow-up/g) ?? []).length).toBe(1);
  });

  it('the glow brightens exactly once: 2.4 s, from second 1, one iteration, only while running; hidden at rest', () => {
    expect(css).toMatch(
      /\[data-motion='run'\] :global\(\.sc-glow-up\) \{\s*animation: sc-glow 2\.4s ease-in-out 1s 1 none;/,
    );
    expect(css).toMatch(/:global\(\.sc-glow-up\) \{\s*opacity: 0;/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.svg :global\(\[class\^='sc-'\]\) \{\s*animation: none;/,
    );
    expect(css).toMatch(
      /:root\[data-motion='reduce'\]\) \.svg :global\(\[class\^='sc-'\]\) \{\s*animation: none;/,
    );
    // every animation is finite: no `infinite` anywhere
    expect(css).not.toMatch(/infinite/);
  });
});

/* ---- every sky draws ---- */
describe('every sky key', () => {
  it('has its gradient from tokens, never a literal colour', () => {
    for (const [, h, o] of SKY_STATES) {
      const { out } = draw(hourScene(h, o));
      expect(out.inner).not.toMatch(/="#[0-9a-f]{3,6}"/i);
      for (const v of Object.values(out.vars)) expect(v).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
    expect(SKY_KEYS.length).toBeGreaterThan(10);
  });

  it('every token name is a plain name: no expression is ever read as a token (a black layer)', () => {
    for (const [, h, o] of [...SKY_STATES, ...HEAVY]) {
      const { out } = draw(hourScene(h, o), { quietX: 640 });
      const all = out.inner + Object.values(out.vars).join(' ');
      for (const m of all.matchAll(/var\(--scene-([^)]*)\)/g))
        expect(m[1], m[0]).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

/* ---- the short paths keep their points ---- */
function absPoints(d: string): number[][] {
  // end points of every command, absolute (enough to show the shape did not move)
  const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g)!;
  const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, q: 4, t: 2, c: 6, a: 7, z: 0 };
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  let i = 0;
  const out: number[][] = [];
  // arc flags written without separators: split "11-5.2" into 1, 1, -5.2
  const expand: string[] = [];
  let c2 = '';
  let k = 0;
  for (const tk of t) {
    if (/[a-zA-Z]/.test(tk)) {
      c2 = tk.toLowerCase();
      k = 0;
      expand.push(tk);
      continue;
    }
    if (c2 === 'a' && k % 7 === 3 && /^[01][01]/.test(tk)) {
      expand.push(tk[0]!, tk[1]!);
      if (tk.length > 2) expand.push(tk.slice(2));
      k += tk.length > 2 ? 3 : 2;
      continue;
    }
    expand.push(tk);
    k++;
  }
  while (i < expand.length) {
    if (/[a-zA-Z]/.test(expand[i]!)) cmd = expand[i++]!;
    const lo = cmd.toLowerCase();
    if (lo === 'z') {
      x = sx;
      y = sy;
      out.push([x, y]);
      continue;
    }
    const n = ARGS[lo]!;
    const a = expand.slice(i, i + n).map(Number);
    i += n;
    const rel = cmd === lo;
    if (lo === 'h') x = rel ? x + a[0]! : a[0]!;
    else if (lo === 'v') y = rel ? y + a[0]! : a[0]!;
    else {
      x = rel ? x + a[n - 2]! : a[n - 2]!;
      y = rel ? y + a[n - 1]! : a[n - 1]!;
    }
    if (lo === 'm') {
      sx = x;
      sy = y;
      cmd = rel ? 'l' : 'L';
    }
    out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }
  return out;
}
describe('phoneView', () => {
  it.each([320, 360, 412, 600, 737, 899])(
    'a %i px phone box never shows left of x 0 and ends at the right edge',
    (w) => {
      const v = phoneView(w, 256);
      expect(v[0]).toBeGreaterThanOrEqual(0);
      expect(v[0] + v[2]).toBe(G.W);
    },
  );
});

describe('compactPath', () => {
  it.each([
    'M1002,281C1004,270 1052,263 1110,262C1150,261 1168,266 1196,264Z',
    'M10.5,20L30.25,40.75L-5,-6Z M100,100h20v-10l3,4',
    'M12.3,45.6a5.5,5.5 0 1,1 11,0a5.5,5.5 0 1,1 -11,0Z',
    'M0,0q4,-3.5 8,0q-4,3.5 -8,0Z',
    'M1424,267C1408,278 1436,288 1416,298L1438,320Z',
  ])('%s keeps every point', (d) => {
    expect(absPoints(compactPath(d))).toEqual(absPoints(d));
  });
});
