import { useAiOn } from '@/core/ai/switch';
import { useAiWriteSettings } from '@/core/ai/write/settings';
import { availableManifests } from '@/core/modules/available';

/** True when "Mit KI eintragen" is offered for the module: AI on, the module declares actions, the user has not switched it off. */
export function useWriteAvailable(moduleId: string | undefined): boolean {
  const [settings] = useAiWriteSettings();
  const aiOn = useAiOn();
  const manifest = availableManifests().find((m) => m.id === moduleId);
  const hasActions = Object.keys(manifest?.aiSchema?.actions ?? {}).length > 0;
  return !!(
    aiOn &&
    manifest &&
    hasActions &&
    settings?.enabled &&
    !settings.modulesOff.includes(manifest.id)
  );
}
