import { useState } from 'react';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { hasImporters } from '@/core/importer/OnboardingWizard';
import { useModuleStates } from '@/core/modules/activation';
import type { NotificationPermissionState } from '@/core/notifications/service';
import { getPlatform } from '@/core/platform';
import { visibleManifests } from '@/core/modules/registry';
import type { ModuleManifest, SettingField } from '@/core/modules/types';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { useUiStore, type ThemeChoice } from '@/stores/ui';
import { Button, Card, HelpHint, SelectField, Switch, TextField } from '@/ui';
import { AiSection } from './settings/AiSection';
import { BackupSection } from './settings/BackupSection';
import { PushSection } from './settings/PushSection';
import { SyncSection } from './settings/SyncSection';
import { UpdateSection } from './settings/UpdateSection';
import styles from './Page.module.css';

function SectionTitle({ id, hint, children }: { id: string; hint?: string; children: string }) {
  return (
    <div className={styles.titleRow}>
      <h2 id={id}>{children}</h2>
      {hint ? <HelpHint text={hint} label={t.help.label} /> : null}
    </div>
  );
}

function ModuleSettingsForm({ manifest }: { manifest: ModuleManifest }) {
  const { schema, defaults, fields } = manifest.settings;
  const [values, patch] = useSettings(`module.${manifest.id}`, schema, defaults);
  if (!values) return null;
  const v = values as Record<string, unknown>;

  const render = (f: SettingField) => {
    if (f.type === 'boolean') {
      return (
        <Switch
          key={f.key}
          label={f.label}
          hint={f.help}
          checked={Boolean(v[f.key])}
          onChange={(c) => void patch({ [f.key]: c })}
        />
      );
    }
    if (f.type === 'select') {
      return (
        <SelectField
          key={f.key}
          label={f.label}
          hint={f.help}
          value={String(v[f.key] ?? '')}
          onChange={(e) => void patch({ [f.key]: e.target.value })}
        >
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      );
    }
    return (
      <TextField
        key={f.key}
        label={f.label}
        hint={f.help}
        type={f.type === 'number' ? 'number' : 'text'}
        defaultValue={String(v[f.key] ?? '')}
        onBlur={(e) =>
          void patch({ [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })
        }
      />
    );
  };

  return (
    <Card title={manifest.name}>
      <div className={styles.form}>{fields.map(render)}</div>
    </Card>
  );
}

function NotificationsCard() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getPlatform().notifications.permission(),
  );
  return (
    <Card>
      <div className={styles.form}>
        <p>{t.notifications.intro}</p>
        <p role="status" data-testid="notification-status">
          {t.notifications[permission]}
        </p>
        {permission === 'default' ? (
          <Button
            variant="primary"
            onClick={async () =>
              setPermission(await getPlatform().notifications.requestPermission())
            }
          >
            {t.notifications.enable}
          </Button>
        ) : null}
        {permission === 'granted' ? (
          <Button
            onClick={() =>
              void getPlatform().notifications.show({
                title: t.appName,
                body: t.notifications.testBody,
                tag: 'test',
              })
            }
          >
            {t.notifications.test}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const states = useModuleStates();
  const withSettings = visibleManifests.filter(
    (m) => states?.[m.id] && m.settings.fields.length > 0,
  );

  const withStartData = visibleManifests.filter((m) => states?.[m.id] && hasImporters(m));

  return (
    <>
      <div className={styles.header}>
        <h1>{t.settings.title}</h1>
      </div>
      <section className={styles.section} aria-labelledby="appearance">
        <h2 id="appearance">{t.settings.appearance}</h2>
        <Card>
          <SelectField
            label={t.settings.theme}
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeChoice)}
          >
            <option value="system">{t.settings.themeSystem}</option>
            <option value="light">{t.settings.themeLight}</option>
            <option value="dark">{t.settings.themeDark}</option>
          </SelectField>
        </Card>
      </section>
      <section className={styles.section} aria-labelledby="notifications">
        <h2 id="notifications">{t.notifications.title}</h2>
        <NotificationsCard />
        <PushSection />
      </section>
      <section className={styles.section} aria-labelledby="ai">
        <SectionTitle id="ai" hint={t.help.aiRouter}>
          {t.ai.title}
        </SectionTitle>
        <AiSection />
      </section>
      <section className={styles.section} aria-labelledby="sync">
        <SectionTitle id="sync" hint={t.help.sync}>
          {t.sync.title}
        </SectionTitle>
        <SyncSection />
      </section>
      <section className={styles.section} aria-labelledby="backup">
        <h2 id="backup">{t.backup.title}</h2>
        <BackupSection />
      </section>
      <section className={styles.section} aria-labelledby="updates">
        <SectionTitle id="updates" hint={t.help.updateChannel}>
          {t.update.title}
        </SectionTitle>
        <UpdateSection />
      </section>
      {withStartData.length > 0 ? (
        <section className={styles.section} aria-labelledby="startdata">
          <h2 id="startdata">{t.onboarding.button}</h2>
          <Card>
            <ul className={styles.list}>
              {withStartData.map((m) => (
                <li key={m.id} className={styles.startRow}>
                  <span>{m.name}</span>
                  <StartDataButton moduleId={m.id} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
      <section className={styles.section} aria-labelledby="modules">
        <h2 id="modules">{t.settings.modules}</h2>
        {states && withSettings.length === 0 ? <p>{t.settings.noModuleSettings}</p> : null}
        {withSettings.map((m) => (
          <ModuleSettingsForm key={m.id} manifest={m} />
        ))}
      </section>
    </>
  );
}
