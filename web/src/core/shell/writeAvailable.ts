import { isAiConfigured, useAiConfig } from '@/core/ai/config';
import { useAiOn } from '@/core/ai/switch';
import { useAiWriteSettings } from '@/core/ai/write/settings';
import { availableManifests } from '@/core/modules/available';
import { t } from '@/strings';

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

/** True when AI is on and at least one provider is usable (an assistant model is set up). */
export function useAiReady(): boolean {
  const aiOn = useAiOn();
  const config = useAiConfig();
  return !!(aiOn && config && isAiConfigured(config));
}

/** The write button says "AI" only when an AI is set up; otherwise the local rules read the sentence ("Satz eintragen"). */
export function useWriteLabel(): { label: string; ai: boolean } {
  const ai = useAiReady();
  return { label: ai ? t.ai.palette.writeButton : t.ai.palette.writeSentence, ai };
}
