/**
 * Wires the bridge handler to the app: default dependencies, switching the bridge on and off,
 * resuming it at startup (and refreshing the browser registration when the executable moved).
 * Only the desktop app has a `vaultBridge`; everywhere else every function here is a no-op.
 */
import { randomInt } from '@nemo/vault-core';
import { getPlatform } from '@/core/platform';
import type { VaultBridgeRegistration, VaultBridgeStartError } from '@/core/platform';
import { getSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import {
  addPairedExtension,
  isPaired,
  loadBridgeConfig,
  removePairedExtension,
  setBridgeEnabled,
} from '@/core/vaultbridge/config';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { defaultSettings, settingsSchema } from '../settings';
import { isUnlocked } from '../session';
import { decryptAll, isReadable, saveEntry } from '../vault';
import { createBridgeHandler, type BridgeDeps, type BridgeHandler } from './handler';
import { usePairingRequest } from './pairing';

const SCOPE = 'module.accounts';

function randomToken(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const settings = () => getSettings(SCOPE, settingsSchema, defaultSettings);

/** Opens the vault page so the user sees a pairing request (a no-op when already there). */
function showVault(): void {
  void getPlatform().desktop.showMain();
  if (location.pathname !== '/accounts') {
    history.pushState(null, '', '/accounts');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

const defaultDeps: BridgeDeps = {
  now,
  randomInt,
  randomToken,
  isUnlocked,
  originMode: async () => (await settings()).originMatch,
  generatorOptions: async () => {
    const s = await settings();
    return {
      length: Number(s.genLength),
      lower: true,
      upper: true,
      digits: true,
      symbols: s.genSymbols,
      avoidAmbiguous: s.genAvoidAmbiguous,
    };
  },
  isPaired: async (id) => isPaired(await loadBridgeConfig(), id),
  addPaired: async (id) => void (await addPairedExtension(id)),
  entries: async () => (await decryptAll()).filter(isReadable),
  save: saveEntry,
  onPairingChange(pending) {
    usePairingRequest.setState({ pending });
    if (pending) {
      useUiStore.getState().toast(t.accounts.bridge.pairingToast);
      showVault();
    }
  },
};

let handler: BridgeHandler | undefined;
export const getBridge = (): BridgeHandler => (handler ??= createBridgeHandler(defaultDeps));

/** For tests: a fresh handler (and, with `deps`, other dependencies). */
export function resetBridge(deps?: Partial<BridgeDeps>): BridgeHandler {
  handler = createBridgeHandler({ ...defaultDeps, ...deps });
  return handler;
}

const bridgeService = () => getPlatform().vaultBridge;

/** Starts the pipe server; the handler answers everything it relays. */
export async function startBridge(): Promise<VaultBridgeStartError | null> {
  const service = bridgeService();
  if (!service.supported) return null;
  return service.start((req) => getBridge().handle(req.body));
}

export async function stopBridge(): Promise<void> {
  getBridge().endSessions();
  const service = bridgeService();
  if (service.supported) await service.stop().catch(() => undefined);
}

export type EnableResult = 'ok' | VaultBridgeStartError | 'register-failed';

/** Settings switch on: register the host with the browsers, then listen. */
export async function enableBridge(): Promise<EnableResult> {
  const service = bridgeService();
  if (!service.supported) return 'failed';
  try {
    await service.register();
  } catch {
    return 'register-failed';
  }
  const error = await startBridge();
  if (error) return error;
  await setBridgeEnabled(true);
  return 'ok';
}

/** Settings switch off: stop listening, end sessions, remove the browser registration. */
export async function disableBridge(): Promise<void> {
  await stopBridge();
  await setBridgeEnabled(false);
  const service = bridgeService();
  if (service.supported) await service.unregister().catch(() => undefined);
}

export async function removeExtension(id: string): Promise<void> {
  getBridge().endSessions();
  await removePairedExtension(id);
}

export async function bridgeRegistration(): Promise<VaultBridgeRegistration | null> {
  const service = bridgeService();
  if (!service.supported) return null;
  return service.status().catch(() => null);
}

/** After a moved portable folder or a replaced executable the registered path is stale. */
export const needsReregistration = (r: VaultBridgeRegistration | null): boolean =>
  r !== null && (!r.upToDate || r.browsers.some((b) => !b.registered));

/**
 * Module service start: when the user switched the bridge on, listen again and repair a stale
 * browser registration (e.g. the portable app was moved).
 */
export async function resumeBridge(): Promise<void> {
  const service = bridgeService();
  if (!service.supported || !(await loadBridgeConfig()).enabled) return;
  const error = await startBridge();
  if (error) {
    useUiStore.getState().toast(t.accounts.bridge.startErrors[error]);
    return;
  }
  if (needsReregistration(await bridgeRegistration())) {
    await service.register().catch(() => undefined);
  }
}
