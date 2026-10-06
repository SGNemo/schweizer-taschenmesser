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

const COLOURS = ['--bg', '--surface', '--surface-2', '--border', '--border-strong', '--text', '--text-muted', '--text-3', '--focus', '--accent', '--accent-hover', '--accent-contrast', '--accent-soft', '--warning'];
const SCALE = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--font-sans', '--font-mono'];

test('light theme colours match the app', () => {
  const s = block(site, ':root {', ':root[data-theme');
  const a = block(app, ':root {', ':root[data-theme');
  for (const k of [...COLOURS, ...SCALE]) assert.equal(s[k], a[k], k);
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
