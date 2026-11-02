import { useComfortSettings } from '@/core/settings/comfort';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tAdvanced } from '@/strings.advanced';
import { SettingRow, SettingsGroup, Switch } from '@/ui';

/**
 * Settings → Darstellung → "Basis oder Erweitert": one switch for all modules (synced scope
 * `comfort`) and "In Arbeit anzeigen" (device-local, `stores/ui.ts`), which lists what still has
 * `maturity: 'preview'`.
 */
export function AdvancedSection() {
  const [values, patch] = useComfortSettings();
  const tx = tAdvanced.use().settings;
  const showPreview = useUiStore((s) => s.showPreview);
  const setShowPreview = useUiStore((s) => s.setShowPreview);
  const tm = t.settings.maturity;
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
      <SettingRow id="advanced--showPreview" label={tm.show} description={tm.showHint}>
        <Switch label={tm.show} labelHidden checked={showPreview} onChange={setShowPreview} />
      </SettingRow>
    </SettingsGroup>
  );
}
