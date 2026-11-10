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
const COLOURS = ['--bg', '--surface', '--surface-2', '--border', '--border-strong', '--text', '--text-muted', '--text-3', '--focus', '--accent', '--accent-hover', '--accent-contrast', '--accent-soft', '--warning', ...HUES.map((h) => `--mod-${h}`), '--sky-day-0', '--sky-day-1'];
// Identity v3 tints and pattern strengths: the app sets them once in :root (same in both themes).
const IDENTITY = ['--head-tint-0', '--head-tint-1', '--widget-tint', '--group-tint', '--pattern-head', '--pattern-widget', '--pattern-ink', '--sky-sun'];
const AREAS = ['plan', 'money', 'household', 'knowledge', 'vault', 'system'];
const identity = readFileSync(path.join(here, '..', 'src', 'styles', 'identity.css'), 'utf8');
const SCALE = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--font-sans', '--font-mono'];

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

// Round 5: the hero stands on the app's ocean gradient. The two stops are pinned to the app; the site's own ink on
// it must stay readable on the lighter stop (WCAG AA: 4.5 for text, 3 for large text and non-text).
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('the ocean gradient matches the app', () => {
  const s = block(site, ':root {', ':root[data-theme');
  const a = block(app, ':root {', ':root[data-theme');
  for (const k of ['--ocean-from', '--ocean-to']) assert.equal(s[k], a[k], k);
});

test('ink on the ocean surface keeps AA contrast', () => {
  const s = block(site, ':root {', ':root[data-theme');
  const from = s['--ocean-from'];
  for (const k of ['--on-ocean', '--on-ocean-muted', '--on-ocean-meta']) assert.ok(contrast(s[k], from) >= 4.5, `${k} ${contrast(s[k], from).toFixed(2)}`);
  // The accent word is 34 px bold or larger, the button a non-text shape, the tick an icon.
  for (const k of ['--on-ocean-accent', '--on-ocean-accent-hover', '--on-ocean-ok']) assert.ok(contrast(s[k], from) >= 3, `${k} ${contrast(s[k], from).toFixed(2)}`);
  assert.ok(contrast(s['--on-ocean-accent-ink'], s['--on-ocean-accent']) >= 4.5, 'button text');
  assert.ok(contrast(s['--on-ocean-accent-ink'], s['--on-ocean-accent-hover']) >= 4.5, 'button text on hover');
});

// Rethink round: the draft directions (src/drafts, /_r/*) may add type and layout tokens of their own (--r-*),
// but every colour still comes from tokens.css. No colour literal and no inline style in the drafts.
test('the draft directions write no colour of their own', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = path.join(here, '..', 'src', 'drafts');
  for (const file of readdirSync(dir).filter((f) => /\.(astro|css)$/.test(f))) {
    const src = readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(src, /#[0-9a-f]{3,8}\b(?![^<]*<\/a>)|\b(?:rgb|hsl|oklch)a?\(/i, `colour literal in ${file}`);
    assert.doesNotMatch(src, /\sstyle=/, `inline style in ${file}`);
  }
  const css = readFileSync(path.join(dir, 'drafts.css'), 'utf8');
  for (const m of css.matchAll(/^\s*(--[\w-]+)\s*:/gm)) assert.match(m[1], /^--r-/, `${m[1]}: draft tokens are named --r-*`);
  for (const m of css.matchAll(/^\s*(--r-[\w-]+)\s*:/gm)) assert.ok(!site.includes(`${m[1]}:`), `${m[1]} is already a site token`);
});
