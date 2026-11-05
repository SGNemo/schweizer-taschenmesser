/**
 * Lighthouse for the built site: starts a static server on dist/ and audits the main pages.
 * Prints a score table and writes the HTML reports to .lighthouseci/. Targets: ≥ 95 everywhere.
 * CI treats the thresholds as warnings (see lighthouserc.cjs); locally this exits 1 below target.
 *
 *   npm run lighthouse -- --dark   audits the dark theme: a copy of dist/ in .lighthouseci-dark/ with
 *                                  `data-theme="dark"` on <html> (what theme.js sets for a stored choice).
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lhci = path.join(site, 'node_modules', '.bin', 'lhci');
const dark = process.argv.includes('--dark');
const extra = [];
if (dark) {
  const copy = path.join(site, '.lighthouseci-dark');
  rmSync(copy, { recursive: true, force: true });
  cpSync(path.join(site, 'dist'), copy, { recursive: true });
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.html'))
        writeFileSync(f, readFileSync(f, 'utf8').replace('<html ', '<html data-theme="dark" '));
    }
  };
  walk(copy);
  extra.push('--collect.staticDistDir=./.lighthouseci-dark');
}
// Chrome: PLAYWRIGHT_CHROMIUM, else the pinned path of the cloud sessions if it exists, else whatever
// chrome-launcher finds on its own (GitHub runners ship Chrome; CHROME_PATH must not point nowhere).
const pinned = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const chrome = process.env.PLAYWRIGHT_CHROMIUM || (existsSync(pinned) ? pinned : undefined);

const child = spawn(lhci, ['autorun', '--config', path.join(site, 'lighthouserc.cjs'), ...extra], {
  cwd: site,
  stdio: 'inherit',
  env: chrome ? { ...process.env, CHROME_PATH: chrome } : process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
