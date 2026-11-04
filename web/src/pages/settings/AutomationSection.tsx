import { availableManifests } from '@/core/modules/available';
import { useModuleStates } from '@/core/modules/activation';
import { applyAutomationSettings } from '@/core/automation';
import {
  AUTOMATION_DEFAULTS,
  useAutomationSettings,
  type AutomationSettings,
} from '@/core/automation/settings';
import {
  paramsOf,
  TEMPLATES,
  type ParamValue,
  type RuleTemplate,
} from '@/core/automation/templates';
import { TIME_RE } from '@/core/time/dates';
import { tAuto } from '@/strings.automation';
import { SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import { FoldedGroup } from './FoldedGroup';

const SECTION = 'automation';

/**
 * Settings → Benachrichtigungen → "Automatisierungen": the master switch, the dry-run switch, the
 * shared limit and one switch per template with its few parameters. Only existing parts
 * (`SettingRow`, `Switch`, `TextField`); the rules themselves are the templates, all off.
 */
export function AutomationSection() {
  const s = tAuto.use().settings;
  const [values, patch] = useAutomationSettings();
  const v: AutomationSettings = values ?? AUTOMATION_DEFAULTS;
  const states = useModuleStates();
  const names = new Map(availableManifests().map((m) => [m.id, m.name]));

  const save = (next: Partial<AutomationSettings>) =>
    void patch(next).then(() => applyAutomationSettings());

  const saveRule = (tpl: RuleTemplate, enabled: boolean, params: Record<string, ParamValue>) =>
    save({ rules: { ...v.rules, [tpl.id]: { enabled, params } } });

  return (
    <SettingsGroup id={SECTION} title={s.title} description={s.description}>
      <SettingRow id={`${SECTION}--enabled`} label={s.enabled} description={s.enabledHint}>
        <Switch
          label={s.enabled}
          labelHidden
          checked={v.enabled}
          onChange={(enabled) => save({ enabled })}
        />
      </SettingRow>
      {v.enabled && (
        <>
          <SettingRow id={`${SECTION}--dryRun`} label={s.dryRun} description={s.dryRunHint}>
            <Switch
              label={s.dryRun}
              labelHidden
              checked={v.dryRun}
              onChange={(dryRun) => save({ dryRun })}
            />
          </SettingRow>
          <FoldedGroup
            section={SECTION}
            id="templates"
            title={s.templates}
            current={TEMPLATES.filter((tpl) => v.rules[tpl.id]?.enabled).map((tpl) => tpl.title)}
          >
            <SettingRow id={`${SECTION}--globalPerHour`} label={s.limit} description={s.limitHint}>
              <TextField
                label={s.limit}
                labelHidden
                type="number"
                min={0}
                max={60}
                defaultValue={String(v.globalPerHour)}
                onBlur={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (Number.isFinite(n)) save({ globalPerHour: Math.min(60, Math.max(0, n)) });
                }}
              />
            </SettingRow>
            {TEMPLATES.map((tpl) => {
              const cfg = v.rules[tpl.id];
              const params = paramsOf(tpl, cfg?.params);
              const missing = tpl.modules.filter((m) => states && !states[m]);
              return (
                <div key={tpl.id}>
                  <SettingRow
                    id={`${SECTION}--${tpl.id}`}
                    label={tpl.title}
                    description={
                      missing.length > 0
                        ? `${tpl.description} ${s.needs(missing.map((m) => names.get(m) ?? m).join(', '))}`
                        : tpl.description
                    }
                  >
                    <Switch
                      label={s.ruleOn(tpl.title)}
                      labelHidden
                      checked={cfg?.enabled === true}
                      onChange={(on) => saveRule(tpl, on, params)}
                    />
                  </SettingRow>
                  {cfg?.enabled &&
                    tpl.params.map((p) => {
                      const label = s.params[p.key] ?? p.key;
                      return p.type === 'time' ? (
                        <TextField
                          key={p.key}
                          label={label}
                          type="time"
                          value={String(params[p.key])}
                          onChange={(e) => {
                            if (TIME_RE.test(e.target.value))
                              saveRule(tpl, true, { ...params, [p.key]: e.target.value });
                          }}
                        />
                      ) : (
                        <TextField
                          key={p.key}
                          label={label}
                          type="number"
                          min={p.min}
                          max={p.max}
                          defaultValue={String(params[p.key])}
                          onBlur={(e) => {
                            const n = Math.round(Number(e.target.value));
                            if (Number.isFinite(n))
                              saveRule(tpl, true, {
                                ...params,
                                [p.key]: Math.min(p.max ?? n, Math.max(p.min ?? n, n)),
                              });
                          }}
                        />
                      );
                    })}
                </div>
              );
            })}
          </FoldedGroup>
        </>
      )}
    </SettingsGroup>
  );
}
