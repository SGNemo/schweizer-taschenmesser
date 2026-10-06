import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { settingsPath } from '@/core/settings/registry/paths';
import { buildChangelog, getAboutInfo, versionLabel, type AboutInfo } from '@/core/about/info';
import { exportDiagnostics } from '@/core/diagnostics/export';
import { getPlatform } from '@/core/platform';
import { RESET_PHRASE, resetDevice } from '@/core/reset/device';
import { checkForUpdate, useUpdateStore } from '@/core/update/controller';
import { notesPreview } from '@/core/update/notes';
import { getLastCheckAt } from '@/core/update/prefs';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, DangerZone, Logo, SettingRow, SettingsGroup, TypedConfirmDialog } from '@/ui';
import { SupporterBadge } from '@/layout/SupporterBadge';
import styles from './settings.module.css';

const a = t.about;

/** `getAboutInfo()` once, `undefined` until it has arrived. */
function useAboutInfo(): AboutInfo | undefined {
  const [info, setInfo] = useState<AboutInfo | undefined>();
  useEffect(() => {
    let alive = true;
    void getAboutInfo().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

function Value({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <strong data-testid={testId} className={styles.value}>
      {children}
    </strong>
  );
}

/** Logo, name and the facts of this installation (version, build, platform, data folder, licence). */
export function AboutSection() {
  const info = useAboutInfo();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  return (
    <SettingsGroup id="about" title={a.title}>
      <div className={styles.about}>
        <Logo size={64} title={t.appName} />
        <div>
          <p className={styles.aboutName}>{t.appName}</p>
          <p>{a.tagline}</p>
          <SupporterBadge placement="about" />
        </div>
      </div>
      <SettingRow
        id="about--support"
        label={t.supporter.aboutRow.label}
        description={t.supporter.aboutRow.description}
      >
        <Button onClick={() => void navigate(settingsPath('ueber', 'supporter'))}>
          {t.supporter.aboutRow.open}
        </Button>
      </SettingRow>
      <SettingRow id="about--version" label={a.version}>
        <Value testId="about-version">{info ? versionLabel(info) : '…'}</Value>
      </SettingRow>
      {info?.commit || info?.buildDate ? (
        <SettingRow id="about--build" label={a.build}>
          <Value>
            {[info.buildDate, info.commit && `${a.commit} ${info.commit}`]
              .filter(Boolean)
              .join(' · ')}
          </Value>
        </SettingRow>
      ) : null}
      <SettingRow id="about--channel" label={a.channel}>
        <Value>{info?.channel === 'dev' ? a.channelDev : a.channelStable}</Value>
      </SettingRow>
      {info ? (
        <>
          <SettingRow id="about--platform" label={a.platform}>
            <Value>{a.platforms[info.platform]}</Value>
          </SettingRow>
          <SettingRow id="about--install" label={a.install}>
            <Value>{a.installKinds[info.installKind]}</Value>
          </SettingRow>
          {info.dataDir ? (
            <SettingRow id="about--dataDir" label={a.dataDir} description={info.dataDir}>
              <Button
                onClick={() =>
                  void getPlatform()
                    .desktop.openDataDir()
                    .catch(() => toast(a.openDataDirFailed))
                }
              >
                {a.openDataDir}
              </Button>
            </SettingRow>
          ) : null}
        </>
      ) : null}
      <SettingRow id="about--license" label={a.license}>
        <Value>{a.licenseValue}</Value>
      </SettingRow>
    </SettingsGroup>
  );
}

function Notes({ markdown }: { markdown: string }) {
  const lines = notesPreview(markdown, 80);
  if (lines.length === 0) return <p className={styles.muted}>{a.updates.none}</p>;
  return (
    <div className={styles.notes}>
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

/** Last update check, "check now" and the changes of this and the available version (collapsed). */
export function AboutUpdatesSection() {
  const platform = getPlatform();
  const state = useUpdateStore((s) => s.state);
  const [last, setLast] = useState<number | undefined>();
  useEffect(() => {
    void getLastCheckAt().then(setLast);
  }, [state]);
  const changelog = buildChangelog();
  return (
    <SettingsGroup id="about-updates" title={a.updates.title}>
      {platform.updater.supported ? (
        <SettingRow
          id="about-updates--check"
          label={a.updates.lastCheck}
          description={last ? new Date(last).toLocaleString('de-DE') : a.updates.never}
        >
          <Button
            onClick={() => void checkForUpdate({ manual: true })}
            disabled={state.phase === 'checking' || state.phase === 'installing'}
          >
            {t.update.settings.checkNow}
          </Button>
        </SettingRow>
      ) : (
        <SettingRow label={t.update.title} description={a.updates.browser} />
      )}
      {state.phase === 'available' ? (
        <details className={styles.details}>
          <summary>{a.updates.available(state.info.version)}</summary>
          <Notes markdown={state.info.notes} />
        </details>
      ) : null}
      <details className={styles.details}>
        <summary>{a.updates.current}</summary>
        <Notes markdown={changelog} />
      </details>
    </SettingsGroup>
  );
}

const REPO = 'https://github.com/SGNemo/schweizer-taschenmesser';
const LINKS = [
  { key: 'repo', url: REPO },
  { key: 'releases', url: `${REPO}/releases` },
  { key: 'docs', url: `${REPO}/tree/main/docs/user` },
  { key: 'bugs', url: `${REPO}/issues/new/choose` },
] as const;

export function LinksSection() {
  return (
    <SettingsGroup id="links" title={a.links.title}>
      {LINKS.map((l) => (
        <SettingRow key={l.key} id={`links--${l.key}`} label={a.links[l.key]}>
          <Button onClick={() => void getPlatform().app.openUrl(l.url)}>{a.links.open}</Button>
        </SettingRow>
      ))}
    </SettingsGroup>
  );
}

export function DiagnosticsSection() {
  const toast = useUiStore((s) => s.toast);
  return (
    <SettingsGroup id="diagnostics" title={a.diagnostics.title}>
      <SettingRow
        id="diagnostics--export"
        label={a.diagnostics.label}
        description={a.diagnostics.description}
      >
        <Button
          onClick={() =>
            void exportDiagnostics().then((r) => r === 'saved' && toast(a.diagnostics.saved))
          }
        >
          {a.diagnostics.label}
        </Button>
      </SettingRow>
    </SettingsGroup>
  );
}

/** Irreversible: removes all local data. Typed confirmation, nothing happens before it. */
export function DeviceResetSection() {
  const [open, setOpen] = useState(false);
  return (
    <SettingsGroup id="device-reset" title={a.reset.title}>
      <DangerZone>
        <SettingRow id="device-reset--all" label={a.reset.label} description={a.reset.description}>
          <Button variant="danger" onClick={() => setOpen(true)}>
            {a.reset.label}
          </Button>
        </SettingRow>
      </DangerZone>
      <TypedConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={a.reset.dialogTitle}
        phrase={RESET_PHRASE}
        confirmLabel={a.reset.confirm}
        onConfirm={() => resetDevice()}
      >
        <p>{a.reset.warning}</p>
      </TypedConfirmDialog>
    </SettingsGroup>
  );
}
