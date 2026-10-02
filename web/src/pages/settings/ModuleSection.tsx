import { CopySchemaButton } from '@/core/dataapi/CopySchemaButton';
import { hasStartData, importersOf } from '@/core/dataapi/onboarding';
import { JSON_IMPORTER_ID } from '@/core/dataapi/importer';
import { StartDataButton } from '@/core/importer/StartDataButton';
import type { ModuleManifest, SettingField } from '@/core/modules/types';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Segmented, SelectField, SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import styles from './settings.module.css';

/** Short option lists read better as a segmented control than as a select. */
const prefersSegmented = (f: SettingField) =>
  f.type === 'select' &&
  f.options !== undefined &&
  f.options.length <= 4 &&
  f.options.every((o) => o.label.length <= 14);

function FieldRow({
  sectionId,
  field: f,
  value,
  onChange,
}: {
  sectionId: string;
  field: SettingField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `${sectionId}--${f.key}`;
  let control;
  if (f.type === 'boolean') {
    control = <Switch label={f.label} labelHidden checked={Boolean(value)} onChange={onChange} />;
  } else if (f.type === 'select' && prefersSegmented(f)) {
    control = (
      <Segmented
        label={f.label}
        value={String(value ?? '')}
        options={f.options ?? []}
        onChange={onChange}
      />
    );
  } else if (f.type === 'select') {
    control = (
      <SelectField
        label={f.label}
        labelHidden
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      >
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
    );
  } else {
    control = (
      <TextField
        label={f.label}
        labelHidden
        type={f.type === 'number' ? 'number' : 'text'}
        defaultValue={String(value ?? '')}
        onBlur={(e) => onChange(f.type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    );
  }
  return (
    <SettingRow id={id} label={f.label} description={f.help}>
      {control}
    </SettingRow>
  );
}

/** One module's settings (declared in `manifest.settings.fields`, stored in scope `module.<id>`) plus its start-data actions. */
export function ModuleSection({ manifest }: { manifest: ModuleManifest }) {
  const { schema, defaults, fields } = manifest.settings;
  const [values, patch] = useSettings(`module.${manifest.id}`, schema, defaults);
  if (!values) return null;
  const v = values as Record<string, unknown>;
  const sectionId = `module-${manifest.id}`;
  const startData = hasStartData(manifest);
  return (
    <SettingsGroup id={sectionId} title={manifest.name}>
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          sectionId={sectionId}
          field={f}
          value={v[f.key]}
          onChange={(value) => void patch({ [f.key]: value })}
        />
      ))}
      {startData ? (
        <SettingRow id={`${sectionId}--startdata`} label={t.onboarding.button}>
          <span className={styles.row}>
            {importersOf(manifest).some((i) => i.id === JSON_IMPORTER_ID) ? (
              <CopySchemaButton manifest={manifest} />
            ) : null}
            <StartDataButton moduleId={manifest.id} />
          </span>
        </SettingRow>
      ) : null}
    </SettingsGroup>
  );
}
