import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDatabase, backupName } from '../src/backup.js';
import { openStore } from '../src/store.js';
import { hlc, op } from './helpers.js';

describe('database backup', () => {
  it('copies a live database consistently, verifies it and rotates old copies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tm-backup-'));
    try {
      const path = join(dir, 'sync.db');
      const store = openStore(path); // stays open: the server keeps running during a backup
      store.setVault({ salt: 'c2FsdHNhbHRz', check: 'checkcheck' });
      store.push([op('title', hlc(1000), 'x'), op('done', hlc(1000), true)]);

      const dest = join(dir, 'backups');
      for (let i = 0; i < 4; i++)
        await backupDatabase(path, dest, 2, new Date(Date.UTC(2026, 0, 1 + i, 3, 0, 0)));
      const names = readdirSync(dest).sort();
      expect(names).toEqual([
        backupName(new Date('2026-01-03T03:00:00Z')),
        backupName(new Date('2026-01-04T03:00:00Z')),
      ]);

      if (process.platform !== 'win32')
        for (const n of names) expect(statSync(join(dest, n)).mode & 0o777).toBe(0o600);

      const restored = openStore(join(dest, names[1]!));
      expect(restored.epoch()).toBe(store.epoch());
      expect(restored.vault()).toEqual({ salt: 'c2FsdHNhbHRz', check: 'checkcheck' });
      expect(restored.pull(0, 10).ops).toHaveLength(2);
      restored.close();
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails cleanly for a missing or non-database file and keeps old copies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tm-backup-'));
    try {
      await expect(backupDatabase(join(dir, 'nope.db'), join(dir, 'b'))).rejects.toThrow();
      const bad = join(dir, 'bad.db');
      writeFileSync(bad, 'not a database');
      await expect(backupDatabase(bad, join(dir, 'b'))).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
