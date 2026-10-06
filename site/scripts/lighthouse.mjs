/**
 * Lighthouse for the built site: starts a static server on dist/ and audits the main pages.
 * Prints a score table and writes the HTML reports to .lighthouseci/. Targets: ≥ 95 everywhere.
 * CI treats the thresholds as warnings (see lighthouserc.cjs); locally this exits 1 below target.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lhci = path.join(site, 'node_modules', '.bin', 'lhci');
const chrome = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const child = spawn(lhci, ['autorun', '--config', path.join(site, 'lighthouserc.cjs')], {
  cwd: site,
  stdio: 'inherit',
  env: { ...process.env, CHROME_PATH: chrome },
});
child.on('exit', (code) => process.exit(code ?? 1));
