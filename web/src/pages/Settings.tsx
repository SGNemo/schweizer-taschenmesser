import { useModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
import type { ModuleManifest, SettingField } from '@/core/modules/types';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { useUiStore, type ThemeChoice } from '@/stores/ui';
import { Card, SelectField, Switch, TextField } from '@/ui';
import styles from './Page.module.css';

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

export function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const states = useModuleStates();
  const withSettings = visibleManifests.filter(
    (m) => states?.[m.id] && m.settings.fields.length > 0,
  );

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
