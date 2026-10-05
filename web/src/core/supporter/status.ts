import { useEffect, useState } from 'react';
import type { SupporterTier } from '@nemo/supporter-codes';
import { today } from '@/core/time/now';
import { setSettings } from '@/core/settings/settings';
import { loadDevSupporter, type SupporterOverride } from './dev';
import { SUPPORTER_SCOPE, useSupporterSettings, type SupporterSettings } from './settings';
import { acceptCode, checkCode } from './verify';

export interface SupporterStatus {
  tier: SupporterTier | 'none';
  name: string;
  issued: string;
  /** 'code' = a verified code, 'dev' = Dev-Preview simulation, 'none' = not a supporter. */
  source: 'code' | 'dev' | 'none';
  /** A code is stored but this app version does not accept it (e.g. a newer key id). */
  unrecognised: boolean;
}

export const NO_SUPPORTER: SupporterStatus = {
  tier: 'none',
  name: '',
  issued: '',
  source: 'none',
  unrecognised: false,
};

/** Pure: status from the stored code and the (Dev-Preview only) override. */
export function deriveStatus(
  code: string,
  override: SupporterOverride = undefined,
): SupporterStatus {
  if (override !== undefined) {
    return override === 'none'
      ? NO_SUPPORTER
      : { tier: override, name: '', issued: '', source: 'dev', unrecognised: false };
  }
  if (!code) return NO_SUPPORTER;
  const info = checkCode(code);
  return info
    ? { ...info, source: 'code', unrecognised: false }
    : { ...NO_SUPPORTER, unrecognised: true };
}

/** Dev-Preview: follows the simulation setting; stable builds always get `undefined`. */
function useDevOverride(): SupporterOverride {
  const [override, setOverride] = useState<SupporterOverride>(undefined);
  useEffect(() => {
    if (!loadDevSupporter) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void loadDevSupporter().then((dev) => {
      if (cancelled) return;
      stop = dev.watchSimulation((sim) => setOverride(dev.overrideOf(sim)));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return override;
}

export function useSupporter(): SupporterStatus {
  const [settings] = useSupporterSettings();
  const override = useDevOverride();
  return deriveStatus(settings?.code ?? '', override);
}

/** Verifies, then stores the canonical code. `false` = not accepted (nothing is stored). */
export async function enterCode(input: string): Promise<boolean> {
  const accepted = acceptCode(input);
  if (!accepted) return false;
  await setSettings(SUPPORTER_SCOPE, { code: accepted.code, addedAt: today() });
  return true;
}

export async function removeCode(): Promise<void> {
  await setSettings(SUPPORTER_SCOPE, { code: '', addedAt: '' });
}

export async function updateSupporterPrefs(
  patch: Partial<Pick<SupporterSettings, 'showSidebarBadge' | 'hideSetupHint'>>,
): Promise<void> {
  await setSettings(SUPPORTER_SCOPE, patch);
}
