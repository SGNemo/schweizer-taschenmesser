import { CopySchemaButton } from '@/core/dataapi/CopySchemaButton';
import { hasStartData, importersOf } from '@/core/dataapi/onboarding';
import { JSON_IMPORTER_ID } from '@/core/dataapi/importer';
import { StartDataButton } from '@/core/importer/StartDataButton';
import type { ModuleManifest, SettingField } from '@/core/modules/types';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Segmented, SelectField, SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import { FoldedGroup } from './FoldedGroup';
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

const MAX_SHOWN = 3;

/** What the closed line says for one field: the option label, the label of a switch that is on, or the value; `undefined` = nothing to say. */
function fieldSummary(f: SettingField, value: unknown): string | undefined {
  if (f.type === 'boolean') return value ? f.label : undefined;
  if (f.type === 'select') return f.options?.find((o) => o.value === String(value))?.label;
  const text = String(value ?? '');
  return text === '' ? undefined : text;
}

/** The current values in field order, at most three, then "+ n". */
export function fieldsLine(fields: SettingField[], values: Record<string, unknown>): string[] {
  const all = fields.flatMap((f) => fieldSummary(f, values[f.key]) ?? []);
  const rest = all.length - MAX_SHOWN;
  return rest > 0 ? [...all.slice(0, MAX_SHOWN), t.settings.moduleGroups.more(rest)] : all;
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
      {fields.length > 0 ? (
        <FoldedGroup
          section={sectionId}
          id="fields"
          title={t.settings.moduleGroups.fields}
          current={fieldsLine(fields, v)}
        >
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              sectionId={sectionId}
              field={f}
              value={v[f.key]}
              onChange={(value) => void patch({ [f.key]: value })}
            />
          ))}
        </FoldedGroup>
      ) : null}
      {startData ? (
        <SettingRow id={`${sectionId}--startdata`} label={t.onboarding.button}>
          <span className={styles.row}>
            {importersOf(manifest).some((i) => i.id === JSON_IMPORTER_ID) ? (
              <CopySchemaButton manifest={manifest} />
            ) : null}
            <StartDataButton moduleId={manifest.id} setupLink={false} />
          </span>
        </SettingRow>
      ) : null}
    </SettingsGroup>
  );
}
