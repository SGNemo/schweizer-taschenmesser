/**
 * Settings of the browser extension bridge: on/off and which extension IDs the user confirmed.
 * Device-local (`_meta`, never synced, not in the backup): pairing belongs to this computer and its
 * browser registration. No secret is stored here – only extension IDs and a timestamp.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { rwTransaction } from '@/core/db/tx';
import { now } from '@/core/time/now';

const KEY = 'vaultBridge.config';

const configSchema = z.object({
  /** Off by default: nothing listens and no browser registration exists until the user turns it on. */
  enabled: z.boolean().default(false),
  paired: z
    .array(z.object({ id: z.string().regex(/^[a-p]{32}$/), pairedAt: z.number() }))
    .default([]),
});

export type VaultBridgeConfig = z.output<typeof configSchema>;
const DEFAULT_CONFIG: VaultBridgeConfig = { enabled: false, paired: [] };

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function loadBridgeConfig(
  database: TaschenmesserDB = defaultDb,
): Promise<VaultBridgeConfig> {
  const stored = (await meta(database).get(KEY))?.value;
  const parsed = configSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : { ...DEFAULT_CONFIG, paired: [] };
}

async function mutate(
  database: TaschenmesserDB,
  fn: (config: VaultBridgeConfig) => VaultBridgeConfig,
): Promise<VaultBridgeConfig> {
  return rwTransaction(database, [meta(database)], async () => {
    const clean = configSchema.parse(fn(await loadBridgeConfig(database)));
    await meta(database).put({ key: KEY, value: clean });
    return clean;
  });
}

export const setBridgeEnabled = (
  enabled: boolean,
  database: TaschenmesserDB = defaultDb,
): Promise<VaultBridgeConfig> => mutate(database, (c) => ({ ...c, enabled }));

export const isPaired = (config: VaultBridgeConfig, extensionId: string): boolean =>
  config.paired.some((p) => p.id === extensionId);

export const addPairedExtension = (
  id: string,
  database: TaschenmesserDB = defaultDb,
): Promise<VaultBridgeConfig> =>
  mutate(database, (c) =>
    isPaired(c, id) ? c : { ...c, paired: [...c.paired, { id, pairedAt: now() }] },
  );

export const removePairedExtension = (
  id: string,
  database: TaschenmesserDB = defaultDb,
): Promise<VaultBridgeConfig> =>
  mutate(database, (c) => ({ ...c, paired: c.paired.filter((p) => p.id !== id) }));

export function useBridgeConfig(): VaultBridgeConfig | undefined {
  return useLiveQuery(() => loadBridgeConfig(), []);
}
