import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, serializeBackup } from '@/core/backup/backup';
import { db } from '@/core/db/db';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { entryRepo, vaultRepo } from '../repo';
import { getSession } from '../session';
import {
  changeMasterPassword,
  createVault,
  decryptAll,
  deleteEntry,
  isReadable,
  lockoutMs,
  lockVault,
  readHeader,
  resetAttempts,
  saveEntry,
  unlockVault,
  VaultError,
} from '../vault';

const FAST = { m: 64, t: 1, p: 1 };
const MASTER = 'Master-Passwort-Nr-1';

const SECRETS = [
  'GitHub-Konto-Geheim',
  'hunter2-passwort-xyz',
  'JBSWY3DPEHPK3PXP',
  'meine private Notiz',
];
const draft = {
  title: 'GitHub-Konto-Geheim',
  username: 'alice@example.org',
  password: 'hunter2-passwort-xyz',
  url: 'https://github.com',
  notes: 'meine private Notiz',
  tags: ['Arbeit'],
  totp: {
    secret: 'JBSWY3DPEHPK3PXP',
    issuer: '',
    digits: 6 as const,
    period: 30,
    algorithm: 'SHA1' as const,
  },
};

async function clear() {
  lockVault();
  resetAttempts();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  await db.table('_outbox').clear();
}
beforeEach(clear);
afterEach(() => setNow());
afterAll(clear);

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof VaultError ? e.code : String(e);
  }
};

describe('vault lifecycle', () => {
  it('starts without a vault, creates one and is unlocked afterwards', async () => {
    expect(await readHeader()).toEqual({ state: 'none' });
    await createVault(MASTER, FAST);
    expect(getSession().status).toBe('unlocked');
    expect((await readHeader()).state).toBe('ready');
  });

  it('refuses weak passwords and a second vault', async () => {
    expect(await codeOf(createVault('kurz', FAST))).toBe('weak-password');
    await createVault(MASTER, FAST);
    lockVault();
    expect(await codeOf(createVault('Ein-anderes-Passwort', FAST))).toBe('exists');
  });

  it('locks, refuses access while locked and unlocks with the right password', async () => {
    await createVault(MASTER, FAST);
    await saveEntry(draft);
    lockVault();
    expect(getSession().status).toBe('locked');
    expect(await codeOf(saveEntry(draft))).toBe('locked');
    expect(await codeOf(decryptAll())).toBe('locked');
    await unlockVault(MASTER);
    expect(await decryptAll()).toHaveLength(1);
  });

  it('keeps the key non-extractable and only the header in the vault record', async () => {
    await createVault(MASTER, FAST);
    const s = getSession();
    if (s.status !== 'unlocked') throw new Error('unlocked expected');
    expect(s.dek.extractable).toBe(false);
    const row = await vaultRepo.get('vault');
    // ONE synced field: field-level merging must never mix two vaults' headers
    expect(
      Object.keys(row!).filter(
        (k) => !['id', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt', '_f'].includes(k),
      ),
    ).toEqual(['header']);
    expect(row!.header).not.toContain(MASTER);
  });

  it('reports a damaged header instead of crashing', async () => {
    await vaultRepo.upsert('vault', { header: '{"nonsense":true}' });
    expect((await readHeader()).state).toBe('corrupt');
    expect(await codeOf(unlockVault(MASTER))).toBe('corrupt');
  });
});

describe('wrong password handling', () => {
  it('delays after repeated failures (1 s, 2 s, 4 s … up to 30 s) and recovers', async () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(lockoutMs)).toEqual([0, 0, 0, 1000, 2000, 4000, 30000]);
    await createVault(MASTER, FAST);
    lockVault();
    let clock = 1_800_000_000_000;
    setNow(() => clock);
    for (let i = 0; i < 3; i++)
      expect(await codeOf(unlockVault('falsch-falsch-1'))).toBe('wrong-password');
    // the third failure starts a 1 s block – even the right password must wait
    expect(await codeOf(unlockVault(MASTER))).toBe('throttled');
    clock += 1001;
    await unlockVault(MASTER);
    expect(getSession().status).toBe('unlocked');
    lockVault();
    // success reset the counter
    expect(await codeOf(unlockVault('falsch-falsch-1'))).toBe('wrong-password');
    expect(await codeOf(unlockVault(MASTER))).toBe('ok');
  });
});

describe('entries', () => {
  it('stores only ciphertext and returns the plaintext when unlocked', async () => {
    await createVault(MASTER, FAST);
    const id = await saveEntry(draft);
    const raw = await db.table('accounts_entry').get(id);
    expect(raw.data).toMatch(/^v1\./);
    for (const secret of SECRETS) expect(JSON.stringify(raw)).not.toContain(secret);
    const [entry] = await decryptAll();
    expect(isReadable(entry!) && entry.data).toMatchObject({
      title: draft.title,
      password: draft.password,
      totp: { secret: 'JBSWY3DPEHPK3PXP' },
    });
  });

  it('uses a fresh nonce for every save, even of identical data', async () => {
    await createVault(MASTER, FAST);
    const id = await saveEntry(draft);
    const seen = new Set([(await db.table('accounts_entry').get(id)).data]);
    for (let i = 0; i < 20; i++) {
      await saveEntry(draft, id);
      seen.add((await db.table('accounts_entry').get(id)).data);
    }
    expect(seen.size).toBe(21);
  });

  it('updates and deletes (tombstone) entries', async () => {
    await createVault(MASTER, FAST);
    const id = await saveEntry(draft);
    await saveEntry({ ...draft, title: 'Umbenannt' }, id);
    expect((await decryptAll()).map((e) => isReadable(e) && e.data.title)).toEqual(['Umbenannt']);
    await deleteEntry(id);
    expect(await decryptAll()).toEqual([]);
    expect((await entryRepo.table.toArray())[0]!.deletedAt).not.toBeNull();
  });

  it('flags entries that were tampered with or moved to another record', async () => {
    await createVault(MASTER, FAST);
    const a = await saveEntry({ ...draft, title: 'A' });
    const b = await saveEntry({ ...draft, title: 'B' });
    const c = await saveEntry({ ...draft, title: 'C' });
    const rowA = await db.table('accounts_entry').get(a);
    const rowB = await db.table('accounts_entry').get(b);
    // swap A's ciphertext into B's record; flip a character in C
    await db.table('accounts_entry').put({ ...rowB, data: rowA.data });
    const rowC = await db.table('accounts_entry').get(c);
    await db
      .table('accounts_entry')
      .put({ ...rowC, data: rowC.data.slice(0, -3) + (rowC.data.endsWith('AAA') ? 'BBB' : 'AAA') });
    const result = await decryptAll();
    expect(result.filter(isReadable).map((e) => e.data.title)).toEqual(['A']);
    expect(
      result
        .filter((e) => !isReadable(e))
        .map((e) => e.id)
        .sort(),
    ).toEqual([b, c].sort());
  });

  it('cannot read entries of another vault (e.g. created in parallel on a second device)', async () => {
    await createVault(MASTER, FAST);
    await saveEntry(draft);
    lockVault();
    await db.table('accounts_vault').clear(); // header replaced by a different vault
    await createVault('Zweiter-Tresor-Passwort', FAST);
    const [entry] = await decryptAll();
    expect(isReadable(entry!)).toBe(false);
  });
});

describe('master password change', () => {
  it('re-wraps the key: entries stay readable with the new password only', async () => {
    await createVault(MASTER, FAST);
    await saveEntry(draft);
    const before = (await db.table('accounts_entry').toArray())[0].data;
    expect(await codeOf(changeMasterPassword('falsch-falsch-1', 'Neues-Passwort-123', FAST))).toBe(
      'wrong-password',
    );
    expect(await codeOf(changeMasterPassword(MASTER, 'kurz', FAST))).toBe('weak-password');
    await changeMasterPassword(MASTER, 'Neues-Passwort-123', FAST);
    expect((await db.table('accounts_entry').toArray())[0].data).toBe(before); // ciphertext untouched
    lockVault();
    expect(await codeOf(unlockVault(MASTER))).toBe('wrong-password');
    await unlockVault('Neues-Passwort-123');
    expect(await decryptAll()).toHaveLength(1);
  });
});

describe('what leaves the vault', () => {
  it('never puts plaintext into backups or onto the sync server', async () => {
    await createVault(MASTER, FAST);
    await saveEntry(draft);
    await saveEntry({ ...draft, title: 'Zweiter Eintrag', password: 'anderes-geheimes-passwort' });

    const backup = serializeBackup(await createBackup());
    expect(backup).toContain('accounts_entry'); // it IS in the backup …
    for (const secret of [...SECRETS, 'Zweiter Eintrag', 'anderes-geheimes-passwort', MASTER]) {
      expect(backup, secret).not.toContain(secret); // … but only as ciphertext
    }

    const server = new MemoryServer();
    await runSync({ storage: new DexieStorageAdapter(db), adapter: server.adapter() });
    const dump = JSON.stringify(server.dump());
    expect(dump).toContain('accounts_entry');
    expect(dump).toContain('v1.');
    for (const secret of [...SECRETS, 'Zweiter Eintrag', 'anderes-geheimes-passwort', MASTER]) {
      expect(dump, secret).not.toContain(secret);
    }
  });

  it('logs nothing through the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      await createVault(MASTER, FAST);
      const id = await saveEntry(draft);
      lockVault();
      await unlockVault('falsch-falsch-1').catch(() => undefined);
      await unlockVault(MASTER);
      await saveEntry({ ...draft, password: 'x-y-z-123' }, id);
      await decryptAll();
      for (const s of spies) expect(s).not.toHaveBeenCalled();
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});
