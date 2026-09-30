import { useEffect, useMemo, useState } from 'react';
import { disableModule, enableModule, useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { setSettings, useSettings } from '@/core/settings/settings';
import {
  diffSelection,
  PROFILES,
  resolveProfile,
  toggleModule,
  withDependencies,
} from '@/core/setup/profiles';
import type { SetupStepProps } from '@/core/setup/types';
import { DEFAULT_TOOLS, isEnabled, toolsSettingsSchema, TOOLS_SCOPE } from '@/core/tools/layout';
import { allTools } from '@/core/tools/registry';
import { t } from '@/strings';
import { Button, Card, Checkbox, patternStyles, Switch } from '@/ui';

const s = t.setup.steps.profiles;
const names = (ids: string[]) =>
  ids.map((id) => availableManifests().find((m) => m.id === id)?.name ?? id).join(', ');
const toolNames = (ids: string[]) =>
  ids.map((id) => allTools.find((x) => x.id === id)?.name ?? id).join(', ');

const nonDevTools = allTools.filter((tool) => tool.group !== 'dev');

/**
 * Profiles are presets; the switches are the fine selection. Nothing changes until "Weiter", and a
 * change that switches something off has to be confirmed after looking at the diff. Disabled
 * modules always keep their data.
 */
export default function ProfilesStep({ registerCommit, setCanContinue }: SetupStepProps) {
  const states = useModuleStates();
  const [tools] = useSettings(TOOLS_SCOPE, toolsSettingsSchema, DEFAULT_TOOLS);
  const [touched, setTouched] = useState<
    { modules: Set<string>; tools: Set<string> } | undefined
  >();
  const [confirmed, setConfirmed] = useState(false);
  const [via, setVia] = useState<Record<string, string[]>>({});

  const current = useMemo(
    () =>
      new Set(
        availableManifests()
          .filter((m) => states?.[m.id])
          .map((m) => m.id),
      ),
    [states],
  );
  const currentTools = useMemo(
    () => new Set(tools ? nonDevTools.filter((x) => isEnabled(x, tools)).map((x) => x.id) : []),
    [tools],
  );
  const selection = touched?.modules ?? current;
  const toolSelection = touched?.tools ?? currentTools;
  const modDiff = diffSelection(current, selection);
  const toolDiff = diffSelection(currentTools, toolSelection);
  const changed =
    modDiff.enable.length +
      modDiff.disable.length +
      toolDiff.enable.length +
      toolDiff.disable.length >
    0;
  const needsConfirm = changed && (modDiff.disable.length > 0 || toolDiff.disable.length > 0);
  const ok = !needsConfirm || confirmed;

  useEffect(() => setCanContinue(ok), [ok, setCanContinue]);

  useEffect(() => {
    if (!touched || !changed) {
      registerCommit(null);
      return;
    }
    registerCommit(async () => {
      for (const id of modDiff.enable) {
        const m = availableManifests().find((x) => x.id === id);
        if (m) await enableModule(m);
      }
      for (const id of modDiff.disable) {
        const m = availableManifests().find((x) => x.id === id);
        if (m) await disableModule(m, 'keep');
      }
      if (toolDiff.enable.length + toolDiff.disable.length > 0) {
        await setSettings(TOOLS_SCOPE, {
          enabled: {
            ...tools?.enabled,
            ...Object.fromEntries(nonDevTools.map((x) => [x.id, toolSelection.has(x.id)])),
          },
        });
      }
    });
    return () => registerCommit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, changed, tools]);

  if (!states) return null;

  const pick = (id: string) => {
    const profile = PROFILES.find((p) => p.id === id)!;
    const r = resolveProfile(profile, availableManifests(), nonDevTools);
    setVia(r.viaDependency);
    setConfirmed(false);
    setTouched({ modules: r.modules, tools: r.tools });
  };
  const toggle = (id: string, on: boolean) => {
    setConfirmed(false);
    const next = toggleModule(selection, id, on, availableManifests());
    setVia(withDependencies(next, availableManifests()).viaDependency);
    setTouched({ modules: next, tools: toolSelection });
  };

  return (
    <>
      <p className={patternStyles.muted}>{s.currentState}</p>
      <h4>{s.choose}</h4>
      <ul className={patternStyles.gridList}>
        {PROFILES.map((p) => (
          <li key={p.id}>
            <Card>
              <strong>{t.setup.profiles[p.id]?.name}</strong>
              <p className={patternStyles.muted}>{t.setup.profiles[p.id]?.description}</p>
              <Button data-testid={`profile-${p.id}`} onClick={() => pick(p.id)}>
                {t.setup.profiles[p.id]?.name}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <h4>{s.modules}</h4>
      <ul className={patternStyles.gridList}>
        {availableManifests().map((m) => (
          <li key={m.id}>
            <Switch
              label={m.name}
              hint={[
                m.description,
                m.requires?.length ? s.requires(names(m.requires)) : '',
                via[m.id] && selection.has(m.id) ? s.viaDependency(names(via[m.id]!)) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
              checked={selection.has(m.id)}
              onChange={(on) => toggle(m.id, on)}
            />
          </li>
        ))}
      </ul>

      <div data-testid="profile-diff" aria-live="polite">
        <h4>{s.diffTitle}</h4>
        {!changed ? <p>{s.diffNone}</p> : null}
        {modDiff.enable.length ? <p>{s.willEnable(names(modDiff.enable))}</p> : null}
        {modDiff.disable.length ? (
          <p>
            {s.willDisable(names(modDiff.disable))} {s.keepData}
          </p>
        ) : null}
        {toolDiff.enable.length ? <p>{s.toolsOn(toolNames(toolDiff.enable))}</p> : null}
        {toolDiff.disable.length ? <p>{s.toolsOff(toolNames(toolDiff.disable))}</p> : null}
        {needsConfirm ? (
          <Checkbox
            label={s.confirm}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
        ) : null}
      </div>
    </>
  );
}
