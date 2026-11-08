import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Signing keys live in GitHub Environments and are touched by exactly one kind of job (docs/howto/ci.md,
 * "Signing"): a job with `environment:` that holds the key steps and nothing else. Agents can change repository
 * scripts, lock files and caches, so none of them may run in such a job; only steps written in the workflow file
 * and first-party actions do. This test is a tripwire for honest mistakes; the real boundary is the environment's
 * branch/tag policy in the repository settings.
 *
 * Every workflow and composite action is scanned. `TEMPORARY` lists files that still use repository-level
 * secrets and are converted in their own PR; take a file off the list when its signing jobs are split.
 */
const TEMPORARY = new Set(['dev-preview.yml', 'ci.yml']);
const githubDir = resolve(__dirname, '../../../.github');

/** Signing secret group -> the environment that must be bound by every job that reads it (lower case). */
const GROUPS: { env: string; names: RegExp }[] = [
  {
    env: 'release-signing',
    names:
      /^(tauri_signing_private_key(_password)?|android_keystore_base64|android_keystore_password|android_key_alias|android_key_password)$/,
  },
  { env: 'site-hook', names: /^cf_pages_deploy_hook$/ },
  { env: 'dev-signing', names: /^(tauri_dev_[a-z_]+|android_dev_[a-z_]+)$/ },
];
const ENVIRONMENTS = new Set(GROUPS.map((g) => g.env));

interface Source {
  file: string;
  header: string;
  jobs: Job[];
}
interface Job {
  name: string;
  body: string;
  environment: string | undefined;
}

/** Removes a YAML comment (a `#` at the start or after whitespace, outside quotes). */
function stripComment(line: string): string {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === "'" || c === '"') quote = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]!))) return line.slice(0, i);
  }
  return line;
}

function parse(file: string, raw: string): Source {
  const text = raw.split('\n').map(stripComment).join('\n');
  const at = text.search(/^jobs:\s*$/m);
  const header = at < 0 ? text : text.slice(0, at);
  const parts = at < 0 ? [''] : text.slice(at).split(/\n {2}([\w-]+):[ \t]*\n/);
  const jobs: Job[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1] ?? '';
    const env = /^ {4}environment:[ \t]*(\S.*)?$/m.exec(body);
    jobs.push({
      name: parts[i]!,
      body,
      environment: env ? (env[1] ?? '').trim().replace(/^['"]|['"]$/g, '') || '<block>' : undefined,
    });
  }
  return { file, header, jobs };
}

function sources(): Source[] {
  const isYaml = (f: string) => f.endsWith('.yml') || f.endsWith('.yaml');
  const workflows = readdirSync(join(githubDir, 'workflows')).filter(isYaml);
  const actions = readdirSync(join(githubDir, 'actions'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(githubDir, 'actions', d.name))
        .filter(isYaml)
        .map((f) => `${d.name}/${f}`),
    );
  return [
    ...workflows.map((f) => parse(f, readFileSync(join(githubDir, 'workflows', f), 'utf8'))),
    ...actions.map((f) =>
      parse(`actions/${f}`, readFileSync(join(githubDir, 'actions', f), 'utf8')),
    ),
  ];
}

/** Secret names read in `text`, lower case, in every access form: `secrets.X`, `secrets['X']`, `secrets["X"]`. */
function secretNames(text: string): string[] {
  const names = [...text.matchAll(/secrets\s*\.\s*([\w-]+)/gi)].map((m) => m[1]!);
  names.push(...[...text.matchAll(/secrets\s*\[\s*['"]([^'"]+)['"]\s*\]/gi)].map((m) => m[1]!));
  return names.map((n) => n.toLowerCase());
}
/** Ways to reach every secret at once or by computed name. */
const BULK =
  /toJSON\(\s*secrets\s*\)|secrets\s*\[\s*(?!['"])|secrets\s*:\s*inherit|\bsecrets\s*\}\}/i;

const all = sources();
const jobsOf = (s: Source) => s.jobs.map((j) => ({ file: s.file, ...j }));
const allJobs = all.flatMap(jobsOf);
const envJobs = allJobs.filter((j) => j.environment !== undefined);

describe('signing environments', () => {
  it('finds the workflows, the actions and the environment jobs', () => {
    expect(all.length).toBeGreaterThan(8);
    expect(allJobs.length).toBeGreaterThan(20);
    expect(envJobs.map((j) => `${j.file}:${j.name}`)).toEqual(
      expect.arrayContaining(['release.yml:sign', 'release.yml:website']),
    );
  });

  it('binds only the known environments (an unknown one such as `copilot` or `production` is a mistake)', () => {
    const bad = envJobs.filter((j) => !ENVIRONMENTS.has(j.environment!.toLowerCase()));
    expect(bad.map((j) => `${j.file}:${j.name} environment: ${j.environment}`)).toEqual([]);
  });

  it('reads a signing secret only in a job bound to the matching environment', () => {
    const wrong: string[] = [];
    for (const job of allJobs.filter((j) => !TEMPORARY.has(j.file))) {
      for (const name of new Set(secretNames(job.body))) {
        const group = GROUPS.find((g) => g.names.test(name));
        if (group && job.environment?.toLowerCase() !== group.env) {
          wrong.push(`${job.file}:${job.name} reads ${name} without environment ${group.env}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('knows every secret a workflow reads (an unknown one must join a group above)', () => {
    const known = (n: string) => n === 'github_token' || GROUPS.some((g) => g.names.test(n));
    const unknown = all.flatMap((s) =>
      [...new Set(secretNames(s.jobs.map((j) => j.body).join('\n') + s.header))]
        .filter((n) => !known(n))
        .map((n) => `${s.file} reads secrets.${n}`),
    );
    expect(unknown).toEqual([]);
  });

  it('keeps secrets out of workflow-level `env:` and out of composite actions', () => {
    const leaks = all
      .filter((s) => !TEMPORARY.has(s.file) || s.file.startsWith('actions/'))
      .filter(
        (s) =>
          secretNames(s.header).some((n) => n !== 'github_token') ||
          (s.file.startsWith('actions/') &&
            secretNames(s.jobs.map((j) => j.body).join('\n')).length > 0),
      )
      .map((s) => s.file);
    expect(leaks).toEqual([]);
  });

  it('never passes all secrets at once or by computed name', () => {
    const bulk = all
      .filter((s) => !TEMPORARY.has(s.file))
      .filter((s) => BULK.test(s.header + s.jobs.map((j) => j.body).join('\n')))
      .map((s) => s.file);
    expect(bulk).toEqual([]);
  });

  it('runs nothing from the repository, from an artifact or from the network in an environment job', () => {
    const forbidden: [string, RegExp][] = [
      ['checkout', /uses:\s*actions\/checkout/],
      ['local action', /uses:\s*\.\//],
      ['repository script', /\bnode\s+(\.\/)?(web\/)?scripts\//],
      ['node file', /\bnode\s+(?!-e\b|-\s|--version|-v\b)[^\s-]/],
      ['npm ci', /\bnpm\s+ci\b/],
      [
        'npm install without --ignore-scripts',
        /\bnpm\s+(i|install|add)\b(?![^\n]*--ignore-scripts)/,
      ],
      ['npx', /\bnpx\b/],
      ['yarn/pnpm/pip/cargo', /\b(yarn|pnpm|pip3?|cargo)\s/],
      ['shell/interpreter running a file', /\b(bash|sh|zsh|python3?|perl|ruby|pwsh)\s+[^-\s]/],
      ['source', /(^|\s)source\s/],
      ['relative executable', /(^|[\s;&|(])\.\/\S/],
      ['chmod', /\bchmod\b/],
      ['cache', /(^|\s)cache:|rust-cache|actions\/cache/],
      ['GITHUB_ENV', /GITHUB_ENV/],
      ['GITHUB_PATH', /GITHUB_PATH/],
      ['secrets: inherit', /secrets:\s*inherit/],
      ['curl | sh', /\|\s*(ba)?sh\b/],
    ];
    const found = envJobs.flatMap((j) =>
      forbidden.filter(([, re]) => re.test(j.body)).map(([what]) => `${j.file}:${j.name} ${what}`),
    );
    expect(found).toEqual([]);
  });

  it('uses only first-party actions in an environment job', () => {
    const third = envJobs.flatMap((j) =>
      [...j.body.matchAll(/uses:\s*(\S+)/g)]
        .map((m) => m[1]!)
        .filter((ref) => !ref.startsWith('actions/'))
        .map((ref) => `${j.file}:${j.name} ${ref}`),
    );
    expect(third).toEqual([]);
  });

  it('never binds an environment together with contents: write', () => {
    const bad = envJobs.filter((j) => /contents:\s*write/.test(j.body));
    expect(bad.map((j) => `${j.file}:${j.name}`)).toEqual([]);
  });

  it('keeps the release build jobs free of any secret', () => {
    const build = all
      .filter((s) => s.file === 'release.yml')
      .flatMap(jobsOf)
      .filter((j) => ['windows', 'android', 'prepare', 'verify', 'release'].includes(j.name));
    expect(build.length).toBe(5);
    expect(
      build.filter((j) => secretNames(j.body).some((n) => n !== 'github_token')).map((j) => j.name),
    ).toEqual([]);
  });

  it('keeps the secret-value audit inside the release sign job (the only job that has the values)', () => {
    const sign = all.find((s) => s.file === 'release.yml')!.jobs.find((j) => j.name === 'sign')!;
    expect(sign.body).toMatch(/Audit – no secret value in what was signed/);
    for (const name of [
      'TAURI_SIGNING_PRIVATE_KEY',
      'ANDROID_KEYSTORE_BASE64',
      'ANDROID_KEY_PASSWORD',
    ]) {
      expect(sign.body).toContain(`'${name}'`);
    }
  });
});
