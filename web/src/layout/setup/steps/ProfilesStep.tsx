import { useEffect, useMemo, useState } from 'react';
import { disableModule, enableModule, useModuleStates } from '@/core/modules/activation';
import { availableManifests, isVisible } from '@/core/modules/available';
import { setSettings, useSettings } from '@/core/settings/settings';
import {
  diffSelection,
  modulesSwitchedOff,
  PROFILES,
  resolveProfile,
  toggleModule,
  withDependencies,
} from '@/core/setup/profiles';
import type { ModuleManifest } from '@/core/modules/types';
import type { SetupStepProps } from '@/core/setup/types';
import { DEFAULT_TOOLS, isEnabled, toolsSettingsSchema, TOOLS_SCOPE } from '@/core/tools/layout';
import { allTools } from '@/core/tools/registry';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card, Checkbox, Icon, patternStyles, Switch } from '@/ui';

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
export default function ProfilesStep({
  registerCommit,
  setCanContinue,
  setBlockedReason,
  mode,
}: SetupStepProps) {
  const quick = mode === 'quick';
  const states = useModuleStates();
  const [tools] = useSettings(TOOLS_SCOPE, toolsSettingsSchema, DEFAULT_TOOLS);
  // Preview modules only with "In Arbeit anzeigen" or when already on (maturity filter).
  const showPreview = useUiStore((st) => st.showPreview);
  const listedModule = (m: ModuleManifest) =>
    isVisible(m, { showPreview, isEnabled: (id) => Boolean(states?.[id]) });
  const [touched, setTouched] = useState<
    { modules: Set<string>; tools: Set<string> } | undefined
  >();
  const [confirmed, setConfirmed] = useState(false);
  const [pickedId, setPickedId] = useState<string | undefined>();
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
  // The quick question lists what each card switches off, so the choice itself is the consent.
  const needsConfirm =
    !quick && changed && (modDiff.disable.length > 0 || toolDiff.disable.length > 0);
  const ok = !needsConfirm || confirmed;

  useEffect(() => {
    setCanContinue(ok);
    setBlockedReason?.(ok ? null : s.needConfirm);
    return () => setBlockedReason?.(null);
  }, [ok, setCanContinue, setBlockedReason]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the commit callback reads the other selections at commit time
  }, [touched, changed, tools]);

  if (!states) return null;

  const pick = (id: string) => {
    const profile = PROFILES.find((p) => p.id === id)!;
    const r = resolveProfile(profile, availableManifests(), nonDevTools);
    setPickedId(id);
    setVia(r.viaDependency);
    setConfirmed(false);
    setTouched({ modules: r.modules, tools: r.tools });
  };
  const toggle = (id: string, on: boolean) => {
    setConfirmed(false);
    setPickedId(undefined);
    const next = toggleModule(selection, id, on, availableManifests());
    setVia(withDependencies(next, availableManifests()).viaDependency);
    setTouched({ modules: next, tools: toolSelection });
  };

  const shownProfiles = quick ? PROFILES.filter((p) => p.quick) : PROFILES;
  const profileCards = (
    <ul className={patternStyles.gridList}>
      {shownProfiles.map((p) => {
        const off = modulesSwitchedOff(
          current,
          resolveProfile(p, availableManifests(), nonDevTools),
        );
        const chosen = pickedId === p.id;
        return (
          <li key={p.id}>
            <Card>
              <strong>{t.setup.profiles[p.id]?.name}</strong>
              <p className={patternStyles.muted}>{t.setup.profiles[p.id]?.description}</p>
              <p className={patternStyles.muted}>
                {off.length ? `${s.switchesOff(names(off))} ${s.dataKept}` : s.switchesNothingOff}
              </p>
              <Button
                data-testid={`profile-${p.id}`}
                aria-pressed={chosen}
                aria-label={`${t.setup.profiles[p.id]?.name}: ${chosen ? s.picked : s.pick}`}
                onClick={() => pick(p.id)}
              >
                {chosen ? (
                  <>
                    <Icon name="check" size={16} /> {s.picked}
                  </>
                ) : (
                  s.pick
                )}
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );

  const diff = (
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
  );

  if (quick) return profileCards;

  return (
    <>
      <p className={patternStyles.muted}>{s.currentState}</p>
      <h4>{s.choose}</h4>
      {profileCards}
      {diff}

      <h4>{s.modules}</h4>
      <ul className={patternStyles.gridList}>
        {availableManifests()
          .filter(listedModule)
          .map((m) => (
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
    </>
  );
}
