import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const SRC = resolve(__dirname, '..');

/** Every `.css` file under `src/`, as a posix path relative to it. */
const cssFiles = (): string[] =>
  (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.css'))
    .map((f) => f.split('\\').join('/'))
    .sort();
const read = (rel: string): string => readFileSync(resolve(SRC, rel), 'utf8');

/** Declarations of the first block that follows `header` (custom properties only). */
function block(header: string): Record<string, string> {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`block not found: ${header}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+|color-scheme):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim().replace(/\s+/g, ' ');
  return out;
}

const light = { ...block(':root {\n  --font-sans') } as Record<string, string>;
const dark = block(":root[data-theme='dark']");
const darkMedia = block(":root:not([data-theme='light'])");

const lum = (hex: string): number => {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** `fg` at `alpha` over `bg` (what `color-mix(fg alpha%, transparent)` looks like on that surface). */
const mix = (fg: string, bg: string, alpha: number): string => {
  const f = fg
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  const b = bg
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  return `#${f
    .map((c, i) =>
      Math.round(c * alpha + b[i]! * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/** HSL hue of a hex colour in degrees (0 for grey). */
const hueOf = (hex: string): number => {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r!, g!, b!);
  const min = Math.min(r!, g!, b!);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
  return (h * 60 + 360) % 360;
};
const apart = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** The ten coloured module hues of a theme block (slate is the palette's grey). */
const moduleHues = (t: Record<string, string>): string[] =>
  Object.keys(t).filter((k) => k.startsWith('--mod-') && k !== '--mod-slate');
/** `--text-on-tint` of a theme, resolved: it must be `--text` mixed over `--surface`. */
const textOnTint = (t: Record<string, string>): string => {
  const m = t['--text-on-tint']?.match(
    /^color-mix\(in srgb, var\(--text\) (\d+)%, var\(--surface\)\)$/,
  );
  if (!m) throw new Error(`--text-on-tint must mix --text over --surface: ${t['--text-on-tint']}`);
  return mix(t['--text']!, t['--surface']!, Number(m[1]) / 100);
};

describe('design tokens', () => {
  it('the dark palette is defined twice (explicit + system) and both copies are identical', () => {
    expect(Object.keys(dark).length).toBeGreaterThan(20);
    expect(darkMedia).toEqual(dark);
  });

  it('every semantic colour exists in both themes', () => {
    for (const key of Object.keys(dark).filter((k) => k.startsWith('--')))
      expect(light, `${key} missing in light`).toHaveProperty(key);
  });

  const themes = { light, dark } as const;
  for (const [name, t] of Object.entries(themes)) {
    describe(`${name}: WCAG AA`, () => {
      const text = (fg: string, bg: string, min = 4.5) =>
        expect(ratio(t[fg]!, t[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
      it('category colours are visible on surface and surface-2 (UI contrast 3:1)', () => {
        for (let i = 1; i <= 6; i++) {
          text(`--cat-${i}`, '--surface', 3);
          text(`--cat-${i}`, '--surface-2', 3);
        }
      });
      it('text on backgrounds and surfaces', () => {
        for (const bg of [
          '--bg',
          '--surface',
          '--surface-2',
          '--surface-raised',
          '--surface-sunken',
        ]) {
          text('--text', bg);
          text('--text-muted', bg);
          text('--text-3', bg);
        }
        text('--accent', '--surface');
        text('--accent', '--accent-soft');
        text('--text', '--accent-soft');
      });
      it('status colours on surfaces; their badge ink on the 15 % background over page, card and chip', () => {
        for (const s of ['--danger', '--success', '--warning', '--info']) {
          text(s, '--surface');
          text(s, '--bg');
          const ink = mix(t['--text']!, t[s]!, 0.15);
          for (const bg of ['--bg', '--surface', '--surface-2']) {
            const soft = mix(t[s]!, t[bg]!, 0.15);
            expect(ratio(ink, soft), `${s}-ink on ${s}-soft over ${bg}`).toBeGreaterThanOrEqual(
              4.5,
            );
          }
        }
      });
      it('module hues are visible on surface and surface-2 and never read as a state colour', () => {
        const hues = Object.keys(t).filter((k) => k.startsWith('--mod-'));
        // Identity v3: ten hues in steps of 26° plus slate, the grey of the palette.
        expect(hues).toHaveLength(11);
        for (const key of hues) {
          text(key, '--surface', 3);
          text(key, '--surface-2', 3);
          // Slate is the grey of the palette: it has no hue to keep apart.
          if (key === '--mod-slate') continue;
          for (const status of ['--danger', '--accent', '--warning', '--success'])
            expect(
              apart(hueOf(t[key]!), hueOf(t[status]!)),
              `${key} (${t[key]}) too close to ${status} (${t[status]})`,
            ).toBeGreaterThanOrEqual(25);
        }
      });
      it('module hues keep 25° of hue between each other, so no two modules of a group look alike (identity v3)', () => {
        const keys = moduleHues(t);
        expect(keys).toHaveLength(10);
        for (const [i, a] of keys.entries())
          for (const b of keys.slice(i + 1))
            expect(apart(hueOf(t[a]!), hueOf(t[b]!)), `${a} and ${b}`).toBeGreaterThanOrEqual(25);
      });
      it('identity v3.1: the focus ring sits on the accent hue, 25° from every module hue; --info only warns when it drifts onto one', () => {
        // The ring is the accent's hover tone in both themes: orange, the one hue the palette leaves free.
        expect(
          apart(hueOf(t['--focus']!), hueOf(t['--accent']!)),
          '--focus vs --accent',
        ).toBeLessThan(25);
        for (const key of moduleHues(t))
          expect(
            apart(hueOf(t['--focus']!), hueOf(t[key]!)),
            `--focus vs ${key}`,
          ).toBeGreaterThanOrEqual(25);
        // --info is blue by convention and sits next to the ocean/sky hues: allowed, but an info chip always
        // carries an icon or a word (ui/semantics.ts). A new overlap is a change to look at, so it is pinned.
        const near = moduleHues(t).filter((key) => apart(hueOf(t['--info']!), hueOf(t[key]!)) < 25);
        if (near.length)
          console.warn(
            `tokens (${name}): --info ${t['--info']} is within 25° of ${near.join(', ')}`,
          );
        expect(near, '--info: module hues within 25° (documented overlaps only)').toEqual(
          INFO_OVERLAPS[name as 'light' | 'dark'],
        );
      });
      it('page background and text on the filled accent', () => {
        text('--accent', '--bg');
        text('--accent-contrast', '--accent');
      });
      it('non-text UI (form borders, focus ring, chart series) reaches 3:1', () => {
        text('--border-strong', '--surface', 3);
        text('--border-strong', '--surface-2', 3); // switch off-track, controls on quiet areas
        text('--focus', '--bg', 3);
        text('--focus', '--surface', 3);
        text('--focus', '--surface-2', 3);
        text('--viz-1', '--surface', 3);
        text('--viz-2', '--surface', 3);
      });
    });
  }

  it('removed tokens stay removed; status backgrounds are mixes, not hex', () => {
    for (const key of ['--accent-2', '--accent-2-soft', '--surface-glass', '--focus-ring'])
      expect(light, key).not.toHaveProperty(key);
    for (const s of ['danger', 'success', 'warning', 'info']) {
      expect(light[`--${s}-soft`], `--${s}-soft`).toMatch(/^color-mix\(/);
      expect(light[`--${s}-ink`], `--${s}-ink`).toMatch(/^color-mix\(/);
    }
    expect(css).not.toMatch(/--accent-2/);
  });

  it('the calm colour mode and the module-colours switch grey out every module hue; every hue has a data-hue rule', () => {
    const calm = block(":root[data-color='calm']");
    const off = block(":root[data-module-colors='off']");
    for (const key of Object.keys(light).filter((k) => k.startsWith('--mod-'))) {
      expect(calm[key], `${key} in calm`).toBe('var(--calm-ink)');
      expect(off[key], `${key} with module colours off`).toBe('var(--calm-ink)');
      expect(css, `data-hue rule for ${key}`).toContain(`[data-hue='${key.slice(6)}']`);
    }
  });

  it('module head (identity v2): text stays AA on the hue gradient for every hue, both themes; calm and off flatten the tint', () => {
    const tint0 = Number.parseInt(light['--head-tint-0']!, 10) / 100;
    expect(tint0).toBeGreaterThan(0.2);
    for (const [name, t] of [
      ['light', light],
      ['dark', dark],
    ] as const)
      for (const key of Object.keys(t).filter((k) => k.startsWith('--mod-'))) {
        const start = mix(t[key]!, t['--surface']!, tint0);
        expect(
          ratio(t['--text']!, start),
          `${name} ${key} --text on the head`,
        ).toBeGreaterThanOrEqual(4.5);
        // The hue itself (icon chip, tab underline, figure accents) is UI on the tinted head: ≥ 3:1 against --text is irrelevant,
        // it must stay distinguishable from the head: ≥ 1.5:1 on it, and ≥ 3:1 on the plain surface (checked above).
        expect(ratio(t[key]!, start), `${name} ${key} on its own head`).toBeGreaterThanOrEqual(1.5);
      }
    const calm = block(":root[data-color='calm']");
    const off = block(":root[data-module-colors='off']");
    for (const b of [calm, off]) {
      expect(Number.parseInt(b['--head-tint-0']!, 10)).toBeLessThanOrEqual(15);
      expect(Number.parseInt(b['--head-tint-1']!, 10)).toBeLessThanOrEqual(8);
      // Identity v3: the widget head zone is nearly flat, the area patterns are off, the sidebar groups barely tinted.
      expect(Number.parseInt(b['--widget-tint']!, 10)).toBeLessThanOrEqual(8);
      expect(Number(b['--pattern-head'])).toBe(0);
      expect(Number(b['--pattern-widget'])).toBe(0);
      expect(Number.parseInt(b['--group-tint']!, 10)).toBeLessThanOrEqual(4);
    }
    // In the normal mode the pattern stays a quiet texture: at most a tenth of the ink, never behind body text.
    expect(Number(light['--pattern-head'])).toBeLessThanOrEqual(0.1);
    expect(Number(light['--pattern-widget'])).toBeLessThanOrEqual(0.06);
    // Identity v3: text on the widget head zone (14 %), the sidebar capsule (16 %) and the group block stays AA, every hue, both themes.
    for (const [name, t] of [
      ['light', light],
      ['dark', dark],
    ] as const)
      for (const key of Object.keys(t).filter((k) => k.startsWith('--mod-'))) {
        const zone = mix(
          t[key]!,
          t['--surface']!,
          Number.parseInt(light['--widget-tint']!, 10) / 100,
        );
        expect(
          ratio(t['--text']!, zone),
          `${name} ${key} --text on the widget head zone`,
        ).toBeGreaterThanOrEqual(4.5);
        const capsule = mix(t[key]!, t['--surface']!, 0.16);
        expect(
          ratio(t['--text']!, capsule),
          `${name} ${key} --text on the sidebar capsule`,
        ).toBeGreaterThanOrEqual(4.5);
        // The hue on the capsule/zone it tints: the icon keeps ≥ 3:1 (WCAG 1.4.11).
        expect(
          ratio(t[key]!, capsule),
          `${name} ${key} icon on the capsule`,
        ).toBeGreaterThanOrEqual(3);
      }
    expect([light['--shape-soft'], light['--shape-round'], light['--shape-sharp']]).toEqual([
      '16px',
      '20px',
      '10px',
    ]);
  });

  it('radii follow the spec (8 / 12 / 16 / 20)', () => {
    expect([
      light['--radius-sm'],
      light['--radius-md'],
      light['--radius-lg'],
      light['--radius-xl'],
    ]).toEqual(['8px', '12px', '16px', '20px']);
  });

  const accentPair = (accent: string, key: string): [string, string] => {
    const b = block(`:root[data-accent='${accent}']`);
    const m = b[key]!.match(/light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/)!;
    return [m[1]!, m[2]!];
  };

  it('accent variants keep AA for every (light, dark) pair', () => {
    const surface = { light: light['--surface']!, dark: dark['--surface']! };
    for (const accent of ['teal', 'coral', 'lagoon']) {
      const pair = (key: string) => accentPair(accent, key);
      for (const [i, scheme] of (['light', 'dark'] as const).entries()) {
        const s = surface[scheme];
        const label = `${accent}/${scheme}`;
        expect(ratio(pair('--accent')[i]!, s), `${label} accent text`).toBeGreaterThanOrEqual(4.5);
        expect(
          ratio(pair('--accent')[i]!, pair('--accent-soft')[i]!),
          `${label} on soft`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          ratio(pair('--accent-contrast')[i]!, pair('--accent')[i]!),
          `${label} button text`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('accent variants (identity v3.1): the 25° check per data-accent block; overlaps with module or state hues are pinned, never silent', () => {
    // Ten module hues span 67°–332°, the states sit at 3° (danger), 39° (warning) and 148° (success): only the
    // orange gap is 25° from everything, which is where the default accent lives. A teal, coral or lagoon
    // accent therefore always shares a hue family with something; the test names those pairs so a change
    // to the variants or the hue table is visible here (docs/design/MODULE-IDENTITY.md "Tokens").
    for (const [accent, overlaps] of Object.entries(ACCENT_OVERLAPS)) {
      for (const [i, scheme] of (['light', 'dark'] as const).entries()) {
        const t = scheme === 'light' ? light : dark;
        const a = hueOf(accentPair(accent, '--accent')[i]!);
        const near = [...moduleHues(t), '--danger', '--warning', '--success'].filter(
          (key) => apart(a, hueOf(t[key]!)) < 25,
        );
        expect(near, `${accent}/${scheme}: hues within 25° of the accent`).toEqual(
          overlaps[scheme],
        );
      }
    }
  });

  describe('identity v3.1 tokens', () => {
    it('--text-on-tint is the one quiet ink of the head band and the widget zone: AA on the 40 % and 14 % tint of every hue, both themes', () => {
      const head = Number.parseInt(light['--head-tint-0']!, 10) / 100;
      const zone = Number.parseInt(light['--widget-tint']!, 10) / 100;
      for (const [name, t] of [
        ['light', light],
        ['dark', dark],
      ] as const) {
        const ink = textOnTint(t);
        for (const key of Object.keys(t).filter((k) => k.startsWith('--mod-'))) {
          // The head tint, the widget zone and the kacheln tiles (8 % at rest, 16 % hovered).
          for (const [where, pct] of [
            ['head tint', head],
            ['widget zone', zone],
            ['tile', 0.08],
            ['hovered tile', 0.16],
          ] as const)
            expect(
              ratio(ink, mix(t[key]!, t['--surface']!, pct)),
              `${name} ${key}: --text-on-tint on the ${where}`,
            ).toBeGreaterThanOrEqual(4.5);
          // The focus ring sits on tinted heads and zones too (3:1, WCAG 1.4.11).
          for (const pct of [head, zone])
            expect(
              ratio(t['--focus']!, mix(t[key]!, t['--surface']!, pct)),
              `${name} ${key}: --focus on the ${pct === head ? 'head tint' : 'widget zone'}`,
            ).toBeGreaterThanOrEqual(3);
        }
        // A step below --text, so a context line still reads as secondary.
        expect(ratio(ink, t['--surface']!), `${name}: quieter than --text`).toBeLessThan(
          ratio(t['--text']!, t['--surface']!),
        );
      }
    });

    it('head zone: the band, the settings head, the tool stage and the signature blocks write text only in --text or --text-on-tint', () => {
      const files = [
        'layout/AreaFrame.module.css',
        'layout/tools/ToolStage.module.css',
        'pages/settings/PageHead.module.css',
        ...cssFiles().filter(
          (f) => f.startsWith('ui/identity/') || f === 'ui/HeadSurface.module.css',
        ),
        'modules/mail/components/InboxHead.module.css',
        'modules/accounts/components/AccountsHead.module.css',
        'modules/lists/components/ListSignature.module.css',
        'modules/downloads/components/DownloadsBand.module.css',
        'modules/disk/components/DiskHead.module.css',
      ];
      expect(files.length).toBeGreaterThan(10);
      for (const rel of files)
        expect(read(rel), `${rel}: --text-muted/--text-3 as text colour on the band`).not.toMatch(
          /color:\s*var\(--text-(?:muted|3)\)/,
        );
    });

    it('type: serif, light weight, head heights and card padding are tokens; the hue2 rule exists for every hue', () => {
      expect(light['--font-serif']).toMatch(/serif$/);
      expect(light['--weight-light']).toBe('300');
      expect(light['--card-pad']).toBe('var(--space-5)');
      expect(light['--head-h-tall']).toBe('12.5rem');
      expect(light['--head-h-compact']).toBe('6rem');
      const phone = block('@media (max-width: 899px) {\n  :root');
      expect(phone['--head-h-tall']).toBe('8.5rem');
      expect(phone['--head-h-compact']).toBe('5rem');
      for (const key of Object.keys(light).filter((k) => k.startsWith('--mod-')))
        expect(css, `data-hue2 rule for ${key}`).toContain(
          `[data-hue2='${key.slice(6)}'] {\n  --module-color-2: var(${key});\n}`,
        );
    });

    it('calm and off: the area pattern is not painted at all, not only faded', () => {
      expect(css).toMatch(
        /:root\[data-color='calm'\] \[data-area\],\n:root\[data-module-colors='off'\] \[data-area\] \{\n {2}--area-pattern: none;\n\}/,
      );
    });

    it('no bare font-weight number and no literal font stack outside tokens.css (ratchet: the listed files may only lose them)', () => {
      const weights: Record<string, number> = {};
      const stacks: Record<string, number> = {};
      for (const rel of cssFiles()) {
        if (rel === 'ui/tokens.css' || rel === 'ui/global.css') continue;
        const s = read(rel);
        const w = s.match(/font-weight:\s*\d{3}\b/g)?.length ?? 0;
        if (w) weights[rel] = w;
        const f = s.match(/font-family:\s*(?!var\(--font-|inherit)\S/g)?.length ?? 0;
        if (f) stacks[rel] = f;
      }
      for (const [rel, n] of Object.entries(weights))
        expect(
          n,
          `${rel}: bare font-weight (write --weight-light/medium/semibold/bold)`,
        ).toBeLessThanOrEqual(RAW_WEIGHTS[rel] ?? 0);
      for (const [rel, n] of Object.entries(stacks))
        expect(n, `${rel}: literal font stack (write --font-sans/serif/mono)`).toBeLessThanOrEqual(
          RAW_STACKS[rel] ?? 0,
        );
      // Foundation files are clean; what is left sits in module and tool CSS for the module packages.
      for (const rel of [...Object.keys(weights), ...Object.keys(stacks)])
        expect(rel, 'raw type values in a foundation file').not.toMatch(
          /^(layout\/(?!assistant)|ui\/(?!HelpHint)|home\/|pages\/settings\/PageHead|pages\/library)/,
        );
    });
  });
});

/** Module hues within 25° of --info (blue by convention): ocean and sky in the light theme, teal and ocean in the dark one. */
const INFO_OVERLAPS: Record<'light' | 'dark', string[]> = {
  light: ['--mod-ocean', '--mod-sky'],
  dark: ['--mod-teal', '--mod-ocean'],
};

/** Hues within 25° of each accent variant (see the accent test): documented, not silent. */
const ACCENT_OVERLAPS: Record<string, Record<'light' | 'dark', string[]>> = {
  teal: { light: ['--mod-teal', '--mod-ocean'], dark: ['--mod-teal'] },
  coral: { light: ['--mod-orchid', '--danger'], dark: ['--mod-orchid', '--danger'] },
  lagoon: { light: ['--mod-ocean', '--mod-sky'], dark: ['--mod-ocean', '--mod-sky'] },
};

/* Baseline of bare `font-weight: NNN` per file (identity v3.1); the module packages replace them with tokens and shrink this list. */
const RAW_WEIGHTS: Record<string, number> = {
  'core/importer/OnboardingWizard.module.css': 3,
  'core/recurrence/RecurrenceEditor.module.css': 1,
  'layout/assistant/assistant.module.css': 5,
  'modules/browser/routes/BrowserPage.module.css': 1,
  'modules/disk/components/Basket.module.css': 1,
  'modules/disk/components/Breadcrumb.module.css': 1,
  'modules/disk/components/DeleteDialog.module.css': 1,
  'modules/disk/components/NodeList.module.css': 1,
  'modules/disk/routes/DrivesPage.module.css': 1,
  'modules/disk/routes/ScanPage.module.css': 1,
  'modules/notes/components/Dialogs.module.css': 1,
  'modules/notes/components/NotePane.module.css': 2,
  'modules/notes/components/PageList.module.css': 1,
  'modules/notes/components/TabBar.module.css': 1,
  'modules/notes/editor/Editor.module.css': 1,
  'pages/settings/settings.module.css': 3,
  'quickCapture/ui/CaptureForm.module.css': 1,
  'tools/tools.module.css': 2,
  'ui/HelpHint.module.css': 1,
};

/* Baseline of literal font stacks per file (serif readers, monospace tools): the same ratchet. */
const RAW_STACKS: Record<string, number> = {
  'modules/bookmarks/routes/reader.module.css': 1,
  'modules/browser/components/ReaderPanel.module.css': 1,
  'modules/feeds/routes/feeds.module.css': 2,
  'modules/notes/components/NotePane.module.css': 1,
  'modules/notes/components/NotePaper.module.css': 1,
  'modules/notes/components/PageList.module.css': 1,
  'modules/notes/widgets/RecentNotesWidget.module.css': 2,
  'tools/diff/Tool.module.css': 1,
  'tools/regex/Tool.module.css': 2,
  'tools/tools.module.css': 1,
};

it('BankCard: the ink keeps 4.5:1 at the worst point of the gradient, every hue, both themes, calm included', () => {
  const card = read('ui/identity/BankCard.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const flat = card.replace(/\s+/g, ' ');
  // The gradient as the test computes it: hue darkened at the start, the hue, the second hue itself at the end.
  const gradient =
    /linear-gradient\( 135deg, color-mix\(in srgb, var\(--module-color\) (\d+)%, black\), var\(--module-color\) \d+%, var\(--module-color-2, var\(--module-color\)\) \)/.exec(
      flat,
    );
  expect(gradient, 'the gradient changed: compute its stops here').not.toBeNull();
  const start = Number(gradient![1]) / 100;
  // Nothing lowers the ink (no opacity on the text lines), and the shine moves the surface away from it.
  expect(card).not.toMatch(/\bopacity\s*:/);
  expect(flat).toMatch(/\.card \{[^}]*color: var\(--card-ink, var\(--surface\)\);/);
  expect(flat).toMatch(
    /\.card \{[^}]*--card-shine: color-mix\(in srgb, black \d+%, transparent\);/,
  );
  const darkRules = [
    ...flat.matchAll(
      /:global\(:root(?:\[data-theme='dark'\]|:not\(\[data-theme='light'\]\))\) \.card \{([^}]*)\}/g,
    ),
  ];
  expect(darkRules, 'dark: explicit and system').toHaveLength(2);
  for (const [, body] of darkRules) {
    expect(body).toContain('--card-ink: var(--bg);');
    expect(body).toMatch(/--card-shine: color-mix\(in srgb, white \d+%, transparent\);/);
  }
  expect(flat).toMatch(/\.card::before \{[^}]*background: var\(--card-shine\);/);
  // Calm / module colours off: darkened grey in light, the plain grey in dark (explicit and system).
  const calmLight =
    /\[data-module-colors='off'\]\) \.card \{ background: color-mix\(in srgb, var\(--text-3\) (\d+)%, black\); \}/.exec(
      flat,
    );
  expect(calmLight, 'calm fill in light').not.toBeNull();
  expect(
    flat.match(/\[data-module-colors='off'\]\) \.card \{ background: var\(--text-3\); \}/g),
  ).toHaveLength(2);

  const BLACK = '#000000';
  for (const [name, t, ink] of [
    ['light', light, light['--surface']!],
    ['dark', dark, dark['--bg']!],
  ] as const) {
    // Every hue can be the first or the second one, so the stops are: any hue darkened, any hue itself.
    for (const key of Object.keys(t).filter((k) => k.startsWith('--mod-'))) {
      expect(ratio(ink, mix(t[key]!, BLACK, start)), `${name} ${key} start`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(ratio(ink, t[key]!), `${name} ${key} middle / end`).toBeGreaterThanOrEqual(4.5);
    }
    const calm =
      name === 'light' ? mix(t['--text-3']!, BLACK, Number(calmLight![1]) / 100) : t['--text-3']!;
    expect(ratio(ink, calm), `${name} calm`).toBeGreaterThanOrEqual(4.5);
  }
});

/** Saturation as the stimulus measurement reads it (`measurePage` in scripts/lib/stimulusBudget.ts): (max − min) / max. */
const saturationOf = (hex: string): number => {
  const c = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  const max = Math.max(...c);
  return max === 0 ? 0 : (max - Math.min(...c)) / max;
};
const TONE_SURFACES = ['--bg', '--surface', '--surface-2', '--surface-raised', '--surface-sunken'];

it('tone steps (Identity 4.0): sunken lies under the page and raised over it, in both themes; UI ink keeps 3:1 on both', () => {
  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    expect(lum(t['--surface-sunken']!), `${name}: sunken under the page`).toBeLessThan(
      lum(t['--bg']!),
    );
    expect(lum(t['--surface-raised']!), `${name}: raised over the page`).toBeGreaterThan(
      lum(t['--bg']!),
    );
    for (const bg of ['--surface-raised', '--surface-sunken']) {
      for (const fg of ['--border-strong', '--focus'])
        expect(ratio(t[fg]!, t[bg]!), `${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
      expect(ratio(t['--accent']!, t[bg]!), `${name}: --accent on ${bg}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    // A hairline between rows stays visible on the surface the rows lie on, and never reads as a frame (< 3:1).
    const hair = ratio(t['--border']!, t['--surface-raised']!);
    expect(hair, `${name}: --border on --surface-raised`).toBeGreaterThan(1.1);
    expect(hair, `${name}: --border on --surface-raised`).toBeLessThan(3);
  }
});

it('calm colour mode: every hue and every state but danger becomes --calm-ink, a grey without a cast that keeps AA on every surface', () => {
  const calm = block(":root[data-color='calm']");
  for (const key of Object.keys(light).filter((k) => /^--(cat|mod)-/.test(k)))
    expect(calm[key], `${key} in calm`).toBe('var(--calm-ink)');
  for (const key of ['--success', '--warning', '--info'])
    expect(calm[key], `${key} in calm`).toBe('var(--calm-ink)');
  // Overdue and today keep their colour.
  for (const key of ['--danger', '--accent']) expect(calm, key).not.toHaveProperty(key);
  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    // Under the measurement's limit for a coloured surface (0.12), with room; --text-3 lies over it in both themes.
    expect(saturationOf(t['--calm-ink']!), `${name}: --calm-ink has no cast`).toBeLessThan(0.1);
    for (const bg of TONE_SURFACES) {
      expect(
        ratio(t['--calm-ink']!, t[bg]!),
        `${name}: --calm-ink on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
      // As a state it is also text on its own 15 % background (`--success` on `--success-soft`, a swipe hint).
      expect(
        ratio(t['--calm-ink']!, mix(t['--calm-ink']!, t[bg]!, 0.15)),
        `${name}: --calm-ink on its soft background over ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});

it('BankCard in calm: the fill is --calm-ink with the same lightness rule, and the ink keeps 4.5:1 on it', () => {
  const flat = read('ui/identity/BankCard.module.css')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');
  const calmLight =
    /:global\(:root\[data-color='calm'\]\) \.card \{ background: color-mix\(in srgb, var\(--calm-ink\) (\d+)%, black\); \}/.exec(
      flat,
    );
  expect(calmLight, 'calm fill in light').not.toBeNull();
  expect(
    flat.match(/\[data-color='calm'\]\) \.card \{ background: var\(--calm-ink\); \}/g),
    'calm fill in dark: explicit and system',
  ).toHaveLength(2);
  const lightFill = mix(light['--calm-ink']!, '#000000', Number(calmLight![1]) / 100);
  expect(ratio(light['--surface']!, lightFill), 'light').toBeGreaterThanOrEqual(4.5);
  expect(ratio(dark['--bg']!, dark['--calm-ink']!), 'dark').toBeGreaterThanOrEqual(4.5);
});

it('area patterns (AE2): the dark theme has its own, lower values; light keeps the v3 ones', () => {
  expect(Number(light['--pattern-head'])).toBe(0.06);
  expect(Number(light['--pattern-widget'])).toBe(0.04);
  expect(Number(dark['--pattern-head'])).toBeLessThanOrEqual(0.03);
  expect(Number(dark['--pattern-widget'])).toBeLessThanOrEqual(0.02);
  expect(Number(dark['--pattern-head'])).toBeGreaterThan(0);
});

it('page widths: reading is 56 to 64 rem, the split detail panel follows DESIGN-SPEC § 2', () => {
  expect(light['--page-reading']).toBe('clamp(56rem, 50vw, 64rem)');
  expect(light['--split-detail']).toBe('clamp(22rem, 30%, 30rem)');
});

it('links (B7): the text ink with an underline, in both themes; the accent is not a link colour', () => {
  expect(light['--link']).toBe('var(--text)');
  expect(light['--link-line']).toBe('underline');
  // One definition for both themes: the dark blocks do not turn links back into an accent.
  expect(dark['--link']).toBeUndefined();
  expect(darkMedia['--link']).toBeUndefined();
  const global = read('ui/global.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const a = /(?:^|\n)a \{([^}]*)\}/.exec(global)?.[1] ?? '';
  expect(a).toMatch(/color:\s*var\(--link\)/);
  expect(a).toMatch(/text-decoration-line:\s*var\(--link-line\)/);
  expect(a).not.toMatch(/var\(--accent\)/);
});

it('module head (Identity 4.0): title row + tabs fit 120 px on the desktop and, with the module row, 144 px on the phone', () => {
  const px = (v: string) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));
  const phone = block('@media (max-width: 899px) {\n  :root');
  const touch = px(light['--touch']!);
  expect(light['--head-pad']).toBe('var(--space-3)');
  const desktop = px(light['--space-3']!) + px(light['--head-row']!) + touch + 1;
  expect(desktop).toBeLessThanOrEqual(120);
  const small = px(phone['--head-pad']!) + px(phone['--head-row']!) + 2 * touch + 1;
  expect(small).toBeLessThanOrEqual(144);
  // The phone's title row is still a 44 px target row, and the one h1 style is 28 px / 22 px.
  expect(px(phone['--head-row']!)).toBeGreaterThanOrEqual(touch);
  expect(light['--text-h1']).toBe('1.75rem');
  expect(phone['--text-h1']).toBe('1.375rem');
});
