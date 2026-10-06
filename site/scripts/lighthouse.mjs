/**
 * Lighthouse for the built site: starts a static server on dist/ and audits the main pages.
 * Prints a score table and writes the HTML reports to .lighthouseci/. Targets: ≥ 95 everywhere.
 * CI treats the thresholds as warnings (see lighthouserc.cjs); locally this exits 1 below target.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lhci = path.join(site, 'node_modules', '.bin', 'lhci');
// Chrome: PLAYWRIGHT_CHROMIUM, else the pinned path of the cloud sessions if it exists, else whatever
// chrome-launcher finds on its own (GitHub runners ship Chrome; CHROME_PATH must not point nowhere).
const pinned = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const chrome = process.env.PLAYWRIGHT_CHROMIUM || (existsSync(pinned) ? pinned : undefined);

const child = spawn(lhci, ['autorun', '--config', path.join(site, 'lighthouserc.cjs')], {
  cwd: site,
  stdio: 'inherit',
  env: chrome ? { ...process.env, CHROME_PATH: chrome } : process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
