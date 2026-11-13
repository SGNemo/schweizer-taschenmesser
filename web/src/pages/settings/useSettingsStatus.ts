import { useEffect, useState } from 'react';
import { useAiOn } from '@/core/ai/switch';
import { isEntryUsable, useAiConfig } from '@/core/ai/config';
import { useUsageRows } from '@/core/ai/usage';
import { formatNumber } from '@/core/i18n/format';
import { useModuleStates } from '@/core/modules/activation';
import { categoryDef } from '@/core/settings/registry/categories';
import { useDeviceLines, type StatusLine } from '@/core/status/lines';
import { deviceStatusLine } from '@/core/status/summary';
import { now } from '@/core/time/now';
import { loadAccountsSettings } from '@/modules/accounts/autolock';
import { useSession } from '@/modules/accounts/session';
import { tSettings2 } from '@/strings.settings2';
import { tSettingsV3 } from '@/strings.settingsV3';

export type StatusTile = StatusLine;

/**
 * The states of the status head: security, sync, backup, updates, AI, storage. Sync, backup, updates and storage are
 * the lines of `core/status` (the page "Gerätestatus" shows the same ones). While the module `device` is switched on
 * on this device, those four are one line that leads to its page (module package S-b: no state twice); with the
 * module off, which is every installation that did not start with it, the head is as it was.
 */
export function useSettingsStatus(): StatusTile[] {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();

  const states = useModuleStates();
  const vaultOn = states?.accounts === true;
  const deviceOn = states?.device === true;
  const session = useSession((s) => s.session);
  const [minutes, setMinutes] = useState<string>();
  useEffect(() => {
    // The read finishes later; an unmounted head (or a finished test) must not get the state update.
    let live = true;
    if (vaultOn) void loadAccountsSettings().then((s) => live && setMinutes(s.autoLockMinutes));
    return () => {
      live = false;
    };
  }, [vaultOn]);

  const device = useDeviceLines();

  const aiOn = useAiOn();
  const config = useAiConfig();
  const rows = useUsageRows();
  const providers = config ? config.providers.filter(isEntryUsable).length : 0;
  const since = new Date(now()).setHours(0, 0, 0, 0);
  const tokens = (rows ?? [])
    .filter((r) => r.at >= since)
    .reduce((n, r) => n + r.inputTokens + r.outputTokens, 0);
  const aiStatus = !aiOn ? o.ai.off : providers === 0 ? o.ai.none : o.ai.providers(providers);
  const aiContext =
    !aiOn || providers === 0
      ? categoryDef('ki').description
      : tokens > 0
        ? o.ai.tokensToday(formatNumber(tokens))
        : o.ai.noTokens;

  const security: StatusTile = {
    id: 'security',
    // With the vault off the category does not exist: the module list is where it is switched on.
    to: vaultOn ? '/settings/sicherheit' : '/settings/module',
    icon: 'lock',
    title: v3.tiles.security,
    status: !vaultOn
      ? o.security.noVault
      : session.status === 'locked'
        ? o.security.locked
        : o.security.unlocked,
    context:
      vaultOn && minutes ? o.security.autoLock(minutes) : categoryDef('sicherheit').description,
    generic: !(vaultOn && minutes),
    attention: false,
    testId: 'overview-security',
  };
  const ai: StatusTile = {
    id: 'ai',
    to: '/settings/ki',
    icon: 'sparkles',
    title: v3.tiles.ai,
    status: aiStatus,
    context: aiContext,
    generic: !aiOn || providers === 0,
    attention: false,
    testId: 'overview-ai',
  };

  if (deviceOn)
    return [
      security,
      deviceStatusLine([device.sync, device.backup, device.updates, device.storage]),
      ai,
    ];
  return [security, device.sync, device.backup, device.updates, ai, device.storage];
}
