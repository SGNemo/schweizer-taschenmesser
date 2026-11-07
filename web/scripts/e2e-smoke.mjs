// `npm run e2e:smoke`: the E2E set of a plain pull request (E2E_PROFILE=smoke in playwright.config.ts:
// desktop-chrome, SMOKE_FILES). Extra arguments go to Playwright. A script instead of `E2E_PROFILE=smoke …`
// so the same command works in cmd and PowerShell.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, E2E_PROFILE: 'smoke' },
});
process.exit(result.status ?? 1);
