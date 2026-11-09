import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  approvalMessage,
  BUDGET_FILE,
  cli,
  collectHits,
  gitRepo,
  hashOf,
  hitTable,
  ignorePatterns,
  isAppendOnly,
  isApproval,
  loadPublicKey,
  onlyAppendedTests,
  parseArgs,
  RATCHET_PUBLIC_KEY,
  REPO,
  routeSlug,
  runCi,
  runPr,
  SEED_ROWS_FILE,
  SIGNATURE_FILE,
  skipMarks,
  WEB_CHECK,
} from './ratchet.mjs';

/**
 * Acceptance cases of the stimulus ratchet (docs/design/ui-audit-2026-11/PACKAGE-0.md "0a-1a", "Abnahme").
 * The key pair below exists only while this file runs; no key is ever read from disk.
 */
type Files = Record<string, string>;
const blob = (text: string) => createHash('sha1').update(text).digest('hex');
/** History of two snapshots held in memory. */
function mem(base: Files, head: Files) {
  const trees = {
    base: new Map(Object.entries(base).map(([p, t]) => [p, blob(t)])),
    head: new Map(Object.entries(head).map(([p, t]) => [p, blob(t)])),
  };
  const files = { base, head };
  return {
    tree: (rev: 'base' | 'head') => trees[rev],
    read: (rev: 'base' | 'head', path: string) => files[rev][path] ?? null,
    changed: () =>
      [...new Set([...Object.keys(base), ...Object.keys(head)])]
        .filter((p) => base[p] !== head[p])
        .map((path) => ({
          status: !(path in base) ? 'A' : !(path in head) ? 'D' : 'M',
          path,
        })),
  };
}
const hits = (base: Files, head: Files): string[] => collectHits(mem(base, head), 'base', 'head');
const json = (value: unknown) => `${JSON.stringify(value, null, 1)}\n`;

const budget = (pages: Record<string, Record<string, number>>, extra: object = {}) =>
  json({ version: 1, tolerance: { percent: 10, px: 50 }, pages, ...extra });
const PAGE = { height: 900, buttons: 20, borders: 4 };
const BASE_BUDGET = { [BUDGET_FILE]: budget({ 'd1920--finance': PAGE, 'p412--finance': PAGE }) };

describe('stimulus-budget.json', () => {
  it('a raised value is a hit, a lowered one is free', () => {
    expect(
      hits(BASE_BUDGET, {
        [BUDGET_FILE]: budget({
          'd1920--finance': { ...PAGE, buttons: 21 },
          'p412--finance': { ...PAGE, height: 100, borders: 0 },
        }),
      }),
    ).toEqual([`budget ${BUDGET_FILE} d1920--finance.buttons 20→21`]);
  });
  it('raised tolerance and changed version are hits, a lower tolerance is free', () => {
    const pages = { 'd1920--finance': PAGE, 'p412--finance': PAGE };
    expect(
      hits(BASE_BUDGET, {
        [BUDGET_FILE]: json({ version: 2, tolerance: { percent: 15, px: 50 }, pages }),
      }),
    ).toEqual([
      `tolerance ${BUDGET_FILE} {"percent":10,"px":50}→{"percent":15,"px":50}`,
      `version ${BUDGET_FILE} 1→2`,
    ]);
    expect(
      hits(BASE_BUDGET, {
        [BUDGET_FILE]: json({ version: 1, tolerance: { percent: 5, px: 0 }, pages }),
      }),
    ).toEqual([]);
  });
  it('a removed page and a removed metric are hits', () => {
    expect(
      hits(BASE_BUDGET, {
        [BUDGET_FILE]: budget({ 'd1920--finance': { height: 900, buttons: 20 } }),
      }),
    ).toEqual([
      `budget ${BUDGET_FILE} d1920--finance.borders 4→-`,
      `page-removed ${BUDGET_FILE} p412--finance`,
    ]);
  });
  it('a new metric key is free', () => {
    expect(
      hits(BASE_BUDGET, {
        [BUDGET_FILE]: budget({
          'd1920--finance': { ...PAGE, shadows: 7 },
          'p412--finance': { ...PAGE, shadows: 7 },
        }),
      }),
    ).toEqual([]);
  });
  it('a new page is a hit unless the same change adds its route to a manifest', () => {
    const more = {
      [BUDGET_FILE]: budget({
        'd1920--finance': PAGE,
        'p412--finance': PAGE,
        'd1920--routines': PAGE,
      }),
    };
    expect(hits(BASE_BUDGET, more)).toEqual([`page-new ${BUDGET_FILE} d1920--routines`]);
    const manifest = 'web/src/modules/routines/manifest.ts';
    expect(
      hits(BASE_BUDGET, { ...more, [manifest]: "routes: [{ path: '/routines', element }]" }),
    ).toEqual([]);
    // The route was there before: the page is not new through this change.
    expect(
      hits(
        { ...BASE_BUDGET, [manifest]: "routes: [{ path: '/routines' }]" },
        { ...more, [manifest]: "routes: [{ path: '/routines' }], layout: 'wide'" },
      ),
    ).toEqual([`page-new ${BUDGET_FILE} d1920--routines`]);
    expect(routeSlug('/disk/scan')).toBe('disk-scan');
  });
  it('an unreadable budget is a hit', () => {
    expect(hits(BASE_BUDGET, { [BUDGET_FILE]: '{' })).toEqual([
      `version ${BUDGET_FILE} 1→unreadable`,
    ]);
  });
});

describe('baselines', () => {
  const file = 'web/scripts/baselines/max-width.json';
  it('raised number and new key are hits; lower, removed and a new file are free', () => {
    const base = { [file]: json({ files: { 'a.css': 2, 'b.css': 1 }, allowed: ['x'] }) };
    expect(hits(base, { [file]: json({ files: { 'a.css': 3 }, allowed: ['x'] }) })).toEqual([
      `baseline ${file} ["files","a.css"] 2→3`,
    ]);
    expect(hits(base, { [file]: json({ files: { 'a.css': 1 }, allowed: [] }) })).toEqual([]);
    expect(
      hits(base, {
        [file]: json({ files: { 'a.css': 2, 'b.css': 1, 'c.css': 1 }, allowed: ['x', 'y'] }),
      }),
    ).toEqual([
      `baseline ${file} ["allowed","[]"] -→"y"`,
      `baseline ${file} ["files","c.css"] -→1`,
    ]);
    expect(hits({}, base)).toEqual([]);
    expect(hits(base, {})).toEqual([`baseline ${file} * present→-`]);
  });
  it('seed rows: every lowered or removed count is a hit, more rows are free', () => {
    const rows = (r: object) => ({
      [SEED_ROWS_FILE]: json({ version: 1, scale: 'medium', rows: r }),
    });
    const base = rows({ finance_transaction: 240, notes_note: 12 });
    expect(hits(base, rows({ finance_transaction: 200 }))).toEqual([
      'seed-rows finance_transaction 240→200',
      'seed-rows notes_note 12→-',
    ]);
    expect(hits(base, rows({ finance_transaction: 260, notes_note: 12, clock_alarm: 3 }))).toEqual(
      [],
    );
    expect(
      hits(base, {
        [SEED_ROWS_FILE]: json({
          version: 1,
          scale: 'small',
          rows: { finance_transaction: 240, notes_note: 12 },
        }),
      }),
    ).toEqual(['seed-rows @scale "medium"→"small"']);
    expect(hits(base, {})).toEqual(['seed-rows @file present→-']);
  });
  it('signature blocks: every new, changed or removed entry is a hit', () => {
    const blocks = (b: object) => ({ [SIGNATURE_FILE]: json({ version: 1, blocks: b }) });
    const base = blocks({ 'pantry-label': { page: 'pantry' }, 'vault-doc': { page: 'vault' } });
    expect(
      hits(
        base,
        blocks({ 'pantry-label': { page: 'lists' }, 'finance-card': { page: 'finance' } }),
      ),
    ).toEqual([
      `signature ${SIGNATURE_FILE} finance-card added`,
      `signature ${SIGNATURE_FILE} pantry-label changed`,
      `signature ${SIGNATURE_FILE} vault-doc removed`,
    ]);
    expect(hits({}, base)).toEqual([
      `signature ${SIGNATURE_FILE} pantry-label added`,
      `signature ${SIGNATURE_FILE} vault-doc added`,
    ]);
  });
});

describe('package.json scripts', () => {
  const pkg = (scripts: object, rest: object = {}) => ({
    'web/package.json': json({
      version: '1.0.0',
      scripts,
      dependencies: { zod: '^4.0.0' },
      ...rest,
    }),
  });
  const SCRIPTS = {
    'check:stimulus': 'node scripts/check-stimulus.mjs',
    'build:e2e-seed': 'vite build --mode e2e-seed --outDir dist-e2e-seed',
    'preview:e2e-seed': 'vite preview --outDir dist-e2e-seed --port 4174 --strictPort',
  };
  it('every changed, new or removed script is a hit', () => {
    expect(hits(pkg(SCRIPTS), pkg({ ...SCRIPTS, 'check:stimulus': 'true' }))).toEqual([
      'scripts check:stimulus "node scripts/check-stimulus.mjs"→"true"',
    ]);
    expect(
      hits(
        pkg(SCRIPTS),
        pkg({
          ...SCRIPTS,
          'build:e2e-seed': 'vite build --mode e2e --outDir dist-e2e-seed',
          extra: 'x',
        }),
      ),
    ).toEqual([
      'scripts build:e2e-seed "vite build --mode e2e-seed --outDir dist-e2e-seed"→"vite build --mode e2e --outDir dist-e2e-seed"',
      'scripts extra -→"x"',
    ]);
    const { 'preview:e2e-seed': _gone, ...fewer } = SCRIPTS;
    expect(hits(pkg(SCRIPTS), pkg(fewer))).toEqual([
      'scripts preview:e2e-seed "vite preview --outDir dist-e2e-seed --port 4174 --strictPort"→-',
    ]);
  });
  it('dependencies and version stay free (Dependabot, version bumps)', () => {
    expect(
      hits(pkg(SCRIPTS), pkg(SCRIPTS, { version: '1.1.0', dependencies: { zod: '^4.1.0' } })),
    ).toEqual([]);
  });
});

const SPEC = "import { test } from '@playwright/test';\n\ntest('a', async () => {\n  // …\n});\n";
const more = (text: string) => `${SPEC}\n${text}\n`;
const CASE = "test('b', async ({ page }) => {\n  await page.goto('/');\n});";

describe('protected paths', () => {
  const a11y = 'web/e2e/a11y.spec.ts';
  it('a change of an existing protected file is a hit with both blob ids', () => {
    const changed = SPEC.replace("'a'", "'changed'");
    expect(hits({ [a11y]: SPEC }, { [a11y]: changed })).toEqual([
      `protected ${a11y} ${blob(SPEC)}→${blob(changed)}`,
    ]);
    expect(hits({ [a11y]: SPEC }, {})).toEqual([`protected ${a11y} ${blob(SPEC)}→-`]);
  });
  it('the script itself, workflows, configs and the smoke list are protected', () => {
    for (const path of [
      'web/scripts/ratchet.mjs',
      'web/scripts/ratchet.test.ts',
      '.github/workflows/ci.yml',
      '.github/actions/playwright-chromium/action.yml',
      'web/playwright.config.ts',
      'web/vitest.config.ts',
      'web/vite.config.ts',
      'web/eslint.config.js',
      'web/tsconfig.app.json',
      'web/.env.e2e-seed',
      'web/e2e/helpers.ts',
      'web/e2e/seed/helpers.ts',
      'web/e2e/screenshots/stimulus.spec.ts',
      'web/scripts/lib/stimulusBudget.ts',
      'web/scripts/lib/seedRows.test.ts',
      'web/scripts/check-stimulus.mjs',
      'web/src/ui/tokens.test.ts',
      'web/src/ui/a.contrast.test.ts',
      'web/src/core/ai/testing.ts',
    ])
      expect(hits({ [path]: 'a\n' }, { [path]: 'b\n' }), path).toEqual([
        `protected ${path} ${blob('a\n')}→${blob('b\n')}`,
      ]);
  });
  it('product code is never protected, not even when a protected test imports it', () => {
    const test = 'web/src/core/modules/registry.test.ts';
    const base = {
      [test]: "import { allManifests } from './registry';\n",
      'web/src/core/modules/registry.ts': 'export const allManifests = [];\n',
      'web/src/modules/finance/routes/FinancePage.tsx': 'a\n',
    };
    expect(
      hits(base, {
        ...base,
        'web/src/core/modules/registry.ts': 'export const allManifests = [1];\n',
        'web/src/modules/finance/routes/FinancePage.tsx': 'b\n',
      }),
    ).toEqual([]);
  });
  it('a helper under web/e2e or web/scripts that a protected file imports is protected too', () => {
    const base = {
      [a11y]: "import { open } from './axe-helpers';\n",
      'web/e2e/axe-helpers.ts': "import { deep } from './util/deep';\nexport const open = 1;\n",
      'web/e2e/util/deep.ts': 'export const deep = 1;\n',
      'web/e2e/unrelated.ts': 'export const x = 1;\n',
    };
    const head = {
      ...base,
      'web/e2e/util/deep.ts': 'export const deep = 2;\n',
      'web/e2e/unrelated.ts': 'export const x = 2;\n',
    };
    expect(hits(base, head)).toEqual([
      `protected web/e2e/util/deep.ts ${blob(base['web/e2e/util/deep.ts'])}→${blob(head['web/e2e/util/deep.ts'])}`,
    ]);
  });
  it('new files: free for new guards and tests, always a hit for workflows, configs and .env.e2e*', () => {
    expect(
      hits(
        {},
        {
          'web/e2e/seed/pages-content.seed.spec.ts': SPEC,
          'web/src/home/duplicates.test.ts': SPEC,
          'web/scripts/lib/maxWidth.test.ts': SPEC,
        },
      ),
    ).toEqual([]);
    expect(
      hits(
        {},
        {
          '.github/workflows/extra.yml': 'on: pull_request\n',
          '.github/actions/x/action.yml': 'name: x\n',
          'web/playwright.extra.config.ts': 'export default {};\n',
          'web/.env.e2e-other': 'A=1\n',
          'web/.env.local': 'A=1\n',
          'web/tsconfig.extra.json': '{}\n',
          'web/eslint.rules.de-de.js': 'export default {};\n',
        },
      ).map((h) => h.split(' ').slice(0, 2).join(' ')),
    ).toEqual([
      'protected .github/actions/x/action.yml',
      'protected .github/workflows/extra.yml',
      'protected web/.env.e2e-other',
      'protected web/.env.local',
      'protected web/eslint.rules.de-de.js',
      'protected web/playwright.extra.config.ts',
      'protected web/tsconfig.extra.json',
    ]);
  });
  it('a new skip, fixme, todo or only is a hit, also in a new guard file', () => {
    const path = 'web/e2e/seed/new.seed.spec.ts';
    expect(
      hits(
        {},
        { [path]: "test.skip('later', async () => {});\ntest.describe.only('x', () => {});\n" },
      ),
    ).toEqual([`skip ${path} test.describe.only x`, `skip ${path} test.skip later`]);
    expect(skipMarks("it.todo('a');\ntest.fixme();\nit.skipIf(ci)('b', () => {});")).toEqual([
      'it.todo a',
      'test.fixme (no title)',
      'it.skipIf (no title)',
    ]);
  });
  it('a new testIgnore or exclude entry is a hit', () => {
    const path = 'web/playwright.config.ts';
    const base = "export default { testIgnore: ['**/sync/**'] };\n";
    const head = "export default { testIgnore: ['**/sync/**', '**/a11y*'] };\n";
    expect(hits({ [path]: base }, { [path]: head })).toEqual([
      `ignore ${path} testIgnore '**/a11y*'`,
      `protected ${path} ${blob(base)}→${blob(head)}`,
    ]);
    expect(ignorePatterns('{ "exclude": ["a", "b"] }')).toEqual(['exclude "a"', 'exclude "b"']);
    expect(ignorePatterns('testIgnore: [...A, ...B],')).toEqual([
      'testIgnore ...A',
      'testIgnore ...B',
    ]);
  });
});

describe('additions only in protected test files', () => {
  const path = 'web/src/core/diagnostics/diagnostics.test.ts';
  const free = (head: string, p = path) => hits({ [p]: SPEC }, { [p]: head }).length === 0;
  it('plain test( / it( calls appended after the last line are free', () => {
    expect(free(more(CASE))).toBe(true);
    expect(
      free(more(`${CASE}\n\nit('c', () => {\n  expect(1 / 2).toBe(0.5); // a/b\n}, 10_000);`)),
    ).toBe(true);
    expect(
      free(
        more(
          "test(\n  'a long title',\n  async ({ page }: { page: Page }) => {\n    const re = /[/)]'/.test(`${'`'}`);\n  },\n);",
        ),
      ),
    ).toBe(true);
    expect(
      free(
        more(
          "it('uses a new symbol', async () => {\n  const { x } = await import('./x');\n  expect(x).toBe(1);\n});",
        ),
      ),
    ).toBe(true);
  });
  it.each([
    ['vi.mock', "vi.mock('./x');"],
    ['vi.mock inside a body (hoisted)', "it('m', () => {\n  vi.mock('./x');\n});"],
    ['beforeEach', 'beforeEach(() => {\n  reset();\n});'],
    ['test.use', 'test.use({ viewport: { width: 10, height: 10 } });'],
    ['vi.useFakeTimers', 'vi.useFakeTimers();'],
    ['top-level assignment', 'globalThis.fetch = () => Promise.reject();'],
    ['Object.defineProperty', "Object.defineProperty(window, 'x', { value: 1 });"],
    ['describe', "describe('x', () => {\n  vi.useFakeTimers();\n});"],
    ['test.describe', "test.describe('x', () => {});"],
    ['import', "import { x } from './x';"],
    ['test.skip', "test.skip('later', async () => {});"],
    ['test.only', "test.only('now', async () => {});"],
    ['it.each', "it.each([1])('n', () => {});"],
    ['computed title', 'test(setup(), async () => {});'],
    ['template title with code', 'test(`a ${setup()}`, async () => {});'],
    ['code in the arguments', "test('a', (setup(), async () => {}));"],
    ['default value in the parameters', "test('a', async (x = setup()) => {});"],
    ['options object', "test('a', { tag: '@x' }, async () => {});"],
    ['function reference', "test('a', handler);"],
    ['second statement on the closing line', `${CASE} vi.useFakeTimers();`],
    ['statement between two cases', `${CASE}\nsetup();\n${CASE}`],
    ['unbalanced', "test('a', async () => {\n  if (x) {\n});"],
    [
      'closing the call early behind a postfix operator',
      "test('a', () => { x++ / 2; }); evil(); test('b', () => { 1 / 1; });",
    ],
    [
      'closing the call early behind a line separator',
      "test('a', () => {\n  // note\u2028}); evil(); test('b', () => {\n});",
    ],
    ['regex after a closing bracket', "test('a', () => {\n  if (x) /a/.test(y);\n});"],
    [
      'nested regex class',
      "test('a', () => {\n  /[a[b]/]x'/v.test(s); }); evil(); test('b', () => { const q = '';\n});",
    ],
  ])('%s appended → hit', (_name, text) => {
    expect(free(more(text))).toBe(false);
    expect(onlyAppendedTests(text)).toBe(false);
  });
  it('a line added before the last base line, a changed or a deleted line is a hit', () => {
    expect(free(SPEC.replace('// …', `// …\n  await page.goto('/');`))).toBe(false);
    expect(free(`${CASE}\n${SPEC}`)).toBe(false);
    expect(free(SPEC.replace("test('a'", "test('A'") + CASE)).toBe(false);
    expect(free(SPEC.split('\n').slice(1).join('\n') + CASE)).toBe(false);
    expect(isAppendOnly(SPEC, SPEC)).toBe(false);
  });
  it('JSX in appended .tsx cases is read as JSX, and what cannot be read is a hit', () => {
    const tsx = 'web/src/layout/pageTitle.test.tsx';
    const ok =
      "it('renders', () => {\n  render(\n    <Shell title=\"don't\" on={() => go('/')}>\n      it's {name} <b>bold</b> <br />\n    </Shell>,\n  );\n  expect(a < b).toBe(true);\n});";
    expect(free(more(ok), tsx)).toBe(true);
    // In JSX text a backtick is text; read as JavaScript it would swallow the code behind it.
    const trick =
      "it('a', () => { render(<p>`</p>); }); evil(); it('b', () => { render(<p>`</p>);\n});";
    expect(free(more(trick), tsx)).toBe(false);
    expect(
      onlyAppendedTests('it(\'a\', () => {\n  render(<p title="\\" />);\n});', { jsx: true }),
    ).toBe(true);
    expect(onlyAppendedTests("it('a', () => {\n  f(<T,>(x: T) => x);\n});", { jsx: true })).toBe(
      false,
    );
  });
});

describe('hash and table', () => {
  it('one fixed line format per kind of hit', () => {
    const base: Files = {
      ...BASE_BUDGET,
      'web/scripts/baselines/own-h1.json': json({ count: 3 }),
      [SEED_ROWS_FILE]: json({ version: 1, scale: 'medium', rows: { notes_note: 12 } }),
      [SIGNATURE_FILE]: json({ version: 1, blocks: { 'vault-doc': { page: 'vault' } } }),
      'web/package.json': json({ scripts: { test: 'vitest run' } }),
      'web/playwright.config.ts': 'export default { testIgnore: [] };\n',
      'web/e2e/calm.spec.ts': SPEC,
    };
    const head: Files = {
      [BUDGET_FILE]: json({
        version: 2,
        tolerance: { percent: 20, px: 50 },
        pages: { 'd1920--finance': { ...PAGE, height: 950 }, 'd1920--new': PAGE },
      }),
      'web/scripts/baselines/own-h1.json': json({ count: 4 }),
      [SEED_ROWS_FILE]: json({ version: 1, scale: 'medium', rows: { notes_note: 10 } }),
      [SIGNATURE_FILE]: json({ version: 1, blocks: {} }),
      'web/package.json': json({ scripts: { test: 'true' } }),
      'web/playwright.config.ts': "export default { testIgnore: ['**/calm*'] };\n",
      'web/e2e/calm.spec.ts': `${SPEC}test.skip('later', async () => {});\n`,
    };
    const found = hits(base, head);
    const short = (h: string) => h.replace(/[0-9a-f]{40}/g, '<blob>');
    expect(found.map(short)).toEqual([
      'baseline web/scripts/baselines/own-h1.json ["count"] 3→4',
      `budget ${BUDGET_FILE} d1920--finance.height 900→950`,
      "ignore web/playwright.config.ts testIgnore '**/calm*'",
      `page-new ${BUDGET_FILE} d1920--new`,
      `page-removed ${BUDGET_FILE} p412--finance`,
      'protected web/e2e/calm.spec.ts <blob>→<blob>',
      'protected web/playwright.config.ts <blob>→<blob>',
      'scripts test "vitest run"→"true"',
      'seed-rows notes_note 12→10',
      `signature ${SIGNATURE_FILE} vault-doc removed`,
      'skip web/e2e/calm.spec.ts test.skip later',
      `tolerance ${BUDGET_FILE} {"percent":10,"px":50}→{"percent":20,"px":50}`,
      `version ${BUDGET_FILE} 1→2`,
    ]);
    expect(hashOf(found)).toBe(createHash('sha256').update(found.join('\n')).digest('hex'));
    expect(hashOf([...found].reverse())).toBe(hashOf(found));
    expect(hitTable(found)).toContain(
      '| budget | `web/e2e/stimulus-budget.json d1920--finance.height 900→950` |',
    );
    expect(hitTable([])).toMatch(/no hits/);
  });
  it('a second change of an approved file, or a new kind of hit, changes the hash', () => {
    const path = 'web/e2e/calm.spec.ts';
    const first = hits({ [path]: SPEC }, { [path]: `${SPEC}// one\n` });
    const second = hits({ [path]: SPEC }, { [path]: `${SPEC}// two\n` });
    expect(hashOf(second)).not.toBe(hashOf(first));
    expect(hashOf([...first, 'scripts test "a"→"b"'])).not.toBe(hashOf(first));
    expect(hashOf([])).toBe(createHash('sha256').update('').digest('hex'));
  });
});

// A key pair that lives only in this test run.
const pair = generateKeyPairSync('ed25519');
const PUBLIC_PEM = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const signed = (message: string, key = pair.privateKey) =>
  sign(null, Buffer.from(message), key).toString('base64');
const HASH = 'ab'.repeat(32);
const approval = (pr: number, hash: string, key = pair.privateKey) =>
  `${approvalMessage(pr, hash)} ${signed(approvalMessage(pr, hash), key)}`;

describe('approval signature', () => {
  const key = loadPublicKey(PUBLIC_PEM);
  const check = (body: string, pr = 7, hash = HASH) => isApproval(body, { pr, hash, key });
  it('the committed key is a constant in the script, and no key means no approval', () => {
    expect(typeof RATCHET_PUBLIC_KEY).toBe('string');
    expect(loadPublicKey('')).toBeNull();
    expect(isApproval(approval(7, HASH), { pr: 7, hash: HASH, key: null })).toBe(false);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
    expect(() => loadPublicKey(rsa.export({ type: 'spki', format: 'pem' }).toString())).toThrow(
      /Ed25519/,
    );
  });
  it('accepts the PEM and the bare base64 line of `openssl pkey -pubout`', () => {
    const line = PUBLIC_PEM.split('\n')[1]!;
    expect(isApproval(approval(7, HASH), { pr: 7, hash: HASH, key: loadPublicKey(line) })).toBe(
      true,
    );
  });
  it('a comment that is exactly message + signature is an approval', () => {
    expect(approvalMessage(7, HASH)).toBe(
      `stimulus-raise SGNemo/schweizer-taschenmesser#7 ${HASH}`,
    );
    expect(check(approval(7, HASH))).toBe(true);
    expect(check(`${approval(7, HASH)}\n`)).toBe(true);
  });
  it('wrong key, edited hash, other pull request, other repository, no signature: no approval', () => {
    const other = generateKeyPairSync('ed25519').privateKey;
    expect(check(approval(7, HASH, other))).toBe(false);
    const edited = approval(7, HASH).replace(HASH, 'cd'.repeat(32));
    expect(check(edited)).toBe(false);
    expect(check(edited, 7, 'cd'.repeat(32))).toBe(false);
    // Copied from another pull request with the same hit table.
    expect(check(approval(8, HASH))).toBe(false);
    expect(check(approval(8, HASH).replace('#8', '#7'))).toBe(false);
    const fork = `stimulus-raise other/repo#7 ${HASH}`;
    expect(check(`${fork} ${signed(fork)}`)).toBe(false);
    expect(check(approvalMessage(7, HASH))).toBe(false);
    expect(check(`${approvalMessage(7, HASH)} ${'A'.repeat(86)}==`)).toBe(false);
  });
  it('the line as part of a longer text is no approval', () => {
    expect(check(`Freigabe:\n${approval(7, HASH)}`)).toBe(false);
    expect(check(`${approval(7, HASH)} ok`)).toBe(false);
    expect(check(`> ${approval(7, HASH)}`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Real history: merge base, CI mode, merge rule with recorded API answers.
// ---------------------------------------------------------------------------------------------------------

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
  dirs.push(root);
  const origin = join(root, 'origin');
  mkdirSync(origin);
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.invalid',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        ...args,
      ],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  const commit = (files: Record<string, string | null>, message: string) => {
    for (const [path, text] of Object.entries(files)) {
      const full = join(origin, path);
      if (text === null) rmSync(full);
      else {
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
      }
    }
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '--allow-empty', '-m', message);
    return git(origin, 'rev-parse', 'HEAD');
  };
  git(origin, 'init', '-q', '-b', 'develop');
  git(origin, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
  commit(
    {
      [BUDGET_FILE]: budget({ 'd1920--finance': PAGE }),
      'web/e2e/a11y.spec.ts': SPEC,
      'web/e2e/calm.spec.ts': SPEC,
      'web/src/modules/finance/routes/FinancePage.tsx': 'export const a = 1;\n',
    },
    'base',
  );
  /** A worktree as the merge agent has it: a clone that knows nothing but `develop` at clone time. */
  const clone = () => {
    const work = join(root, `work-${dirs.length}-${Math.random().toString(36).slice(2)}`);
    git(root, 'clone', '-q', origin, work);
    return work;
  };
  return { origin, git, commit, clone };
}

describe('merge base (real history)', () => {
  it('what develop changed since the branch point is no hit of the pull request', () => {
    const s = sandbox();
    s.git(s.origin, 'checkout', '-q', '-b', 'feat');
    const head = s.commit(
      { 'web/src/modules/finance/routes/FinancePage.tsx': 'export const a = 2;\n' },
      'feat',
    );
    s.git(s.origin, 'checkout', '-q', 'develop');
    // Another package lowers the budget and changes a protected file on develop.
    const tip = s.commit(
      {
        [BUDGET_FILE]: budget({ 'd1920--finance': { ...PAGE, buttons: 10 } }),
        'web/e2e/a11y.spec.ts': `${SPEC}// x\n`,
      },
      'develop moves',
    );
    const repo = gitRepo(s.origin);
    // Against the tip the lowered budget would read as a raise by the pull request.
    expect(collectHits(repo, tip, head).length).toBeGreaterThan(0);
    const base = repo.mergeBase(tip, head);
    expect(collectHits(repo, base, head)).toEqual([]);
  });
  it('paths are those of the repository root, wherever the script is started (CI runs it in web/)', () => {
    const s = sandbox();
    const base = s.git(s.origin, 'rev-parse', 'HEAD');
    const head = s.commit(
      { [BUDGET_FILE]: budget({ 'd1920--finance': { ...PAGE, buttons: 25 } }) },
      'raise',
    );
    expect(collectHits(gitRepo(join(s.origin, 'web')), base, head)).toEqual([
      `budget ${BUDGET_FILE} d1920--finance.buttons 20→25`,
    ]);
  });
  it('git view: added, changed, deleted and renamed files', () => {
    const s = sandbox();
    const base = s.git(s.origin, 'rev-parse', 'HEAD');
    s.git(s.origin, 'mv', 'web/e2e/calm.spec.ts', 'web/e2e/calm2.spec.ts');
    const head = s.commit(
      { 'web/e2e/a11y.spec.ts': null, '.github/workflows/x.yml': 'on: push\n' },
      'change',
    );
    expect(
      collectHits(gitRepo(s.origin), base, head).map((h: string) =>
        h.replace(/[0-9a-f]{40}/g, '<blob>'),
      ),
    ).toEqual([
      'protected .github/workflows/x.yml -→<blob>',
      'protected web/e2e/a11y.spec.ts <blob>→-',
      'protected web/e2e/calm.spec.ts <blob>→-',
    ]);
  });
});

interface Recorded {
  pull: object;
  comments?: object[];
  labels?: object[];
  runs?: object[];
  checks?: object[];
  fail?: RegExp;
}
/** GitHub answers as recorded from the REST API (only the fields the script reads), keyed by path. */
function recorded(r: Recorded) {
  const calls: string[] = [];
  const fetchImpl = async (url: string | URL, init?: { headers?: Record<string, string> }) => {
    const u = new URL(String(url));
    calls.push(`${u.pathname}${u.search}`);
    expect(u.origin).toBe('https://api.github.com');
    expect(init?.headers?.authorization).toBe('Bearer placeholder-token');
    const page = u.searchParams.get('page');
    const body = r.fail?.test(u.pathname)
      ? null
      : /\/pulls\/\d+$/.test(u.pathname)
        ? r.pull
        : /\/issues\/\d+\/comments$/.test(u.pathname)
          ? page === '1'
            ? (r.comments ?? [])
            : []
          : /\/issues\/\d+\/labels$/.test(u.pathname)
            ? (r.labels ?? [])
            : /\/actions\/runs$/.test(u.pathname)
              ? {
                  total_count: r.runs?.length ?? 0,
                  workflow_runs: page === '1' ? (r.runs ?? []) : [],
                }
              : /\/check-runs$/.test(u.pathname)
                ? {
                    total_count: r.checks?.length ?? 0,
                    check_runs: page === '1' ? (r.checks ?? []) : [],
                  }
                : null;
    return { ok: body !== null, status: body === null ? 500 : 200, json: async () => body };
  };
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}
const pullOf = (head: string, extra: object = {}) => ({
  number: 7,
  state: 'open',
  merged: false,
  head: { sha: head, ref: 'feat' },
  base: { ref: 'develop', sha: 'f'.repeat(40) },
  ...extra,
});
const runOf = (head: string, extra: object = {}) => ({
  id: 9001,
  run_number: 41,
  event: 'pull_request',
  path: '.github/workflows/ci.yml',
  head_sha: head,
  check_suite_id: 501,
  pull_requests: [{ number: 7 }],
  ...extra,
});
const checkOf = (extra: object = {}) => ({
  name: WEB_CHECK,
  status: 'completed',
  conclusion: 'success',
  app: { slug: 'github-actions' },
  check_suite: { id: 501 },
  ...extra,
});
const ENV = { GITHUB_TOKEN: 'placeholder-token' };

describe('--pr (merge rule) with recorded API answers', () => {
  /** A pull request `feat` (#7) on the origin; `raise` puts a hit into it. */
  function pullRequest(raise: boolean) {
    const s = sandbox();
    s.git(s.origin, 'checkout', '-q', '-b', 'feat');
    const head = s.commit(
      raise
        ? { [BUDGET_FILE]: budget({ 'd1920--finance': { ...PAGE, buttons: 25 } }) }
        : { 'web/src/modules/finance/routes/FinancePage.tsx': 'export const a = 2;\n' },
      'feat',
    );
    s.git(s.origin, 'update-ref', 'refs/pull/7/head', head);
    s.git(s.origin, 'checkout', '-q', 'develop');
    return { ...s, head };
  }
  async function run(work: string, r: Recorded, opts: { head?: string; publicKey?: string } = {}) {
    const lines: string[] = [];
    const api = recorded(r);
    const code = await runPr({
      pr: 7,
      head: opts.head,
      repo: gitRepo(work),
      env: ENV,
      fetchImpl: api.fetchImpl,
      publicKey: opts.publicKey ?? PUBLIC_PEM,
      out: (line: string) => lines.push(line),
    });
    return { code, text: lines.join('\n'), calls: api.calls };
  }
  const green = (head: string) => ({ runs: [runOf(head)], checks: [checkOf()] });
  const hashIn = (text: string) => /Hash: ([0-9a-f]{64})/.exec(text)![1]!;

  it('no hits and a green Web check: mergeable without any approval', async () => {
    const p = pullRequest(false);
    const r = await run(p.clone(), { pull: pullOf(p.head), ...green(p.head) }, { head: p.head });
    expect(r.text).toMatch(/no hits/);
    expect(r.code).toBe(0);
    // Commit statuses are never read: a foreign workflow that sets one changes nothing.
    expect(r.calls.some((c) => /status/.test(c))).toBe(false);
    expect(r.calls.find((c) => c.includes('check-runs'))).toContain('filter=latest');
  });
  it('hits without a comment: not mergeable, prints hash, message and the openssl command', async () => {
    const p = pullRequest(true);
    const r = await run(p.clone(), { pull: pullOf(p.head), ...green(p.head) }, { head: p.head });
    expect(r.code).toBe(1);
    expect(r.text).toContain(`budget ${BUDGET_FILE} d1920--finance.buttons 20→25`);
    const hash = hashIn(r.text);
    expect(r.text).toContain(`Message: stimulus-raise ${REPO}#7 ${hash}`);
    expect(r.text).toMatch(/openssl pkeyutl -sign -rawin -inkey ~\/\.nemo\/ratchet\.pem/);
    expect(hash).toBe(hashOf([`budget ${BUDGET_FILE} d1920--finance.buttons 20→25`]));
  });
  it('the hash is the one the CI mode sees for merge base → head', async () => {
    const p = pullRequest(true);
    const work = p.clone();
    const r = await run(work, { pull: pullOf(p.head), ...green(p.head) });
    const repo = gitRepo(work);
    const lines: string[] = [];
    const code = await runCi({
      base: repo.mergeBase('origin/develop', p.head),
      head: p.head,
      repo,
      env: { ...ENV, PR_NUMBER: '7' },
      fetchImpl: recorded({ pull: {}, labels: [] }).fetchImpl,
      out: (l: string) => lines.push(l),
    });
    expect(code).toBe(1);
    expect(hashOf(collectHits(repo, repo.mergeBase('origin/develop', p.head), p.head))).toBe(
      hashIn(r.text),
    );
  });
  it('a validly signed comment for this hash: mergeable, wherever it stands among the comments', async () => {
    const p = pullRequest(true);
    const work = p.clone();
    const hash = hashIn((await run(work, { pull: pullOf(p.head), ...green(p.head) })).text);
    const comments = [
      { body: 'LGTM', user: { login: 'SGNemo' } },
      { body: approval(7, hash), user: { login: 'someone-else' } },
      { body: approval(7, 'cd'.repeat(32)), user: { login: 'SGNemo' } }, // an older approval posted again
    ];
    const r = await run(
      work,
      { pull: pullOf(p.head), comments, ...green(p.head) },
      { head: p.head },
    );
    expect(r.code).toBe(0);
    expect(r.text).toMatch(/Mergeable/);
  });
  it('unsigned, wrongly signed, edited or embedded comments: not mergeable', async () => {
    const p = pullRequest(true);
    const work = p.clone();
    const hash = hashIn((await run(work, { pull: pullOf(p.head), ...green(p.head) })).text);
    const other = generateKeyPairSync('ed25519').privateKey;
    for (const body of [
      `stimulus-raise ${REPO}#7 ${hash}`, // the maintainer's token, but no signature
      approval(7, hash, other),
      approval(7, 'cd'.repeat(32)).replace('cd'.repeat(32), hash), // hash edited afterwards
      `ok:\n${approval(7, hash)}`,
      approval(8, hash),
    ]) {
      const r = await run(
        work,
        { pull: pullOf(p.head), comments: [{ body, user: { login: 'SGNemo' } }], ...green(p.head) },
        { head: p.head },
      );
      expect(r.code, body).toBe(1);
    }
  });
  it('without a public key nothing is mergeable (fail closed), the hash is still printed', async () => {
    const p = pullRequest(true);
    const work = p.clone();
    const first = await run(work, { pull: pullOf(p.head), ...green(p.head) });
    const comments = [{ body: approval(7, hashIn(first.text)) }];
    const r = await run(
      work,
      { pull: pullOf(p.head), comments, ...green(p.head) },
      { publicKey: '' },
    );
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/RATCHET_PUBLIC_KEY is empty/);
    expect(r.text).toMatch(/Hash: [0-9a-f]{64}/);
    const clean = pullRequest(false);
    expect(
      (
        await run(
          clean.clone(),
          { pull: pullOf(clean.head), ...green(clean.head) },
          { publicKey: '' },
        )
      ).code,
    ).toBe(1);
    expect(
      (
        await run(
          work,
          { pull: pullOf(p.head), comments, ...green(p.head) },
          { publicKey: 'not a key' },
        )
      ).code,
    ).toBe(1);
  });
  it('a push that keeps the hits (develop merged in) keeps the approval; new hits need a new one', async () => {
    const p = pullRequest(true);
    const work = p.clone();
    const hash = hashIn((await run(work, { pull: pullOf(p.head), ...green(p.head) })).text);
    const comments = [{ body: approval(7, hash) }];
    // develop moves in files the pull request does not touch, then is merged into the branch.
    p.commit(
      { 'web/src/modules/finance/routes/FinancePage.tsx': 'export const a = 3;\n' },
      'develop moves',
    );
    p.git(p.origin, 'checkout', '-q', 'feat');
    p.git(p.origin, 'merge', '-q', '--no-ff', '-m', 'merge develop', 'develop');
    const merged = p.git(p.origin, 'rev-parse', 'HEAD');
    const kept = await run(
      work,
      { pull: pullOf(merged), comments, ...green(merged) },
      { head: merged },
    );
    expect(hashIn(kept.text)).toBe(hash);
    expect(kept.code).toBe(0);
    // A second push onto the approved file, and a new kind of hit.
    const pushed = p.commit(
      {
        [BUDGET_FILE]: budget({ 'd1920--finance': { ...PAGE, buttons: 30 } }),
        'web/e2e/calm.spec.ts': `${SPEC}// x\n`,
      },
      'more',
    );
    p.git(p.origin, 'checkout', '-q', 'develop');
    const again = await run(
      work,
      { pull: pullOf(pushed), comments, ...green(pushed) },
      { head: pushed },
    );
    expect(hashIn(again.text)).not.toBe(hash);
    expect(again.code).toBe(1);
  });
  it('live head differs from --head: not mergeable', async () => {
    const p = pullRequest(false);
    const r = await run(
      p.clone(),
      { pull: pullOf(p.head), ...green(p.head) },
      { head: 'a'.repeat(40) },
    );
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/live head .* is not --head/);
  });
  it('a closed or merged pull request is not mergeable', async () => {
    const p = pullRequest(false);
    const r = await run(p.clone(), {
      pull: pullOf(p.head, { state: 'closed', merged: true }),
      ...green(p.head),
    });
    expect(r.code).toBe(1);
  });
  it('the Web check must be the green one of the pull_request run of ci.yml on this head', async () => {
    const p = pullRequest(false);
    const work = p.clone();
    const pull = pullOf(p.head);
    const code = async (r: Omit<Recorded, 'pull'>) =>
      (await run(work, { pull, ...r }, { head: p.head })).code;
    // [skip ci]: no run at all.
    expect(await code({ runs: [], checks: [] })).toBe(1);
    expect(await code({ runs: [runOf(p.head)], checks: [] })).toBe(1);
    expect(
      await code({ runs: [runOf(p.head)], checks: [checkOf({ conclusion: 'failure' })] }),
    ).toBe(1);
    expect(
      await code({
        runs: [runOf(p.head)],
        checks: [checkOf({ status: 'in_progress', conclusion: null })],
      }),
    ).toBe(1);
    expect(
      await code({ runs: [runOf(p.head)], checks: [checkOf({ conclusion: 'skipped' })] }),
    ).toBe(1);
    // Re-run after the label: `filter=latest` hands out the green second attempt only.
    expect(await code({ runs: [runOf(p.head)], checks: [checkOf()] })).toBe(0);
    // A full-ci dispatch (workflow_dispatch) is not the pull_request run, however green it is.
    const dispatch = runOf(p.head, { event: 'workflow_dispatch', check_suite_id: 777 });
    expect(await code({ runs: [dispatch], checks: [checkOf({ check_suite: { id: 777 } })] })).toBe(
      1,
    );
    // Another workflow, another app, another head, another pull request: none of them counts.
    expect(
      await code({
        runs: [runOf(p.head, { path: '.github/workflows/other.yml' })],
        checks: [checkOf()],
      }),
    ).toBe(1);
    expect(
      await code({ runs: [runOf(p.head)], checks: [checkOf({ app: { slug: 'some-app' } })] }),
    ).toBe(1);
    expect(await code({ runs: [runOf('b'.repeat(40))], checks: [checkOf()] })).toBe(1);
    expect(
      await code({
        runs: [runOf(p.head, { pull_requests: [{ number: 8 }] })],
        checks: [checkOf()],
      }),
    ).toBe(1);
    // An older green run does not cover a newer red one on the same head.
    const older = runOf(p.head, { id: 9000, run_number: 40, check_suite_id: 500 });
    expect(
      await code({
        runs: [older, runOf(p.head)],
        checks: [checkOf({ check_suite: { id: 500 } }), checkOf({ conclusion: 'failure' })],
      }),
    ).toBe(1);
  });
  it('a green full-ci dispatch does not replace the signature', async () => {
    const p = pullRequest(true);
    const dispatch = runOf(p.head, {
      id: 9100,
      run_number: 42,
      event: 'workflow_dispatch',
      check_suite_id: 777,
    });
    const r = await run(p.clone(), {
      pull: pullOf(p.head),
      runs: [runOf(p.head), dispatch],
      checks: [checkOf(), checkOf({ check_suite: { id: 777 } })],
    });
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/without a validly signed approval/);
  });
  it('an API error or a head that cannot be fetched ends with exit 2, never 0', async () => {
    const p = pullRequest(false);
    const work = p.clone();
    const lines: string[] = [];
    const deps = (r: Recorded) => ({
      repo: gitRepo(work),
      env: ENV,
      fetchImpl: recorded(r).fetchImpl,
      publicKey: PUBLIC_PEM,
      out: (l: string) => lines.push(l),
    });
    expect(
      await cli(
        ['--pr', '7'],
        deps({ pull: pullOf(p.head), ...green(p.head), fail: /check-runs/ }),
      ),
    ).toBe(2);
    expect(
      await cli(['--pr', '7'], deps({ pull: pullOf('c'.repeat(40)), ...green('c'.repeat(40)) })),
    ).toBe(2);
    expect(
      await cli(['--pr', '7', '--head', p.head], deps({ pull: pullOf(p.head), ...green(p.head) })),
    ).toBe(0);
    expect(await cli(['--pr', 'x'], deps({ pull: {} }))).toBe(2);
  });
});

describe('--base --head (CI feedback)', () => {
  function history(raise: boolean) {
    const s = sandbox();
    const base = s.git(s.origin, 'rev-parse', 'HEAD');
    const head = s.commit(
      raise
        ? { [BUDGET_FILE]: budget({ 'd1920--finance': { ...PAGE, buttons: 25 } }) }
        : { [BUDGET_FILE]: budget({ 'd1920--finance': { ...PAGE, buttons: 5 } }) },
      'change',
    );
    return { repo: gitRepo(s.origin), base, head, root: dirname(s.origin) };
  }
  const ci = async (
    h: ReturnType<typeof history>,
    r: Partial<Recorded>,
    env: object = { PR_NUMBER: '7' },
  ) => {
    const api = recorded({ pull: {}, ...r });
    const lines: string[] = [];
    const summary = join(h.root, 'summary.md');
    writeFileSync(summary, '');
    const code = await runCi({
      base: h.base,
      head: h.head,
      repo: h.repo,
      env: { ...ENV, GITHUB_STEP_SUMMARY: summary, GITHUB_REPOSITORY: REPO, ...env },
      fetchImpl: api.fetchImpl,
      out: (l: string) => lines.push(l),
    });
    return { code, calls: api.calls, text: lines.join('\n'), summary };
  };
  it('no hits: green without the label and without asking GitHub', async () => {
    const r = await ci(history(false), {});
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });
  it('hits are red, the table goes into the job summary', async () => {
    const r = await ci(history(true), { labels: [{ name: 'no-changelog' }] });
    expect(r.code).toBe(1);
    expect(r.calls[0]).toContain(`/repos/${REPO}/issues/7/labels`);
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(r.summary, 'utf8')).toContain(
      '| budget | `web/e2e/stimulus-budget.json d1920--finance.buttons 20→25` |',
    );
  });
  it('hits with the label on the pull request right now: green', async () => {
    const r = await ci(history(true), {
      labels: [{ name: 'no-changelog' }, { name: 'stimulus-raise' }],
    });
    expect(r.code).toBe(0);
  });
  it('hits stay red when the label cannot be read', async () => {
    expect((await ci(history(true), { fail: /labels/ })).code).toBe(1);
    expect(
      (await ci(history(true), { labels: [{ name: 'stimulus-raise' }] }, { PR_NUMBER: '' })).code,
    ).toBe(1);
  });
  it('arguments', () => {
    expect(parseArgs(['--base', 'a', '--head', 'b'])).toEqual({ base: 'a', head: 'b' });
    expect(parseArgs(['--pr', '12', '--head', 'b'])).toEqual({ pr: 12, head: 'b' });
    expect(() => parseArgs(['--base', 'a'])).toThrow(/usage/);
    expect(() => parseArgs(['--pr', '1', '--base', 'a'])).toThrow(/usage/);
    expect(() => parseArgs(['--label'])).toThrow(/unknown/);
  });
});

describe('the script stands alone', () => {
  it('imports nothing but node:* (it runs as a copy from /tmp)', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./ratchet.mjs', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gms)].map((m) => m[1]!);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((i) => !i.startsWith('node:'))).toEqual([]);
    expect(source).not.toMatch(/\bimport\s*\(|\brequire\s*\(/);
    // No private key is ever read, created or used by the script.
    expect(source).not.toMatch(/createPrivateKey|generateKeyPair|\bsign\s*\(|readFileSync/);
  });
});
