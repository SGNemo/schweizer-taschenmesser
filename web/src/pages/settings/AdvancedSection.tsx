import { useComfortSettings } from '@/core/settings/comfort';
import { tAdvanced } from '@/strings.advanced';
import { SettingRow, SettingsGroup, Switch } from '@/ui';

/** Settings → Darstellung → "Basis oder Erweitert": one switch for all modules (synced scope `comfort`). */
export function AdvancedSection() {
  const [values, patch] = useComfortSettings();
  const tx = tAdvanced.use().settings;
  return (
    <SettingsGroup id="advanced" title={tx.title} description={tx.description}>
      <SettingRow id="advanced--advancedAll" label={tx.all} description={tx.allHint}>
        <Switch
          label={tx.all}
          labelHidden
          checked={values.advancedAll}
          onChange={(v) => void patch({ advancedAll: v })}
        />
      </SettingRow>
    </SettingsGroup>
  );
}
