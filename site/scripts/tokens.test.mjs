// The site's colour tokens must match the app's (web/src/ui/tokens.css) so the two never drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = readFileSync(path.join(here, '..', 'src', 'styles', 'tokens.css'), 'utf8');
const app = readFileSync(path.join(here, '..', '..', 'web', 'src', 'ui', 'tokens.css'), 'utf8');

/** Returns { name: value } for every `--x: value;` inside the given block of a stylesheet. */
function block(css, startMarker, endMarker) {
  const start = css.indexOf(startMarker);
  assert.ok(start >= 0, `marker ${startMarker} not found`);
  const end = endMarker ? css.indexOf(endMarker, start) : css.length;
  const out = {};
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  return out;
}

const HUES = ['lime', 'moss', 'fern', 'teal', 'ocean', 'sky', 'cobalt', 'indigo', 'violet', 'orchid', 'slate'];
const COLOURS = ['--bg', '--surface', '--surface-2', '--border', '--border-strong', '--text', '--text-muted', '--text-3', '--focus', '--accent', '--accent-hover', '--accent-contrast', '--warning', ...HUES.map((h) => `--mod-${h}`)];
// Identity v3 tints and pattern strengths: the app sets them once in :root (same in both themes).
const IDENTITY = ['--head-tint-0', '--head-tint-1', '--group-tint', '--pattern-ink'];
const AREAS = ['plan', 'money', 'household', 'knowledge', 'vault', 'system'];
const identity = readFileSync(path.join(here, '..', 'src', 'styles', 'identity.css'), 'utf8');
const SCALE = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--font-mono'];

test('light theme colours match the app', () => {
  const s = block(site, ':root {', ':root[data-theme');
  const a = block(app, ':root {', ':root[data-theme');
  for (const k of [...COLOURS, ...SCALE, ...IDENTITY]) assert.equal(s[k], a[k], k);
});

test('every hue maps to --module-color and --module-color-2 (identity.css)', () => {
  for (const h of HUES) {
    const one = block(identity, `[data-hue='${h}'] {`, '}');
    assert.equal(one['--module-color'], `var(--mod-${h})`, h);
    const two = block(identity, `[data-hue2='${h}'] {`, '}');
    assert.equal(two['--module-color-2'], `var(--mod-${h})`, h);
  }
  const hue = block(identity, '[data-hue] {', '\n}');
  const appHue = block(app, '[data-hue] {', '\n}');
  for (const k of ['--head-flat', '--head-gradient']) assert.equal(hue[k], appHue[k], k);
});

test('neutral plates keep the text ink in the dark theme', () => {
  // The dark plate rules out-specify `.plate.neutral`; they must leave neutral plates alone.
  const dark = identity.match(/:root(?:\[data-theme='dark'\]|:not\(\[data-theme='light'\]\)) \.plate[^{]*\{/g) ?? [];
  assert.equal(dark.length, 2, 'two dark plate rules');
  for (const rule of dark) assert.match(rule, /\.plate:not\(\.neutral\)/, rule);
});

test('area patterns match the app', () => {
  for (const id of AREAS) {
    const s = block(identity, `[data-area='${id}'] {`, '}');
    const a = block(app, `[data-area='${id}'] {`, '}');
    for (const k of ['--area-pattern', '--area-pattern-size']) assert.equal(s[k], a[k], `${id} ${k}`);
  }
});

test('dark theme colours match the app', () => {
  const s = block(site, ":root[data-theme='dark']", '@media');
  const a = block(app, ":root[data-theme='dark']", '@media');
  for (const k of COLOURS) assert.equal(s[k], a[k], k);
});

test('both dark blocks of the site are identical', () => {
  const explicit = block(site, ":root[data-theme='dark']", '@media');
  const system = block(site, '@media (prefers-color-scheme: dark)', null);
  for (const k of Object.keys(explicit)) assert.equal(system[k], explicit[k], k);
});

// Site-only tokens: everything in tokens.css is either the app's token (same name, pinned above where it is a
// colour or a scale step) or one of these. A new site token must be listed here; none may reuse an app name.
const SITE_ONLY = ['--text-h2', '--block', '--content-w', '--gutter', '--font-site', '--weight-heavy', '--text-display', '--text-time', '--text-lead', '--section', '--line', '--rule'];
const PALETTES = ['korallenriff', 'tiefsee', 'sand', 'nordlicht', 'monochrom'];
const names = (css) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

test('every site token is the app\'s or a listed site-only token', () => {
  const appNames = names(app);
  const known = new Set([...SITE_ONLY, ...PALETTES.map((p) => `--palette-${p}`)]);
  for (const n of names(site)) assert.ok(appNames.has(n) || known.has(n), `${n} is neither an app token nor listed as site-only`);
  for (const n of known) assert.ok(!appNames.has(n), `${n} also exists in the app: use the app's value or another name`);
});

test('the supporter palette accents match the app', () => {
  const themes = readFileSync(path.join(here, '..', '..', 'web', 'src', 'ui', 'supporterThemes.css'), 'utf8');
  const s = block(site, ':root {', ':root[data-theme');
  for (const p of PALETTES) assert.equal(s[`--palette-${p}`], block(themes, `:root[data-palette='${p}']`, '}')['--accent'], p);
});

// Colours live in tokens.css only: no colour literal and no inline style in a component, page, layout or stylesheet
// (the CSP allows no inline style; a literal would drift from the app).
test('components, pages and stylesheets write no colour of their own', async () => {
  const { readdirSync } = await import('node:fs');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const root = path.join(here, '..', 'src');
  for (const file of walk(root).filter((f) => /\.(astro|css)$/.test(f) && !f.endsWith('tokens.css'))) {
    // The two theme-color metas cannot read a custom property; the next test pins them to --bg.
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/&#\d+;/g, '').replace(/<meta name="theme-color"[^>]*>/g, '');
    assert.doesNotMatch(src, /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b(?=\s*[;)!])|\b(?:rgb|hsl|oklch)a?\(/i, `colour literal in ${path.relative(root, file)}`);
    assert.doesNotMatch(src, /\sstyle=/, `inline style in ${path.relative(root, file)}`);
  }
});

test('the theme-color metas are the page background of each theme', () => {
  const base = readFileSync(path.join(here, '..', 'src', 'layouts', 'Base.astro'), 'utf8');
  const meta = (scheme) => base.match(new RegExp(`<meta name="theme-color" media="\\(prefers-color-scheme: ${scheme}\\)" content="([^"]+)"`))?.[1];
  assert.equal(meta('light'), block(site, ':root {', ':root[data-theme')['--bg']);
  assert.equal(meta('dark'), block(site, ":root[data-theme='dark']", '@media')['--bg']);
});
