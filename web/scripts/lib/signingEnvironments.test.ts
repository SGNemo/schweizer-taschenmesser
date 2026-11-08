import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Signing keys live in GitHub Environments and are touched by exactly one kind of job (docs/howto/ci.md,
 * "Signing"): a job with `environment:` that holds the key steps and nothing else. Agents can change repository
 * scripts, lock files and caches, so none of them may run in such a job; only steps written in the workflow file
 * and first-party actions do. Workflows listed in `CONVERTED` already follow this; add a file here when its
 * signing jobs are split.
 */
const CONVERTED = ['release.yml'];
const workflowsDir = resolve(__dirname, '../../../.github/workflows');

const SIGNING_SECRET =
  /secrets\.(TAURI_[A-Z_]*SIGNING[A-Z_]*|TAURI_DEV_[A-Z_]*|ANDROID_[A-Z_]*|CF_PAGES_DEPLOY_HOOK)\b/;

interface Job {
  file: string;
  name: string;
  body: string;
  hasEnvironment: boolean;
}

/** Splits a workflow into its jobs (2-space indented keys under `jobs:`), comments removed. */
function jobsOf(file: string): Job[] {
  const text = readFileSync(join(workflowsDir, file), 'utf8')
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, ''))
    .join('\n');
  const afterJobs = text.slice(text.indexOf('\njobs:') + 6);
  const parts = afterJobs.split(/\n {2}([\w-]+):[ \t]*\n/);
  const jobs: Job[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1] ?? '';
    jobs.push({
      file,
      name: parts[i]!,
      body,
      hasEnvironment: /^ {4}environment:/m.test(body),
    });
  }
  return jobs;
}

const jobs = CONVERTED.flatMap(jobsOf);

describe('signing environments', () => {
  it('finds the jobs of the converted workflows', () => {
    expect(jobs.length).toBeGreaterThan(5);
    expect(jobs.some((j) => j.hasEnvironment)).toBe(true);
  });

  it('keeps every signing secret inside a job that binds an environment', () => {
    const leaks = jobs.filter((j) => !j.hasEnvironment && SIGNING_SECRET.test(j.body));
    expect(leaks.map((j) => `${j.file}:${j.name}`)).toEqual([]);
  });

  it('runs nothing from the repository, no cache and no app install in an environment job', () => {
    const forbidden: [string, RegExp][] = [
      ['checkout', /uses:\s*actions\/checkout/],
      ['local action', /uses:\s*\.\//],
      ['repository script', /\bnode\s+(\.\/)?(web\/)?scripts\//],
      ['npm ci', /\bnpm\s+ci\b/],
      ['npm install without --ignore-scripts', /\bnpm\s+install\b(?![^\n]*--ignore-scripts)/],
      ['cache', /(^|\s)cache:|rust-cache|actions\/cache/],
      ['GITHUB_ENV', /GITHUB_ENV/],
      ['GITHUB_PATH', /GITHUB_PATH/],
      ['secrets: inherit', /secrets:\s*inherit/],
    ];
    const found = jobs
      .filter((j) => j.hasEnvironment)
      .flatMap((j) =>
        forbidden
          .filter(([, re]) => re.test(j.body))
          .map(([what]) => `${j.file}:${j.name} ${what}`),
      );
    expect(found).toEqual([]);
  });

  it('uses only first-party actions in an environment job', () => {
    const third = jobs
      .filter((j) => j.hasEnvironment)
      .flatMap((j) =>
        [...j.body.matchAll(/uses:\s*(\S+)/g)]
          .map((m) => m[1]!)
          .filter((ref) => !ref.startsWith('actions/'))
          .map((ref) => `${j.file}:${j.name} ${ref}`),
      );
    expect(third).toEqual([]);
  });

  it('never binds an environment together with contents: write', () => {
    const bad = jobs.filter((j) => j.hasEnvironment && /contents:\s*write/.test(j.body));
    expect(bad.map((j) => `${j.file}:${j.name}`)).toEqual([]);
  });

  it('keeps the dry-run builds free of signing secrets', () => {
    const build = jobs.filter((j) => ['windows', 'android', 'prepare'].includes(j.name));
    expect(build.length).toBeGreaterThan(0);
    expect(build.filter((j) => /secrets\.[A-Z_]+/.test(j.body)).map((j) => j.name)).toEqual([]);
  });
});
