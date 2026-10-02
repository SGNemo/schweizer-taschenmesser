import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import {
  addPairedExtension,
  isPaired,
  loadBridgeConfig,
  removePairedExtension,
  setBridgeEnabled,
} from './config';

const ID_A = 'a'.repeat(32);
const ID_B = 'b'.repeat(32);

beforeEach(async () => {
  setNow(() => 1_700_000_000_000);
  await db.table('_meta').clear();
});

describe('vault bridge config', () => {
  it('is off and has no paired extension by default', async () => {
    expect(await loadBridgeConfig()).toEqual({ enabled: false, paired: [] });
  });

  it('stores on/off and paired extension ids, nothing else', async () => {
    await setBridgeEnabled(true);
    await addPairedExtension(ID_A);
    await addPairedExtension(ID_A); // idempotent
    const config = await loadBridgeConfig();
    expect(config).toEqual({ enabled: true, paired: [{ id: ID_A, pairedAt: 1_700_000_000_000 }] });
    expect(isPaired(config, ID_A)).toBe(true);
    expect(isPaired(config, ID_B)).toBe(false);
  });

  it('removes a pairing again', async () => {
    await addPairedExtension(ID_A);
    await addPairedExtension(ID_B);
    await removePairedExtension(ID_A);
    expect((await loadBridgeConfig()).paired.map((p) => p.id)).toEqual([ID_B]);
  });

  it('rejects ids that are not extension ids', async () => {
    await expect(addPairedExtension('not-an-id')).rejects.toThrow();
  });

  it('is device-local: the row lives in _meta, which neither sync nor backup carries', async () => {
    await addPairedExtension(ID_A);
    expect(await db.table('_meta').get('vaultBridge.config')).toBeDefined();
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('falls back to the safe default when the stored row is damaged', async () => {
    await db
      .table('_meta')
      .put({ key: 'vaultBridge.config', value: { enabled: 'yes', paired: 5 } });
    expect(await loadBridgeConfig()).toEqual({ enabled: false, paired: [] });
  });
});
