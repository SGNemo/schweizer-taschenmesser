import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import type { PlatformService } from '@/core/platform';
import { createTestDb } from '@/test-utils';
import {
  AUTO_CHECK_INTERVAL_MS,
  checkForUpdate,
  installUpdate,
  postponeUpdate,
  type UpdateDeps,
  type UpdateState,
} from './controller';
import { savePrefs } from './prefs';
import type { UpdateInfo, UpdateService } from './types';

const NOW = 1_800_000_000_000;
const info: UpdateInfo = { version: '1.1.0', notes: 'n', prerelease: false };

let database: TaschenmesserDB;

function setup(
  over: {
    check?: () => Promise<UpdateInfo | undefined>;
    install?: UpdateService['install'];
    backup?: () => Promise<unknown>;
    supported?: boolean;
  } = {},
) {
  const states: UpdateState[] = [];
  const updater = {
    supported: over.supported ?? true,
    check: vi.fn(over.check ?? (async () => info)),
    install: vi.fn(over.install ?? (async () => 'restarting' as const)),
  };
  const deps: UpdateDeps = {
    platform: {
      updater,
      app: { version: async () => '1.0.0', openUrl: async () => undefined },
    } as unknown as Pick<PlatformService, 'updater' | 'app'>,
    database,
    now: () => NOW,
    backup: vi.fn(over.backup ?? (async () => undefined)),
    setState: (s) => void states.push(s),
  };
  return { deps, updater, states };
}

beforeEach(() => {
  database = createTestDb();
});

describe('checkForUpdate', () => {
  it('reports a newer version and remembers when it looked', async () => {
    const { deps, updater } = setup();
    expect(await checkForUpdate({ manual: false }, deps)).toEqual({ phase: 'available', info });
    expect(updater.check).toHaveBeenCalledWith('stable', '1.0.0');
  });

  it('uses the channel from the preferences', async () => {
    await savePrefs({ channel: 'beta' }, database);
    const { deps, updater } = setup();
    await checkForUpdate({ manual: true }, deps);
    expect(updater.check).toHaveBeenCalledWith('beta', '1.0.0');
  });

  it('checks automatically at most once a day, manual checks always run', async () => {
    const { deps, updater } = setup();
    await checkForUpdate({ manual: false }, deps);
    expect(await checkForUpdate({ manual: false }, deps)).toEqual({ phase: 'idle' });
    expect(updater.check).toHaveBeenCalledTimes(1);
    await checkForUpdate({ manual: true }, deps);
    expect(updater.check).toHaveBeenCalledTimes(2);

    const later = { ...deps, now: () => NOW + AUTO_CHECK_INTERVAL_MS + 1 };
    await checkForUpdate({ manual: false }, later);
    expect(updater.check).toHaveBeenCalledTimes(3);
  });

  it('does nothing automatically when switched off, but a manual check still works', async () => {
    await savePrefs({ auto: false }, database);
    const { deps, updater } = setup();
    expect(await checkForUpdate({ manual: false }, deps)).toEqual({ phase: 'idle' });
    expect(updater.check).not.toHaveBeenCalled();
    expect((await checkForUpdate({ manual: true }, deps)).phase).toBe('available');
  });

  it('does nothing where self-update is not supported (browser)', async () => {
    const { deps, updater } = setup({ supported: false });
    expect(await checkForUpdate({ manual: true }, deps)).toEqual({ phase: 'idle' });
    expect(updater.check).not.toHaveBeenCalled();
  });

  it('says so when up to date', async () => {
    const { deps } = setup({ check: async () => undefined });
    expect(await checkForUpdate({ manual: true }, deps)).toEqual({
      phase: 'up-to-date',
      checkedAt: NOW,
    });
  });

  it('stays silent on a failing automatic check but reports a manual one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = setup({ check: async () => Promise.reject(new Error('offline')) });
    expect(await checkForUpdate({ manual: false }, failing.deps)).toEqual({ phase: 'idle' });
    expect(await checkForUpdate({ manual: true }, failing.deps)).toEqual({
      phase: 'error',
      code: 'check-failed',
    });
  });

  it('does not bring a postponed version up again automatically – a newer one yes', async () => {
    const { deps } = setup();
    await postponeUpdate(info, deps);
    const day = { ...deps, now: () => NOW + AUTO_CHECK_INTERVAL_MS + 1 };
    expect(await checkForUpdate({ manual: false }, day)).toEqual({ phase: 'idle' });
    expect((await checkForUpdate({ manual: true }, day)).phase).toBe('available');

    const newer = setup({ check: async () => ({ ...info, version: '1.2.0' }) });
    newer.deps.database = database;
    const later = { ...newer.deps, now: () => NOW + 3 * AUTO_CHECK_INTERVAL_MS };
    expect((await checkForUpdate({ manual: false }, later)).phase).toBe('available');
  });
});

describe('installUpdate', () => {
  it('backs up first, then installs, reporting progress', async () => {
    const order: string[] = [];
    const { deps, updater, states } = setup({
      backup: async () => void order.push('backup'),
      install: async () => {
        order.push('install');
        return 'restarting';
      },
    });
    updater.install.mockImplementation(
      async (_i: UpdateInfo, onProgress?: (p: { downloaded: number; total: number }) => void) => {
        order.push('install');
        onProgress?.({ downloaded: 5, total: 10 });
        return 'restarting';
      },
    );
    const result = await installUpdate(info, deps);
    expect(order).toEqual(['backup', 'install']);
    expect(deps.backup).toHaveBeenCalledWith('1.0.0', '1.1.0');
    expect(states.map((s) => (s.phase === 'installing' ? s.step : s.phase))).toEqual([
      'backup',
      'download',
      'download',
      'handover',
    ]);
    expect(states.some((s) => s.phase === 'installing' && s.progress?.downloaded === 5)).toBe(true);
    expect(result).toMatchObject({ phase: 'installing', step: 'handover' });
  });

  it('does NOT install when the backup fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { deps, updater } = setup({ backup: async () => Promise.reject(new Error('disk full')) });
    expect(await installUpdate(info, deps)).toEqual({
      phase: 'error',
      code: 'backup-failed',
      info,
    });
    expect(updater.install).not.toHaveBeenCalled();
  });

  it('asks for the install permission on Android instead of failing', async () => {
    const { deps } = setup({ install: async () => 'needs-permission' });
    expect(await installUpdate(info, deps)).toEqual({ phase: 'needs-permission', info });
  });

  it('reports installation errors and can be retried', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { deps, updater } = setup({
      install: async () => Promise.reject(new Error('sha256-mismatch')),
    });
    expect(await installUpdate(info, deps)).toEqual({
      phase: 'error',
      code: 'install-failed',
      info,
    });
    updater.install.mockResolvedValue('installer-opened');
    expect((await installUpdate(info, deps)).phase).toBe('installing');
  });

  it('tells apart the failures the native updater reports with a code', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Tauri rejects `invoke` with a plain string, not an Error.
    const cases: [unknown, string][] = [
      ['folder-not-writable: Access is denied. (os error 5)', 'folder-not-writable'],
      ['signature-invalid: signature does not match', 'signature-invalid'],
      ['swap-failed: boom', 'install-failed'],
      [new Error('network'), 'install-failed'],
    ];
    for (const [rejection, code] of cases) {
      const { deps } = setup({ install: async () => Promise.reject(rejection) });
      expect(await installUpdate(info, deps)).toMatchObject({ phase: 'error', code });
    }
  });
});
