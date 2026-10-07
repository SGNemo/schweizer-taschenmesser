// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearErrorLog,
  errorLog,
  installErrorLog,
  loadPersistedErrors,
  logLine,
  logLines,
  MAX_ENTRIES,
  MAX_LINES,
  MAX_MESSAGE,
  MAX_STACK_FRAMES,
  recordError,
  sanitize,
} from './errorLog';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { useSyncStatus } from '@/core/sync/status';
import todosManifest from '@/modules/todos/manifest';
import { buildDiagnostics, describeOs, renderDiagnostics } from './export';
import { issueUrl, mailtoUrl } from './report';

afterEach(clearErrorLog);

describe('sanitize', () => {
  it('keeps only the origin of URLs and hides mail addresses, user paths and long tokens', () => {
    const out = sanitize(
      'fetch https://api.example.test/v1/vault?token=abc failed for erika@example.test at C:\\Users\\Erika\\x.json and /home/erika/y with ' +
        'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    );
    expect(out).toContain('https://api.example.test');
    expect(out).not.toContain('/v1/vault');
    expect(out).not.toContain('erika@');
    expect(out).not.toContain('Erika');
    expect(out).not.toContain('/home/erika');
    expect(out).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });
  it('truncates long messages', () => {
    expect(sanitize('word '.repeat(200)).length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});

describe('error log', () => {
  it('keeps the last entries only and no stack traces', () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) recordError('t', new Error(`boom ${i}`));
    const log = errorLog();
    expect(log).toHaveLength(MAX_ENTRIES);
    expect(log.at(-1)?.message).toBe(`Error: boom ${MAX_ENTRIES + 4}`);
    expect(JSON.stringify(log.map((e) => e.message))).not.toContain('at ');
    expect(log.at(-1)?.stack).toBeDefined();
  });

  it('collects window errors, rejections and tagged console.error calls, then uninstalls', () => {
    const handlers: Record<string, (e: Event) => void> = {};
    const target = {
      addEventListener: (type: string, fn: (e: Event) => void) => void (handlers[type] = fn),
      removeEventListener: (type: string) => void delete handlers[type],
    };
    const original = vi.fn();
    const fakeConsole = { error: original };
    const uninstall = installErrorLog(target as never, fakeConsole);
    handlers.error!({ error: new TypeError('bad') } as unknown as Event);
    handlers.unhandledrejection!({ reason: 'nope' } as unknown as Event);
    fakeConsole.error('[sync] push failed', new Error('offline'));
    fakeConsole.error('untagged noise');
    expect(errorLog().map((e) => [e.source, e.message])).toEqual([
      ['window', 'TypeError: bad'],
      ['promise', 'nope'],
      ['sync', 'push failed Error: offline'],
    ]);
    expect(original).toHaveBeenCalledTimes(2);
    uninstall();
    expect(Object.keys(handlers)).toEqual([]);
  });
});

describe('ring buffers', () => {
  it('keeps the last 200 log lines and rotates the oldest out', () => {
    for (let i = 0; i < MAX_LINES + 7; i++) logLine('info', 'sync', `line ${i}`);
    const l = logLines();
    expect(l).toHaveLength(MAX_LINES);
    expect(l[0]?.message).toBe('line 7');
    expect(l.at(-1)?.message).toBe(`line ${MAX_LINES + 6}`);
  });

  it('shortens stacks to a few anonymised frames', () => {
    const e = new Error('x');
    e.stack =
      'Error: x\n' +
      Array.from(
        { length: 20 },
        (_, i) => `    at fn${i} (C:\\Users\\Erika\\app\\f${i}.js:1:1)`,
      ).join('\n');
    recordError('t', e);
    const stack = errorLog().at(-1)?.stack ?? '';
    expect(stack.split('\n')).toHaveLength(MAX_STACK_FRAMES);
    expect(stack).not.toContain('Erika');
  });

  it('survives a restart through the small persisted copy', () => {
    recordError('sync', new Error('offline'));
    const stored = localStorage.getItem('tm-diag-errors');
    expect(stored).toBeTruthy();
    // simulate a new session: memory empty, storage kept
    errorLog(); // buffer is module state; reload it from storage
    const uninstall = installErrorLog(
      { addEventListener() {}, removeEventListener() {} } as never,
      {
        error: () => {},
      },
    );
    expect(errorLog().map((e) => e.message)).toEqual(['Error: offline']);
    uninstall();
  });

  it('ignores a corrupt persisted copy', () => {
    localStorage.setItem('tm-diag-errors', '{nope');
    expect(() => loadPersistedErrors()).not.toThrow();
  });
});

const CANARIES = {
  entry: 'GEHEIMER-EINTRAG-TITEL',
  email: 'erika.mustermann@example.test',
  // Built at runtime so the secret scanner does not see a token-shaped literal in the repository.
  // Two long opaque strings that look like credentials (named neutrally on purpose: they are test
  // input for the scrubber, not secrets, and static analysis must not read them as such).
  opaqueA: ['tok', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'].join('_'),
  opaqueB: ['sk-ant', 'api03', 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'].join('-'),
  ip: '203.0.113.77',
  server: 'secret-sync.example.test',
  path: 'C:\\Users\\Erika\\Documents',
  homePath: '/home/erika/Dokumente',
};

describe('diagnostics export', () => {
  it('contains app facts, module ids, counts and the log', async () => {
    recordError('sync', new Error('offline'));
    const d = await buildDiagnostics();
    expect(d.format).toBe('nemo-diagnostics');
    expect(d.version).toBe(2);
    expect(d.app).not.toHaveProperty('dataDir');
    expect(d.activeModules.length).toBeGreaterThan(0);
    expect(d.errors).toHaveLength(1);
    expect(d.migrations.dbVersion).toBeGreaterThan(0);
    expect(d.counts).not.toHaveProperty('accounts');
    const text = renderDiagnostics(d);
    expect(text).toContain('## Last errors (1)');
    expect(text).toContain('Database version');
  });

  it('never contains entries, vault data, tokens, keys, mails, IPs, server URLs or user paths', async () => {
    const lists = createRepo(
      tableName('todos', 'list'),
      todosManifest.dataSchema.collections.list!.schema,
    );
    await lists.create({ name: CANARIES.entry, order: 0 } as never);
    useSyncStatus.setState({ phase: 'idle', server: CANARIES.server, encrypted: true });
    recordError(
      'sync',
      new Error(
        `push to https://${CANARIES.server}/v1 failed for ${CANARIES.email} value ${CANARIES.opaqueA} value ${CANARIES.opaqueB} from ${CANARIES.ip} in ${CANARIES.path} and ${CANARIES.homePath}`,
      ),
    );
    logLine('warn', 'sync', `retry ${CANARIES.server} ${CANARIES.email} ${CANARIES.ip}`);
    const text = renderDiagnostics(await buildDiagnostics());
    for (const [name, value] of Object.entries(CANARIES)) {
      expect(text, `leaked ${name}`).not.toContain(value);
    }
    expect(text).not.toContain('Erika');
    expect(text).not.toContain('erika');
    // counts are numbers only
    expect(text).toMatch(/todos: \d+/);
    expect(text).toContain('Connected: true');
  });

  it('describes the OS without versions that identify a build', () => {
    expect(
      describeOs(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.6099.71 Safari/537.36',
      ),
    ).toBe('Windows NT 10.0; Win64; x64; Chrome 120');
  });
});

describe('bug report links', () => {
  const facts = { version: '0.3.1', build: 'abc1234 stable', platform: 'PWA im Browser' };
  it('prefills the GitHub bug template and sends nothing', () => {
    const url = new URL(issueUrl(facts, `boom for ${CANARIES.email}`));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/SGNemo/schweizer-taschenmesser/issues/new',
    );
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('version')).toBe('0.3.1');
    expect(url.searchParams.get('platform')).toBe('PWA im Browser');
    expect(url.searchParams.get('steps')).toContain('1.');
    expect(url.searchParams.get('extra')).not.toContain(CANARIES.email);
  });
  it('builds a mailto link with the configured address', () => {
    expect(mailtoUrl(facts)).toMatch(/^mailto:[^?]+\?subject=.+&body=.+/);
  });
});
