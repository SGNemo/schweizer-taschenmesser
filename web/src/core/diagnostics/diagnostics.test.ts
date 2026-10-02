import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearErrorLog,
  errorLog,
  installErrorLog,
  MAX_ENTRIES,
  MAX_MESSAGE,
  recordError,
  sanitize,
} from './errorLog';
import { buildDiagnostics } from './export';

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
    expect(JSON.stringify(log)).not.toContain('at ');
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

describe('diagnostics export', () => {
  it('contains app facts, module ids and the log – no settings, secrets or the data folder', async () => {
    recordError('sync', new Error('offline'));
    const d = await buildDiagnostics();
    expect(d.format).toBe('nemo-diagnostics');
    expect(d.app).not.toHaveProperty('dataDir');
    expect(d.activeModules.length).toBeGreaterThan(0);
    expect(d.errors).toHaveLength(1);
    expect(Object.keys(d).sort()).toEqual(['activeModules', 'app', 'errors', 'format', 'version']);
  });
});
