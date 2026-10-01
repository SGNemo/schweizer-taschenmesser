import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createSeedContext } from '@/core/seed/context';
import { DEMO_PASSPHRASE as CORE_PASSPHRASE } from '@/core/seed/dev';
import type { SeedModule } from '@/core/seed/types';
import rawSeedModule, { DEMO_ENTRIES, DEMO_PASSPHRASE } from '../seed';
import { entryRepo, vaultRepo } from '../repo';
import { getSession } from '../session';
import {
  createVault,
  decryptAll,
  isReadable,
  lockVault,
  resetAttempts,
  unlockVault,
} from '../vault';

const seedModule: SeedModule = rawSeedModule;
const ctx = createSeedContext({ moduleId: 'accounts', today: '2026-09-29', scale: 'medium' });

async function clear() {
  lockVault();
  resetAttempts();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  await db.table('_outbox').clear();
}
beforeEach(clear);
afterAll(clear);

describe('accounts seed', () => {
  it('keeps the passphrase in step with the runner', () => {
    expect(DEMO_PASSPHRASE).toBe(CORE_PASSPHRASE);
  });

  it('has no plain rows', () => {
    expect(seedModule.seed(ctx)).toEqual({});
  });

  it('creates a demo vault whose entries decrypt with the passphrase', async () => {
    const created = await seedModule.afterSeed!(ctx);
    expect(created).toHaveLength(2);
    expect(created![0]).toEqual({ collection: 'vault', ids: ['vault'] });
    expect(created![1]!.ids).toHaveLength(DEMO_ENTRIES.length);
    expect(getSession().status).toBe('locked');
    for (const id of created![1]!.ids) expect(await entryRepo.get(id)).toBeTruthy();

    await unlockVault(DEMO_PASSPHRASE);
    const all = await decryptAll();
    expect(all.every(isReadable)).toBe(true);
    expect(
      all
        .filter(isReadable)
        .map((e) => e.data.title)
        .sort(),
    ).toEqual(DEMO_ENTRIES.map((e) => e.title).sort());
  }, 60_000);

  it('does nothing when a vault already exists', async () => {
    await createVault('Eigenes-Master-Passwort', { m: 64, t: 1, p: 1 });
    const before = await vaultRepo.get('vault');
    lockVault();
    expect(await seedModule.afterSeed!(ctx)).toEqual([]);
    expect(await vaultRepo.get('vault')).toEqual(before);
    expect(await entryRepo.active().count()).toBe(0);
  });

  it('beforeRemove locks the session', async () => {
    await createVault('Eigenes-Master-Passwort', { m: 64, t: 1, p: 1 });
    await seedModule.beforeRemove!();
    expect(getSession().status).toBe('locked');
  });
});
