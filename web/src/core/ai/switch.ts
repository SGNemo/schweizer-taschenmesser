/**
 * Master switch "KI abschalten" (Einstellungen → KI): removes every AI surface and connection from the app.
 * Off means: no assistant entries, no "Mit KI eintragen", no AI settings or setup steps, no outgoing provider
 * calls, no local AI import API. Turning it off deletes the stored provider keys, the cache and the usage statistics
 * and revokes the API tokens; turning it on again starts from a clean, unconfigured state.
 *
 * Scope: this device (`tm-ai-off` in localStorage, like the keys) or all devices of the account (synced setting
 * `ai.switch`). Every device that sees "off" runs `purgeAi()` itself, because keys never leave a device.
 */
import { create } from 'zustand';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { loadConfig, revokeToken, updateConfig } from '@/core/localapi/config';
import { getPlatform } from '@/core/platform';
import type { SecretStore } from '@/core/secrets/types';
import { getSettings, setSettings, useSettings } from '@/core/settings/settings';
import { clearAiCache } from './cache';
import { defaultAiConfig, loadAiConfig, removeProvider, saveAiConfig } from './config';
import { resetUsage } from './usage';

export const AI_SWITCH_SCOPE = 'ai.switch';
export const aiSwitchSchema = z.object({ off: z.boolean().default(false) });
const DEVICE_KEY = 'tm-ai-off';

function readDeviceOff(): boolean {
  try {
    return localStorage.getItem(DEVICE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDeviceOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(DEVICE_KEY, '1');
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Storage may be blocked; the choice still applies for this session.
  }
  useDeviceFlag.setState({ off });
}

const useDeviceFlag = create<{ off: boolean }>(() => ({ off: readDeviceOff() }));

/** Is AI allowed on this device right now? (Non-React callers.) */
export async function isAiOn(): Promise<boolean> {
  if (readDeviceOff()) return false;
  return !(await getSettings(AI_SWITCH_SCOPE, aiSwitchSchema, {})).off;
}

/** Live: is AI allowed right now? While the synced value loads it counts as on. */
export function useAiOn(): boolean {
  const device = useDeviceFlag((s) => s.off);
  const [synced] = useSettings(AI_SWITCH_SCOPE, aiSwitchSchema, {});
  return !device && !(synced?.off ?? false);
}

/** Which switch is off, for the settings text. */
export function useAiOffScope(): 'device' | 'all' | null {
  const device = useDeviceFlag((s) => s.off);
  const [synced] = useSettings(AI_SWITCH_SCOPE, aiSwitchSchema, {});
  if (synced?.off) return 'all';
  return device ? 'device' : null;
}

/** Deletes everything AI left on this device. Idempotent. */
export async function purgeAi(
  database: TaschenmesserDB = defaultDb,
  secrets: SecretStore = getPlatform().secrets,
): Promise<void> {
  let config = await loadAiConfig(database, secrets);
  for (const p of config.providers) config = await removeProvider(config, p.id, database, secrets);
  await saveAiConfig(defaultAiConfig(), database);
  await clearAiCache(database);
  await resetUsage(database);
  // The local AI import API: stop it and revoke every token.
  const api = await loadConfig(database);
  for (const token of api.tokens) await revokeToken(token.id, database);
  if (api.enabled) await updateConfig({ enabled: false }, database);
}

/** Turns AI off for this device or for all devices of the account, and deletes keys and caches here at once. */
export async function switchAiOff(scope: 'device' | 'all'): Promise<void> {
  if (scope === 'all') await setSettings(AI_SWITCH_SCOPE, { off: true });
  else writeDeviceOff(true);
  await purgeAi();
}

/** Turns AI on again everywhere it was off; nothing is configured afterwards. */
export async function switchAiOn(): Promise<void> {
  writeDeviceOff(false);
  await setSettings(AI_SWITCH_SCOPE, { off: false });
}
