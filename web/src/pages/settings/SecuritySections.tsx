import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLocalApiConfig, isExpired } from '@/core/localapi/config';
import { getPlatform } from '@/core/platform';
import { SCREEN_GUARDS, setSecurityPrefs, useSecurityPrefs } from '@/core/security/prefs';
import { settingsPath } from '@/core/settings/registry/paths';
import type { SettingsCategoryId } from '@/core/settings/registry/types';
import { loadPairs } from '@/core/share/pairs';
import { useSyncLine } from '@/core/status/lines';
import { useBridgeConfig } from '@/core/vaultbridge/config';
import { tSecurity } from '@/strings.security';
import { Segmented, SettingRow, SettingsGroup, Switch } from '@/ui';
import { useSettingsSections } from './useSections';
import styles from './SecuritySections.module.css';

/**
 * Einstellungen → Sicherheit → "Schutz auf diesem Gerät": screen guard (Android only, where the
 * flag exists), "Nur verschlüsselte Backups" and the way to see a bug report before it is saved.
 * Every value is device-local (`core/security/prefs.ts`).
 */
export function ProtectSection() {
  const s = tSecurity.use().protect;
  const prefs = useSecurityPrefs();
  const android = getPlatform().kind === 'android';
  return (
    <SettingsGroup id="security-protect" title={s.title}>
      {android ? (
        <SettingRow id="security-protect--screen" label={s.screen} description={s.screenHint}>
          <Segmented
            label={s.screen}
            value={prefs.screenGuard}
            options={SCREEN_GUARDS.map((value) => ({
              value,
              label: value === 'vault' ? s.screenVault : s.screenEverywhere,
            }))}
            onChange={(screenGuard) => setSecurityPrefs({ screenGuard })}
          />
        </SettingRow>
      ) : null}
      <SettingRow
        id="security-protect--encryptedOnly"
        label={s.encryptedOnly}
        description={s.encryptedOnlyHint}
        hint={s.encryptedOnlyHelp}
      >
        <Switch
          label={s.encryptedOnly}
          labelHidden
          checked={prefs.encryptedOnly}
          onChange={(encryptedOnly) => setSecurityPrefs({ encryptedOnly })}
        />
      </SettingRow>
      <SettingRow id="security-protect--report" label={s.report} description={s.reportHint}>
        <Link className={styles.link} to={settingsPath('ueber', 'diagnostics')}>
          {s.reportOpen}
        </Link>
      </SettingRow>
    </SettingsGroup>
  );
}

interface AccessRow {
  id: string;
  label: string;
  state: string;
  category: SettingsCategoryId;
  section: string;
}

/** One native read per mount; `undefined` while it runs or where the platform has no such part. */
function useNative<T>(read: (() => Promise<T>) | undefined): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let live = true;
    read?.()
      .then((v) => live && setValue(v))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // One read per mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/**
 * Einstellungen → Sicherheit → "Zugriff auf dieses Gerät": what is connected right now (sync, paired
 * devices on the home network, remote control, local API, browser extension, share pairs), read-only.
 * Each row leads to the section where that access is ended; a row shows only where its section is
 * visible, so it never leads nowhere. Counts only: no names, tokens or addresses.
 */
export function AccessSection() {
  const s = tSecurity.use().access;
  const visible = useSettingsSections();
  const shown = useMemo(() => new Set(visible.map((v) => v.id)), [visible]);
  const platform = getPlatform();
  const sync = useSyncLine();
  const hub = useNative(platform.lanHub.supported ? () => platform.lanHub.status() : undefined);
  const remote = useNative(
    platform.remoteHost.supported ? () => platform.remoteHost.status() : undefined,
  );
  const pairs = useNative(() => loadPairs());
  const api = useLocalApiConfig();
  const bridge = useBridgeConfig();

  const rows: AccessRow[] = [];
  rows.push({ id: 'sync', label: s.sync, state: sync.status, category: 'sync', section: 'sync' });
  if (platform.lanHub.supported)
    rows.push({
      id: 'lan',
      label: s.lan,
      state: !hub
        ? s.loading
        : !hub.running
          ? s.off
          : hub.devices === 0
            ? s.none
            : s.devices(hub.devices),
      category: 'sync',
      section: 'sync',
    });
  if (platform.remoteHost.supported) {
    const granted = remote?.devices.filter((d) => d.level !== 'off' && !d.paused).length ?? 0;
    rows.push({
      id: 'remote',
      label: s.remote,
      state: !remote ? s.loading : !remote.enabled ? s.off : s.remoteOn(granted),
      category: 'verbindungen',
      section: 'remote',
    });
  }
  if (platform.localApi.supported) {
    const live = api?.tokens.filter((tk) => !isExpired(tk)).length ?? 0;
    rows.push({
      id: 'localapi',
      label: s.localApi,
      state: !api ? s.loading : !api.enabled ? s.off : s.tokens(live),
      category: 'verbindungen',
      section: 'localapi',
    });
  }
  if (platform.vaultBridge.supported)
    rows.push({
      id: 'extension',
      label: s.extension,
      state: !bridge ? s.loading : !bridge.enabled ? s.off : s.browsers(bridge.paired.length),
      category: 'verbindungen',
      section: 'browser-extension',
    });
  rows.push({
    id: 'share',
    label: s.share,
    state: !pairs ? s.loading : pairs.length === 0 ? s.none : s.pairs(pairs.length),
    category: 'verbindungen',
    section: 'share',
  });

  return (
    <SettingsGroup id="security-access" title={s.title} description={s.description} hint={s.hint}>
      <div data-testid="security-access">
        {rows
          .filter((r) => shown.has(r.section))
          .map((r) => (
            <SettingRow
              key={r.id}
              id={`security-access--${r.id}`}
              label={r.label}
              description={r.state}
            >
              <Link
                className={styles.link}
                to={settingsPath(r.category, r.section)}
                aria-label={s.manageAria(r.label)}
              >
                {s.manage}
              </Link>
            </SettingRow>
          ))}
      </div>
    </SettingsGroup>
  );
}
