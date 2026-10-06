import { useEffect } from 'react';
import { purgeAi, useAiOn } from '@/core/ai/switch';

/** Headless: while AI is off (here or synced from another device) nothing of it may stay on this device. */
export function AiOffEnforcer() {
  const on = useAiOn();
  useEffect(() => {
    if (!on) void purgeAi().catch(() => undefined);
  }, [on]);
  return null;
}
