// Lists the tests that only passed on their retry ("flaky") in the job summary of a GitHub Actions run, so a
// retry is visible without opening the log (CI round 3, package 4). The retry itself is unchanged
// (`retries` in the Playwright configs). Outside GitHub Actions (no GITHUB_STEP_SUMMARY) it does nothing.
import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { Reporter, TestCase } from '@playwright/test/reporter';

const MAX_ERROR = 160;
// Colour codes in Playwright's error messages (ESC [ … m).
const ANSI_COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export default class FlakySummaryReporter implements Reporter {
  private readonly flaky: TestCase[] = [];

  onTestEnd(test: TestCase): void {
    // Called once per attempt; the outcome is final once the last attempt has ended.
    if (test.outcome() === 'flaky' && !this.flaky.includes(test)) this.flaky.push(test);
  }

  onEnd(): void {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (!file || this.flaky.length === 0) return;
    const rows = this.flaky.map((test) => {
      const where = `${relative(process.cwd(), test.location.file)}:${test.location.line}`;
      const project = test.parent.project()?.name ?? '';
      const firstError = test.results.find((r) => r.status !== 'passed')?.error?.message ?? '';
      const error = firstError.replace(ANSI_COLOUR, '').split('\n')[0].slice(0, MAX_ERROR);
      return `| \`${where}\` | ${project} | ${cell(test.title)} | ${cell(error)} |`;
    });
    appendFileSync(
      file,
      [
        `### Retried tests: ${this.flaky.length}`,
        '',
        'Green only on the retry: the run counts them as passed. Each one is a flaky test to fix (cause, not a longer timeout).',
        '',
        '| Test | Project | Title | First error |',
        '| --- | --- | --- | --- |',
        ...rows,
        '',
      ].join('\n'),
    );
  }

  printsToStdio(): boolean {
    return false;
  }
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}
