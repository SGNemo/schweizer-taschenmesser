#!/usr/bin/env node
/**
 * Stimulus ratchet (UI audit 2026-11, package 0a-1a; policy and Sven's steps: docs/howto/ci.md).
 *
 * One file, `node:*` imports only, every function exported: the merge rule runs a copy of the `develop`
 * version from /tmp (`git show origin/develop:web/scripts/ratchet.mjs > /tmp/ratchet.mjs`), so nothing here
 * may depend on another file of the repository. Everything is read with `git show` / `git ls-tree`; no file
 * of the pull request is ever executed. No private key is read, created or used here: signing is done by the
 * maintainer with `openssl` only.
 *
 *   node scripts/ratchet.mjs --base <sha> --head <sha>
 *     CI feedback (job "Stimulus budget"): semantic comparison base → head, hit table into the job summary.
 *     Hits are red unless the label `stimulus-raise` is on the pull request right now (GITHUB_TOKEN, PR_NUMBER).
 *     Feedback only: in CI this script comes from the pull request itself.
 *
 *   node /tmp/ratchet.mjs --pr <n> [--head <sha>]
 *     Merge rule (trust root, run from `develop`): reads the pull request over REST, fetches its head, compares
 *     merge base → head, prints the hit table, its hash, the message to sign and the `openssl` command.
 *     Exit 0 only if the live head equals `--head` (when given), the check run "Web (lint, types, unit, E2E)"
 *     of the `pull_request` run of ci.yml on that head succeeded, and there are no hits or a comment
 *     `stimulus-raise SGNemo/schweizer-taschenmesser#<n> <hash> <signature>` carries a valid Ed25519 signature
 *     of RATCHET_PUBLIC_KEY over `stimulus-raise SGNemo/schweizer-taschenmesser#<n> <hash>`. Anything unclear
 *     (no key, no network, unreadable history) ends with exit ≠ 0.
 */
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REPO = 'SGNemo/schweizer-taschenmesser';
/**
 * The maintainer's Ed25519 public key: the output of `openssl pkey -in ~/.nemo/ratchet.pem -pubout` (PEM) or
 * only its base64 line. Empty = no approval can be valid, `--pr` always fails. Changing it is a hit like any
 * other change of this file; that one pull request is merged by the maintainer himself (docs/howto/ci.md).
 */
export const RATCHET_PUBLIC_KEY = '';
export const LABEL = 'stimulus-raise';
export const WEB_CHECK = 'Web (lint, types, unit, E2E)';
export const CI_WORKFLOW = '.github/workflows/ci.yml';
const API = 'https://api.github.com';

export const BUDGET_FILE = 'web/e2e/stimulus-budget.json';
export const BASELINE_DIR = 'web/scripts/baselines/';
export const SEED_ROWS_FILE = 'web/scripts/baselines/seed-rows.json';
export const SIGNATURE_FILE = 'web/scripts/baselines/signature-blocks.json';
export const PACKAGE_FILE = 'web/package.json';

/** New files here always count: they change what CI runs and what the guard builds show. */
export const ALWAYS_PROTECTED = [
  '.github/workflows/**',
  '.github/actions/**',
  'web/*.config.*',
  'web/.env.e2e*',
];

const E2E_PROMISES = [
  'calm',
  'hide-values',
  'a11y',
  'touch-hit-phone',
  'mobile-layout',
  'readability',
  'identity',
  'hue-consistency',
  'library-identity',
  'overview-head',
  'layout',
  'shell',
];
const UNIT_PROMISES = [
  'ui/tokens.test.ts',
  'ui/identity/identity.test.tsx',
  'ui/noStripes.test.ts',
  'ui/semantics.test.ts',
  'core/modules/registry.test.ts',
  'core/modules/widgets.test.tsx',
  'ui/widgets/widgets.test.tsx',
  'modules/accounts/__tests__/exclusion.test.ts',
  'core/ai/privacy.test.ts',
  'router.test.tsx',
  'home/AttentionStrip.test.tsx',
  'core/diagnostics/diagnostics.test.ts',
  'core/setup/detect.test.ts',
  'modules/vault/__tests__/palette.test.ts',
  'layout/pageTitle.test.tsx',
];
const TOOL_LOGIC = [
  'checkIdentity',
  'checkModules',
  'stimulusBudget',
  'maxWidth',
  'groupedList',
  'ownH1',
  'motionSource',
];
const TOOL_TESTS = [...TOOL_LOGIC, 'seedRows'];

/**
 * Protected paths: every change or deletion of an existing file is a hit; a new file is a hit too, except
 * under NEW_FILES_FREE (new guards and tests arrive without an approval) and never except under ALWAYS_PROTECTED.
 */
export const PROTECTED = [
  ...ALWAYS_PROTECTED,
  'web/vitest.setup.ts',
  'web/tsconfig*.json',
  'web/eslint.*',
  'web/scripts/check.mjs',
  'web/scripts/check-modules.mjs',
  'web/scripts/check-stimulus.mjs',
  'web/scripts/ratchet.mjs',
  'web/scripts/ratchet.test.ts',
  ...TOOL_LOGIC.map((n) => `web/scripts/lib/${n}.ts`),
  ...TOOL_TESTS.map((n) => `web/scripts/lib/${n}.test.ts`),
  'web/e2e/helpers.ts',
  'web/e2e/seed/**',
  'web/e2e/screenshots/stimulus.spec.ts',
  'web/src/**/*.contrast.test.ts',
  ...E2E_PROMISES.map((n) => `web/e2e/${n}.spec.ts`),
  ...UNIT_PROMISES.map((n) => `web/src/${n}`),
  // Test helpers a protected test imports (they import no product code of their own).
  'web/src/core/ai/testing.ts',
  'web/src/test-utils.ts',
];
export const NEW_FILES_FREE = [
  'web/e2e/seed/**',
  'web/src/**/*.test.*',
  'web/scripts/lib/*.test.ts',
];

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      out += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') out += '[^/]*';
    else out += /[.+?^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${out}$`);
}
const compiled = new Map();
export function matchesAny(path, globs) {
  for (const g of globs) {
    let re = compiled.get(g);
    if (!re) compiled.set(g, (re = globToRegExp(g)));
    if (re.test(path)) return true;
  }
  return false;
}

/** Stable JSON text: object keys sorted, no whitespace. `undefined` (absent) prints as `-`. */
export function canon(value) {
  if (value === undefined) return '-';
  const sort = (v) =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort(v[k])]),
          )
        : v;
  return JSON.stringify(sort(value));
}
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const parseJson = (text) => {
  if (text === null || text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return null; // unreadable: callers treat it as a hit
  }
};
const isTestFile = (path) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
const isCode = (path) => /\.[cm]?[jt]sx?$/.test(path);

// ---------------------------------------------------------------------------------------------------------
// Comparisons (pure: text in, hit lines out). Line formats are fixed: the approval hash is taken over them.
// ---------------------------------------------------------------------------------------------------------

/** Route paths a manifest declares (`path: '/finance'`). */
export function manifestRoutes(text) {
  const out = new Set();
  if (!text) return out;
  for (const m of text.matchAll(/\bpath:\s*(['"`])([^'"`]+)\1/g)) out.add(m[2]);
  return out;
}
/** `/disk/scan` → `disk-scan`: the page name a route gets in the budget (`<viewport>--<name>`). */
export const routeSlug = (route) =>
  route
    .replace(/^\/+/, '')
    .replace(/[/:?=&]+/g, '-')
    .replace(/-+$/, '');

/**
 * `web/e2e/stimulus-budget.json`: red on a raised value, raised tolerance, changed version, removed page or
 * metric, and on a new page unless this pull request adds its route to a `modules/<id>/manifest.ts`
 * (`newRouteSlugs`). Lowering is free; a new metric key is free (a changed `version` is a hit of its own).
 */
export function budgetHits(path, baseText, headText, newRouteSlugs = new Set()) {
  const hits = [];
  const base = parseJson(baseText);
  const head = parseJson(headText);
  if (base === undefined && head === undefined) return hits;
  if (head === null || (head !== undefined && !isObject(head)))
    return [`version ${path} ${canon(base?.version)}→unreadable`];
  const b = isObject(base) ? base : { pages: {} };
  const h = head ?? { pages: {} };
  if (base !== undefined && canon(b.version) !== canon(h.version))
    hits.push(`version ${path} ${canon(b.version)}→${canon(h.version)}`);
  if (base !== undefined && toleranceRaised(b.tolerance, h.tolerance))
    hits.push(`tolerance ${path} ${canon(b.tolerance)}→${canon(h.tolerance)}`);
  const bp = isObject(b.pages) ? b.pages : {};
  const hp = isObject(h.pages) ? h.pages : {};
  for (const key of Object.keys(bp)) {
    if (!(key in hp)) {
      hits.push(`page-removed ${path} ${key}`);
      continue;
    }
    const was = isObject(bp[key]) ? bp[key] : {};
    const now = isObject(hp[key]) ? hp[key] : {};
    for (const metric of new Set([...Object.keys(was), ...Object.keys(now)])) {
      const o = was[metric];
      const n = now[metric];
      if (o === undefined) {
        if (typeof n !== 'number') hits.push(`budget ${path} ${key}.${metric} -→${canon(n)}`);
        continue; // a new metric key is free
      }
      if (typeof o !== 'number' || typeof n !== 'number' || n > o)
        if (canon(o) !== canon(n))
          hits.push(`budget ${path} ${key}.${metric} ${canon(o)}→${canon(n)}`);
    }
  }
  for (const key of Object.keys(hp)) {
    if (key in bp) continue;
    const name = key.slice(key.indexOf('--') + 2);
    if (!newRouteSlugs.has(name)) hits.push(`page-new ${path} ${key}`);
  }
  return hits;
}
function toleranceRaised(was, now) {
  if (canon(was) === canon(now)) return false;
  if (!isObject(was) || !isObject(now)) return true;
  for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const o = was[k];
    const n = now[k];
    if (isObject(o) || isObject(n)) {
      if (toleranceRaised(o, n)) return true;
    } else if (typeof o !== 'number' || typeof n !== 'number' || n > o) return true;
  }
  return false;
}

/** Flat view of a baseline: numbers and scalars by key path, array elements as a set per path. */
function leaves(value, path = [], out = new Map()) {
  if (Array.isArray(value)) {
    for (const el of value) out.set(`${JSON.stringify([...path, '[]'])}=${canon(el)}`, { el });
  } else if (isObject(value)) {
    for (const k of Object.keys(value)) leaves(value[k], [...path, k], out);
  } else out.set(JSON.stringify(path), { value });
  return out;
}
/**
 * Any other `web/scripts/baselines/*.json`: red on a raised number, a new key in an existing file, a changed
 * text and a new list element. Lower numbers and removed keys are free; a new file is free (its test is new too).
 */
export function baselineHits(path, baseText, headText) {
  const base = parseJson(baseText);
  const head = parseJson(headText);
  if (base === undefined) return [];
  if (head === undefined) return [`baseline ${path} * present→-`];
  if (base === null || head === null)
    return [
      `baseline ${path} * ${base === null ? 'unreadable' : 'present'}→${head === null ? 'unreadable' : 'present'}`,
    ];
  const hits = [];
  const was = leaves(base);
  for (const [key, now] of leaves(head)) {
    const old = was.get(key);
    if ('el' in now) {
      if (!old)
        hits.push(`baseline ${path} ${key.slice(0, key.lastIndexOf('='))} -→${canon(now.el)}`);
    } else if (!old) hits.push(`baseline ${path} ${key} -→${canon(now.value)}`);
    else if (typeof old.value === 'number' && typeof now.value === 'number') {
      if (now.value > old.value) hits.push(`baseline ${path} ${key} ${old.value}→${now.value}`);
    } else if (canon(old.value) !== canon(now.value))
      hits.push(`baseline ${path} ${key} ${canon(old.value)}→${canon(now.value)}`);
  }
  return hits;
}

/** `seed-rows.json`: red on every lowered or removed row count (all stimulus values measure the seeded build). */
export function seedRowsHits(baseText, headText) {
  const base = parseJson(baseText);
  const head = parseJson(headText);
  if (base === undefined) return [];
  if (base === null || !isObject(base?.rows))
    return head === null ? ['seed-rows @file present→unreadable'] : [];
  if (!isObject(head) || !isObject(head.rows))
    return [`seed-rows @file present→${head === undefined ? '-' : 'unreadable'}`];
  const hits = [];
  for (const k of ['version', 'scale'])
    if (canon(base[k]) !== canon(head[k]))
      hits.push(`seed-rows @${k} ${canon(base[k])}→${canon(head[k])}`);
  for (const [collection, was] of Object.entries(base.rows)) {
    const now = head.rows[collection];
    if (typeof now !== 'number' || typeof was !== 'number' || now < was)
      if (canon(was) !== canon(now))
        hits.push(`seed-rows ${collection} ${canon(was)}→${canon(now)}`);
  }
  return hits;
}

/** `signature-blocks.json`: every new, changed or removed entry is a hit. */
export function signatureHits(path, baseText, headText) {
  const base = parseJson(baseText);
  const head = parseJson(headText);
  if (base === undefined && head === undefined) return [];
  if (base === null || head === null) return [`signature ${path} @file changed`];
  const hits = [];
  const was = isObject(base?.blocks) ? base.blocks : {};
  const now = isObject(head?.blocks) ? head.blocks : {};
  for (const id of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (!(id in was)) hits.push(`signature ${path} ${id} added`);
    else if (!(id in now)) hits.push(`signature ${path} ${id} removed`);
    else if (canon(was[id]) !== canon(now[id])) hits.push(`signature ${path} ${id} changed`);
  }
  const rest = (o) => canon({ ...(isObject(o) ? o : { value: o }), blocks: undefined });
  if (base !== undefined && head !== undefined && rest(base) !== rest(head))
    hits.push(`signature ${path} @file changed`);
  return hits;
}

/** `web/package.json`: the whole `scripts` object; dependencies and `version` stay free. */
export function scriptsHits(baseText, headText) {
  const base = parseJson(baseText);
  const head = parseJson(headText);
  if (base === undefined && head === undefined) return [];
  if (base === null || head === null) return ['scripts @file "unreadable"→"unreadable"'];
  const was = isObject(base?.scripts) ? base.scripts : {};
  const now = isObject(head?.scripts) ? head.scripts : {};
  const hits = [];
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)]))
    if (canon(was[key]) !== canon(now[key]))
      hits.push(`scripts ${key} ${canon(was[key])}→${canon(now[key])}`);
  return hits;
}

const SKIP_RE = /\b(?:test|it|describe)(?:\.\w+)*\.(?:skip|fixme|todo|only|skipIf|runIf)\b/g;
/** Titles (or, without one, the call itself) of every `test|it|describe` `.skip|.fixme|.todo|.only` in a file. */
export function skipMarks(text) {
  const out = [];
  if (!text) return out;
  for (const m of text.matchAll(SKIP_RE)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const title = /^\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/.exec(after);
    out.push(title ? `${m[0]} ${title[2]}` : `${m[0]} (no title)`);
  }
  return out;
}
/** Entries of every `testIgnore` / `exclude` in a file. */
export function ignorePatterns(text) {
  const out = [];
  if (!text) return out;
  for (const m of text.matchAll(/\b(testIgnore|exclude)["']?\s*:\s*/g)) {
    let i = m.index + m[0].length;
    let value;
    if (text[i] === '[') {
      let depth = 0;
      const start = i;
      for (; i < text.length; i++) {
        if (text[i] === '[') depth++;
        else if (text[i] === ']' && --depth === 0) break;
      }
      value = text.slice(start + 1, i);
    } else value = /^[^\n]*/.exec(text.slice(i))[0].replace(/,\s*$/, '');
    for (const part of value.split(/,(?![^[({]*[\])}])/)) {
      const entry = part.trim().replace(/\s+/g, ' ');
      if (entry) out.push(`${m[1]} ${entry}`);
    }
  }
  return out;
}
/** Entries of `now` that `was` does not hold (as multisets). */
function added(was, now) {
  const left = new Map();
  for (const w of was) left.set(w, (left.get(w) ?? 0) + 1);
  const out = [];
  for (const n of now) {
    const c = left.get(n) ?? 0;
    if (c > 0) left.set(n, c - 1);
    else out.push(n);
  }
  return out;
}

const PAIR = { ')': '(', ']': '[', '}': '{' };
const REGEX_BEFORE =
  /(?:^|[^\w$.])(?:return|typeof|case|do|else|in|of|void|delete|throw|new|instanceof|yield|await)$/;
/**
 * True if `appended` is nothing but top-level statements of the form
 * `test('title', [async] (params) => { body }[, timeout]);` (or `it(…)`). Everything else is refused: other
 * calls, `.skip/.only/.use/.describe`, imports, assignments, a computed title or argument (it would run while
 * the file is collected), and every text this small reader cannot follow with certainty (fail closed). `jsx`
 * switches on JSX reading for `.tsx` / `.jsx` files.
 */
export function onlyAppendedTests(appended, { jsx = false } = {}) {
  const src = appended.replace(/\r\n/g, '\n');
  // Line separators end a `//` comment for JavaScript but not for this reader.
  if (/[\r\u2028\u2029]/.test(src)) return false;
  // Hoisted by Vitest wherever they stand, also inside a test body.
  if (/\bvi\s*\.\s*(mock|unmock|hoisted)\b/.test(src)) return false;
  const n = src.length;
  let i = 0;
  const fail = () => {
    throw new RangeError('not a plain appended test');
  };
  const ws = () => {
    for (;;) {
      while (i < n && /\s/.test(src[i])) i++;
      if (src.startsWith('//', i)) while (i < n && src[i] !== '\n') i++;
      else if (src.startsWith('/*', i)) {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) fail();
        i = end + 2;
      } else return;
    }
  };
  // Each reader starts on the first character of its construct and stops right behind it.
  const str = () => {
    const quote = src[i];
    for (i++; i < n; i++) {
      if (src[i] === '\\') i++;
      else if (src[i] === '\n') fail();
      else if (src[i] === quote) return void i++;
    }
    fail();
  };
  const tpl = () => {
    for (i++; i < n;) {
      if (src[i] === '\\') i += 2;
      else if (src[i] === '`') return void i++;
      else if (src[i] === '$' && src[i + 1] === '{') {
        i++;
        block();
      } else i++;
    }
    fail();
  };
  const regex = () => {
    let cls = false;
    for (i++; i < n; i++) {
      const c = src[i];
      if (c === '\\') i++;
      else if (c === '\n') fail();
      else if (c === '[') {
        if (cls) fail(); // nested classes depend on the flag that only follows later
        cls = true;
      } else if (c === ']') cls = false;
      else if (c === '/' && !cls) return void i++;
    }
    fail();
  };
  /** May an expression start here (then `/` opens a regex and `<` a JSX element)? */
  const expression = (last, lastAt) => {
    if (last === '') return true;
    if ((last === '+' || last === '-') && src[lastAt - 1] === last) fail(); // `x++ / 2` or `++ /re/`
    if ('(,=:[!&|?{;+-*%<>~^'.includes(last)) return true;
    return REGEX_BEFORE.test(src.slice(Math.max(0, lastAt - 12), lastAt + 1));
  };
  const name = () => {
    const m = /^[\w$.:-]*/.exec(src.slice(i, i + 200))[0];
    i += m.length;
    return m;
  };
  const jsxElement = () => {
    i++;
    const tag = name();
    for (;;) {
      while (i < n && /\s/.test(src[i])) i++;
      if (src.startsWith('/>', i)) return void (i += 2);
      if (src[i] === '>') break;
      if (src[i] === '{') {
        block();
        continue;
      }
      if (!name()) fail();
      while (i < n && /\s/.test(src[i])) i++;
      if (src[i] !== '=') continue;
      i++;
      while (i < n && /\s/.test(src[i])) i++;
      if (src[i] === '"' || src[i] === "'") {
        // No escapes in a JSX attribute string.
        const end = src.indexOf(src[i], i + 1);
        if (end < 0) fail();
        i = end + 1;
      } else if (src[i] === '{') block();
      else fail();
    }
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '{') block();
      else if (c === '<' && src[i + 1] === '/') {
        i += 2;
        if (name() !== tag) fail();
        while (i < n && /\s/.test(src[i])) i++;
        if (src[i] !== '>') fail();
        return void i++;
      } else if (c === '<') jsxElement();
      else if (c === '>' || c === '}') fail();
      else i++;
    }
    fail();
  };
  /** From an opening bracket to its partner; strings, templates, comments, regex literals and JSX are skipped. */
  function block() {
    const stack = [];
    let last = '';
    let lastAt = -1;
    const mark = (c = src[i - 1]) => {
      last = c;
      lastAt = i - 1;
    };
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) i++;
      else if (src.startsWith('//', i) || src.startsWith('/*', i)) ws();
      else if (c === "'" || c === '"') {
        str();
        mark();
      } else if (c === '`') {
        tpl();
        mark();
      } else if (c === '/') {
        if (expression(last, lastAt)) regex();
        else if (/[\w$\]]/.test(last))
          i++; // division
        else fail(); // after `)` or `}` it could be either: do not guess
        mark('/');
      } else if (
        jsx &&
        c === '<' &&
        /[A-Za-z_$>]/.test(src[i + 1] ?? '') &&
        !/[\w$\]'"`]/.test(last)
      ) {
        if (!expression(last, lastAt)) fail(); // after `)` or `}`: could be a comparison or an element
        jsxElement();
        mark(')');
      } else {
        if ('([{'.includes(c)) stack.push(c);
        else if (')]}'.includes(c)) {
          if (stack.pop() !== PAIR[c]) fail();
          if (!stack.length) return void i++;
        }
        i++;
        mark(c);
      }
    }
    fail();
  }
  const statement = () => {
    const call = /^(?:test|it)\(/.exec(src.slice(i, i + 5));
    if (!call) fail();
    i += call[0].length;
    ws();
    const start = i;
    if (src[i] === "'" || src[i] === '"') str();
    else if (src[i] === '`') tpl();
    else fail();
    if (src.slice(start, i).includes('${')) fail();
    ws();
    if (src[i++] !== ',') fail();
    ws();
    if (/^async\b/.test(src.slice(i, i + 6))) i += 5;
    ws();
    const params = /^\([\w\s,{}:$.]*\)/.exec(src.slice(i, i + 400));
    if (!params) fail();
    i += params[0].length;
    ws();
    if (!src.startsWith('=>', i)) fail();
    i += 2;
    ws();
    if (src[i] !== '{') fail();
    block();
    ws();
    if (src[i] === ',') {
      i++;
      ws();
      const timeout = /^[\d_]+/.exec(src.slice(i, i + 12));
      if (timeout) {
        i += timeout[0].length;
        ws();
        if (src[i] === ',') i++;
        ws();
      }
    }
    if (src[i++] !== ')') fail();
    if (src[i] === ';') i++;
  };
  try {
    let statements = 0;
    for (;;) {
      ws();
      if (i >= n) return statements > 0;
      statement();
      statements++;
    }
  } catch (e) {
    if (e instanceof RangeError) return false;
    throw e;
  }
}
/** A protected test file may grow at its end by plain `test(` / `it(` calls; nothing else. */
export function isAppendOnly(baseText, headText, path = '') {
  if (typeof baseText !== 'string' || typeof headText !== 'string') return false;
  const base = baseText.endsWith('\n') ? baseText : `${baseText}\n`;
  if (!headText.startsWith(base) || headText.length === base.length) return false;
  return onlyAppendedTests(headText.slice(base.length), { jsx: /\.[jt]sx$/.test(path) });
}

/** Module specifiers a source file imports (static, dynamic, side-effect, require). */
export function importsOf(text) {
  const out = new Set();
  if (!text) return out;
  for (const re of [
    /\bfrom\s*(['"])([^'"\n]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"\n]+)\1/g,
    /\bimport\s+(['"])([^'"\n]+)\1/g,
    /\brequire\s*\(\s*(['"])([^'"\n]+)\1/g,
  ])
    for (const m of text.matchAll(re)) out.add(m[2]);
  return out;
}
export function resolveImport(from, spec, exists) {
  let target;
  if (spec.startsWith('@/')) target = `web/src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const parts = from.split('/').slice(0, -1);
    for (const p of spec.split('/')) {
      if (p === '..') parts.pop();
      else if (p !== '.' && p !== '') parts.push(p);
    }
    target = parts.join('/');
  } else return null;
  for (const ext of ['', '.ts', '.tsx', '.mjs', '.js', '.json', '/index.ts', '/index.tsx'])
    if (exists(target + ext)) return target + ext;
  return null;
}
const closureEligible = (path) =>
  path.startsWith('web/e2e/') ||
  path.startsWith('web/scripts/') ||
  path.includes('/__tests__/') ||
  /\.fixture\.[^/]+$/.test(path);
/**
 * Files under web/e2e, web/scripts, `__tests__` or `*.fixture.*` that a protected file imports, directly or
 * through such a file (import scan over `git show`, nothing is executed). Product code is never part of it.
 */
export function protectedClosure(tree, read) {
  const seen = new Set();
  const queue = [...tree.keys()].filter((p) => isCode(p) && matchesAny(p, PROTECTED));
  const result = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(read(file))) {
      const target = resolveImport(file, spec, (p) => tree.has(p));
      if (!target || seen.has(target) || !closureEligible(target)) continue;
      result.add(target);
      if (isCode(target)) queue.push(target);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// All hits of base → head
// ---------------------------------------------------------------------------------------------------------

/**
 * `repo` reads history only: `tree(rev)` → Map path → blob id, `read(rev, path)` → text or null,
 * `changed(base, head)` → [{ status: 'A' | 'M' | 'D', path }] (renames as delete + add).
 * Returns the hit lines, sorted.
 */
export function collectHits(repo, base, head) {
  const hits = [];
  const baseTree = repo.tree(base);
  const headTree = repo.tree(head);
  const changed = repo.changed(base, head);
  const was = (path) => (baseTree.has(path) ? repo.read(base, path) : null);
  const now = (path) => (headTree.has(path) ? repo.read(head, path) : null);
  const text = (t) => (t === null ? undefined : t);

  const newRouteSlugs = new Set();
  for (const { path } of changed) {
    if (!/^web\/src\/modules\/[^/]+\/manifest\.tsx?$/.test(path)) continue;
    const before = manifestRoutes(was(path));
    for (const route of manifestRoutes(now(path)))
      if (!before.has(route)) newRouteSlugs.add(routeSlug(route));
  }

  let closure = null;
  const inClosure = (path) => {
    if (!closureEligible(path)) return false;
    closure ??= new Set([
      ...protectedClosure(baseTree, (p) => repo.read(base, p)),
      ...protectedClosure(headTree, (p) => repo.read(head, p)),
    ]);
    return closure.has(path);
  };

  for (const { status, path } of changed) {
    if (path === BUDGET_FILE)
      hits.push(...budgetHits(path, text(was(path)), text(now(path)), newRouteSlugs));
    else if (path === SEED_ROWS_FILE) hits.push(...seedRowsHits(text(was(path)), text(now(path))));
    else if (path === SIGNATURE_FILE)
      hits.push(...signatureHits(path, text(was(path)), text(now(path))));
    else if (
      path.startsWith(BASELINE_DIR) &&
      path.endsWith('.json') &&
      !path.slice(BASELINE_DIR.length).includes('/')
    )
      hits.push(...baselineHits(path, text(was(path)), text(now(path))));
    else if (path === PACKAGE_FILE) hits.push(...scriptsHits(text(was(path)), text(now(path))));
    else {
      const listed = matchesAny(path, PROTECTED);
      if (!listed && !inClosure(path)) continue;
      const blob = (tree) => tree.get(path) ?? '-';
      const line = `protected ${path} ${blob(baseTree)}→${blob(headTree)}`;
      if (status === 'A') {
        if (matchesAny(path, ALWAYS_PROTECTED) || !matchesAny(path, NEW_FILES_FREE))
          hits.push(line);
      } else if (status === 'D') hits.push(line);
      else if (!(isTestFile(path) && isAppendOnly(was(path), now(path), path))) hits.push(line);
      if (status !== 'D') {
        for (const mark of added(skipMarks(was(path)), skipMarks(now(path))))
          hits.push(`skip ${path} ${mark}`);
        for (const entry of added(ignorePatterns(was(path)), ignorePatterns(now(path))))
          hits.push(`ignore ${path} ${entry}`);
      }
    }
  }
  return hits.sort();
}

/** SHA-256 over the sorted hit lines, one per line. */
export function hashOf(hits) {
  return createHash('sha256')
    .update([...hits].sort().join('\n'), 'utf8')
    .digest('hex');
}
export const approvalMessage = (pr, hash, repo = REPO) => `${LABEL} ${repo}#${pr} ${hash}`;

export function hitTable(hits) {
  if (!hits.length) return 'Stimulus ratchet: no hits.';
  const esc = (s) => s.replace(/\|/g, '\\|');
  return [
    `Stimulus ratchet: ${hits.length} hit(s). Each one needs the maintainer's approval (docs/howto/ci.md).`,
    '',
    '| Kind | Detail |',
    '| --- | --- |',
    ...hits.map(
      (h) => `| ${h.slice(0, h.indexOf(' '))} | \`${esc(h.slice(h.indexOf(' ') + 1))}\` |`,
    ),
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------------------------------------

export function loadPublicKey(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  const key = value.includes('BEGIN')
    ? createPublicKey(value)
    : createPublicKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('RATCHET_PUBLIC_KEY is not an Ed25519 key');
  return key;
}
/**
 * True if the whole comment is `stimulus-raise <repo>#<pr> <hash> <signature>` for this pull request and this
 * hash, and the signature over `stimulus-raise <repo>#<pr> <hash>` verifies. Author, edits and labels play no part.
 */
export function isApproval(body, { pr, hash, key, repo = REPO }) {
  if (!key || typeof body !== 'string') return false;
  const m = /^stimulus-raise (\S+)#(\d+) ([0-9a-f]{64}) ([A-Za-z0-9+/=]{88})$/.exec(body.trim());
  if (!m || m[1] !== repo || m[2] !== String(pr) || m[3] !== hash) return false;
  const signature = Buffer.from(m[4], 'base64');
  if (signature.length !== 64) return false;
  try {
    return verify(null, Buffer.from(approvalMessage(pr, hash, repo), 'utf8'), key, signature);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------
// git and GitHub (read only)
// ---------------------------------------------------------------------------------------------------------

export function gitRepo(cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const trees = new Map();
  return {
    git,
    tree(rev) {
      let tree = trees.get(rev);
      if (!tree) {
        tree = new Map();
        for (const row of git('ls-tree', '-r', '-z', '--full-tree', rev).split('\0')) {
          const tab = row.indexOf('\t');
          if (tab > 0) tree.set(row.slice(tab + 1), row.slice(0, tab).split(' ')[2]);
        }
        trees.set(rev, tree);
      }
      return tree;
    },
    read(rev, path) {
      const blob = this.tree(rev).get(path);
      return blob ? git('cat-file', 'blob', blob) : null;
    },
    changed(base, head) {
      const parts = git('diff', '--name-status', '--no-renames', '-z', base, head).split('\0');
      const out = [];
      for (let i = 0; i + 1 < parts.length; i += 2)
        out.push({
          status: parts[i] === 'A' || parts[i] === 'D' ? parts[i] : 'M',
          path: parts[i + 1],
        });
      return out;
    },
    resolve: (rev) => git('rev-parse', '--verify', `${rev}^{commit}`).trim(),
    mergeBase: (a, b) => git('merge-base', a, b).trim(),
    fetch: (...refs) => git('fetch', '--quiet', '--no-tags', 'origin', ...refs),
  };
}

export async function github(fetchImpl, token, path) {
  const res = await fetchImpl(`${API}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'nemo-ratchet',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status}`);
  return res.json();
}
/** Every page of a list endpoint (`pick` takes the array out of an envelope). */
export async function githubAll(fetchImpl, token, path, pick = (x) => x) {
  const out = [];
  for (let page = 1; page <= 100; page++) {
    const rows = pick(
      await github(
        fetchImpl,
        token,
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      ),
    );
    if (!Array.isArray(rows)) throw new Error(`GitHub ${path}: unexpected answer`);
    out.push(...rows);
    if (rows.length < 100) return out;
  }
  throw new Error(`GitHub ${path}: too many pages`);
}

/**
 * The check run "Web (lint, types, unit, E2E)" of the newest `pull_request` run of ci.yml on `head` must have
 * succeeded (`filter=latest`: a re-run replaces its first attempt). Commit statuses are never read.
 */
export async function webCheckPassed({ fetchImpl, token, repo = REPO, pr, head }) {
  const runs = (
    await githubAll(
      fetchImpl,
      token,
      `/repos/${repo}/actions/runs?head_sha=${head}&event=pull_request`,
      (x) => x?.workflow_runs,
    )
  ).filter(
    (r) =>
      r.event === 'pull_request' &&
      r.path === CI_WORKFLOW &&
      r.head_sha === head &&
      (!Array.isArray(r.pull_requests) ||
        r.pull_requests.length === 0 ||
        r.pull_requests.some((p) => p.number === pr)),
  );
  if (!runs.length) return { ok: false, why: `no pull_request run of ${CI_WORKFLOW} on ${head}` };
  const run = runs.reduce((a, b) => ((b.run_number ?? 0) > (a.run_number ?? 0) ? b : a));
  const checks = (
    await githubAll(
      fetchImpl,
      token,
      `/repos/${repo}/commits/${head}/check-runs?check_name=${encodeURIComponent(WEB_CHECK)}&filter=latest`,
      (x) => x?.check_runs,
    )
  ).filter(
    (c) =>
      c.name === WEB_CHECK &&
      c.app?.slug === 'github-actions' &&
      c.check_suite?.id === run.check_suite_id,
  );
  if (!checks.length) return { ok: false, why: `run ${run.id} has no check run "${WEB_CHECK}"` };
  const bad = checks.find((c) => c.status !== 'completed' || c.conclusion !== 'success');
  if (bad)
    return {
      ok: false,
      why: `"${WEB_CHECK}" of run ${run.id} is ${bad.status}/${bad.conclusion ?? '-'}`,
    };
  return { ok: true, why: `"${WEB_CHECK}" of run ${run.id} succeeded` };
}

// ---------------------------------------------------------------------------------------------------------
// The two modes
// ---------------------------------------------------------------------------------------------------------

/** CI feedback: red on hits unless the label is on the pull request right now. Returns the exit code. */
export async function runCi({
  base,
  head,
  repo = gitRepo(),
  env = process.env,
  fetchImpl = fetch,
  out = console.log,
}) {
  const hits = collectHits(repo, base, head);
  const table = hitTable(hits);
  out(table);
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `${table}\n\nInformation only: the approval hash comes from \`ratchet.mjs --pr\` in its \`develop\` version.\n`,
    );
  if (!hits.length) return 0;
  const slug = env.GITHUB_REPOSITORY || REPO;
  if (!env.PR_NUMBER) {
    out('No PR_NUMBER: the label cannot be read, hits stay red.');
    return 1;
  }
  try {
    const labels = await githubAll(
      fetchImpl,
      env.GITHUB_TOKEN,
      `/repos/${slug}/issues/${env.PR_NUMBER}/labels`,
    );
    if (labels.some((l) => l?.name === LABEL)) {
      out(
        `Label "${LABEL}" is on the pull request: green for CI. The merge still needs the signed comment.`,
      );
      return 0;
    }
  } catch (e) {
    out(`Could not read the labels (${e.message}); hits stay red.`);
    return 1;
  }
  out(
    `Hits without the label "${LABEL}". Only the maintainer sets it, by hand, after reading this table.`,
  );
  return 1;
}

/** Merge rule. Returns the exit code; 0 only if everything is proven. */
export async function runPr({
  pr,
  head: wantedHead,
  repo = gitRepo(),
  env = process.env,
  fetchImpl = fetch,
  publicKey = RATCHET_PUBLIC_KEY,
  slug = REPO,
  out = console.log,
}) {
  const problems = [];
  let key = null;
  try {
    key = loadPublicKey(publicKey);
    if (!key) problems.push('RATCHET_PUBLIC_KEY is empty: no approval can be checked');
  } catch (e) {
    problems.push(`RATCHET_PUBLIC_KEY is unreadable (${e.message})`);
  }
  const token = env.GITHUB_TOKEN;
  const pull = await github(fetchImpl, token, `/repos/${slug}/pulls/${pr}`);
  const head = pull?.head?.sha;
  const baseRef = pull?.base?.ref;
  if (!/^[0-9a-f]{40}$/.test(head ?? '') || !baseRef)
    throw new Error('pull request answer without head or base');
  if (pull.state !== 'open')
    problems.push(`pull request is ${pull.merged ? 'merged' : pull.state}`);
  if (wantedHead && wantedHead !== head)
    problems.push(`live head ${head} is not --head ${wantedHead}`);

  repo.fetch(`refs/heads/${baseRef}`);
  const baseTip = repo.resolve('FETCH_HEAD');
  try {
    repo.fetch(head);
  } catch {
    repo.fetch(`refs/pull/${pr}/head`); // a server that does not hand out single commits
  }
  repo.resolve(head); // throws if the head commit is still not here
  const base = repo.mergeBase(baseTip, head);
  const hits = collectHits(repo, base, head);
  const hash = hashOf(hits);
  out(`Pull request ${slug}#${pr}: head ${head}, merge base ${base} (${baseRef}).`);
  out(hitTable(hits));

  if (hits.length) {
    const message = approvalMessage(pr, hash, slug);
    let approved = false;
    if (key) {
      const comments = await githubAll(fetchImpl, token, `/repos/${slug}/issues/${pr}/comments`);
      approved = comments.some((c) => isApproval(c?.body, { pr, hash, key, repo: slug }));
    }
    out(
      `\nHit lines (the hash is the SHA-256 over them, sorted, one per line):\n${hits.join('\n')}`,
    );
    out(`\nHash: ${hash}`);
    out(`Message: ${message}`);
    if (approved) out('Approval: a comment with a valid signature over this message exists.');
    else {
      problems.push('hits without a validly signed approval comment for this hash');
      out('Sign it (asks for the passphrase, prints the signature):');
      out(
        `  printf '%s' '${message}' > /tmp/ratchet-msg.txt && openssl pkeyutl -sign -rawin -inkey ~/.nemo/ratchet.pem -in /tmp/ratchet-msg.txt | openssl base64 -A; echo`,
      );
      out(
        `Then post as the whole text of one comment on the pull request:\n  ${message} <signature>`,
      );
    }
  }

  const web = await webCheckPassed({ fetchImpl, token, repo: slug, pr, head });
  out(`\nCheck: ${web.why}.`);
  if (!web.ok) problems.push(web.why);

  if (problems.length) {
    out(`\nNOT mergeable:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    return 1;
  }
  out(`\nMergeable: head ${head} (use it as expectedHeadSha).`);
  return 0;
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const name = /^--(base|head|pr)$/.exec(argv[i])?.[1];
    if (!name || argv[i + 1] === undefined)
      throw new Error(`unknown or incomplete argument "${argv[i]}"`);
    args[name] = argv[++i];
  }
  if (args.pr !== undefined) {
    if (!/^[1-9]\d*$/.test(args.pr) || args.base)
      throw new Error('usage: --pr <number> [--head <sha>]');
    args.pr = Number(args.pr);
  } else if (!args.base || !args.head)
    throw new Error('usage: --base <sha> --head <sha> | --pr <number> [--head <sha>]');
  return args;
}

/** Runs one mode and returns the exit code. An error is never a pass (fail closed). */
export async function cli(argv, deps = {}) {
  try {
    const args = parseArgs(argv);
    return args.pr !== undefined
      ? await runPr({ ...args, ...deps })
      : await runCi({ ...args, ...deps });
  } catch (e) {
    (deps.out ?? console.error)(
      `ratchet: ${e?.stderr ? String(e.stderr).trim() || e.message : (e?.message ?? e)}`,
    );
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await cli(process.argv.slice(2));
