import { useAiWriteSettings } from '@/core/ai/write/settings';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { t } from '@/strings';
import { SettingRow, SettingsGroup, Switch } from '@/ui';

/** Settings → KI → "Eintragen per KI": global switch, cloud fallback, asking, per-module switches. */
export function AiWriteSection() {
  const [v, patch] = useAiWriteSettings();
  const states = useModuleStates();
  const s = t.ai.writeSettings;
  if (!v) return null;
  const modules = availableManifests().filter(
    (m) => Object.keys(m.aiSchema?.actions ?? {}).length > 0 && states?.[m.id],
  );
  const toggleModule = (id: string, on: boolean) =>
    void patch({
      modulesOff: on ? v.modulesOff.filter((x) => x !== id) : [...new Set([...v.modulesOff, id])],
    });
  return (
    <SettingsGroup id="ai-write" title={s.title} description={s.description} hint={t.help.aiWrite}>
      <SettingRow id="ai-write--enabled" label={s.enabled} description={s.enabledHint}>
        <Switch
          label={s.enabled}
          labelHidden
          checked={v.enabled}
          onChange={(enabled) => void patch({ enabled })}
        />
      </SettingRow>
      {v.enabled ? (
        <>
          <SettingRow
            id="ai-write--cloud"
            label={s.cloud}
            description={s.cloudHint}
            hint={t.help.aiCloudWrite}
          >
            <Switch
              label={s.cloud}
              labelHidden
              checked={v.cloud}
              onChange={(cloud) => void patch({ cloud })}
            />
          </SettingRow>
          <SettingRow id="ai-write--askMissing" label={s.askMissing} hint={t.help.aiAskMissing}>
            <Switch
              label={s.askMissing}
              labelHidden
              checked={v.askMissing}
              onChange={(askMissing) => void patch({ askMissing })}
            />
          </SettingRow>
          <SettingRow id="ai-write--modules" label={s.modules} description={s.modulesHint} />
          {modules.length === 0 ? <p>{s.noModules}</p> : null}
          {modules.map((m) => (
            <SettingRow key={m.id} id={`ai-write--module-${m.id}`} label={m.name}>
              <Switch
                label={m.name}
                labelHidden
                checked={!v.modulesOff.includes(m.id)}
                onChange={(on) => toggleModule(m.id, on)}
              />
            </SettingRow>
          ))}
        </>
      ) : null}
    </SettingsGroup>
  );
}
