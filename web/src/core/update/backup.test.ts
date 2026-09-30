import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import {
  BACKUP_DIR,
  KEEP_BACKUPS,
  backupsToPrune,
  createPreUpdateBackup,
  preUpdateBackupName,
} from './backup';

afterEach(() => setPlatform(undefined));

const at = new Date(2026, 9, 1, 8, 5, 9);

describe('names and pruning', () => {
  it('names files with versions and a sortable timestamp, safe for file systems', () => {
    expect(preUpdateBackupName('0.1.0', '0.2.0-beta.1', at)).toBe(
      'pre-update-0.1.0-to-0.2.0-beta.1-20261001-080509.json',
    );
    expect(preUpdateBackupName('1/2', '3:4', at)).toBe(
      'pre-update-1_2-to-3_4-20261001-080509.json',
    );
  });

  it('keeps the newest backups and never touches other files', () => {
    const name = (ts: string) => `pre-update-1.0.0-to-1.1.0-${ts}.json`;
    const names = [
      name('20260101-000000'),
      name('20260301-000000'),
      name('20260201-000000'),
      name('20260401-000000'),
      name('20260501-000000'),
      'notes.txt',
      'pre-update-broken.json',
    ];
    expect(backupsToPrune(names).sort()).toEqual([
      name('20260101-000000'),
      name('20260201-000000'),
    ]);
    expect(backupsToPrune(names, 10)).toEqual([]);
    expect(KEEP_BACKUPS).toBe(3);
  });
});

describe('createPreUpdateBackup', () => {
  function fakePlatform(existing: string[] = []) {
    const written = new Map<string, string | Uint8Array>();
    const removed: string[] = [];
    const platform: PlatformService = {
      ...createWebPlatform(),
      files: {
        async write(path, data) {
          written.set(path, data);
          existing.push(path.split('/').pop()!);
        },
        list: async () => [...existing],
        remove: async (path) => void removed.push(path),
      },
    };
    return { platform, written, removed };
  }

  it('writes a full JSON backup into the app folder', async () => {
    const { platform, written } = fakePlatform();
    setPlatform(platform);
    const path = await createPreUpdateBackup('0.1.0', '0.2.0', at);
    expect(path).toBe(`${BACKUP_DIR}/pre-update-0.1.0-to-0.2.0-20261001-080509.json`);
    const backup = JSON.parse(written.get(path) as string) as { format: string; tables: object };
    expect(backup.format).toBe('taschenmesser-backup');
    expect(typeof backup.tables).toBe('object');
    void db;
  });

  it('encrypts the copy when a backup passphrase is stored', async () => {
    const { platform, written } = fakePlatform();
    setPlatform({
      ...platform,
      secrets: {
        protection: 'device-key',
        get: async (name) =>
          name === 'backup.autoPassphrase' ? 'a-long-test-passphrase' : undefined,
        set: async () => undefined,
        delete: async () => undefined,
      },
    });
    const path = await createPreUpdateBackup('0.1.0', '0.2.0', at);
    const text = written.get(path) as string;
    expect(JSON.parse(text).format).toBe('taschenmesser-backup-encrypted');
    expect(text).not.toContain('taschenmesser-backup"');
  }, 30_000);

  it('prunes old backups after writing', async () => {
    const old = ['20250101-000000', '20250201-000000', '20250301-000000'].map(
      (t) => `pre-update-0.0.1-to-0.1.0-${t}.json`,
    );
    const { platform, removed } = fakePlatform([...old]);
    setPlatform(platform);
    await createPreUpdateBackup('0.1.0', '0.2.0', at);
    expect(removed).toEqual([`${BACKUP_DIR}/${old[0]}`]);
  });

  it('fails when the backup cannot be written (the caller must not update)', async () => {
    setPlatform({
      ...createWebPlatform(),
      files: {
        write: async () => Promise.reject(new Error('disk full')),
        list: async () => [],
        remove: async () => undefined,
      },
    });
    await expect(createPreUpdateBackup('0.1.0', '0.2.0', at)).rejects.toThrow('disk full');
  });

  it('a failure while pruning does not fail the backup', async () => {
    const { platform } = fakePlatform();
    setPlatform({
      ...platform,
      files: { ...platform.files, list: async () => Promise.reject(new Error('nope')) },
    });
    await expect(createPreUpdateBackup('0.1.0', '0.2.0', at)).resolves.toContain('pre-update-');
  });
});
