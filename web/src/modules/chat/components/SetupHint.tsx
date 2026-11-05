import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { isAiConfigured, useAiConfig } from '@/core/ai/config';
import { useLocalModel } from '@/core/ai/local/state';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import styles from '../chat.module.css';

/**
 * Whether the chat still needs a model: `undefined` while the config or the local-model status is unknown (nothing
 * flashes up for someone who is set up), else true until a local model is downloaded or a provider is usable.
 */
export function useChatSetup(): { needed: boolean; canDownload: boolean } | undefined {
  const config = useAiConfig();
  const status = useLocalModel((s) => s.status);
  useEffect(() => {
    void useLocalModel.getState().refresh();
  }, []);
  if (!config || !status) return undefined;
  return {
    needed: !isAiConfigured(config) && status.models.length === 0,
    canDownload: !status.unavailable,
  };
}

/** Shown in the chat until a local model is downloaded or a provider is usable; then it is the page's one action. */
export function SetupHint() {
  const navigate = useNavigate();
  const setup = useChatSetup();
  if (!setup?.needed) return null;
  const { canDownload } = setup;
  const c = t.chat.setup;
  return (
    <Card>
      <div className={styles.usage} data-testid="chat-setup-hint">
        <h2>{c.title}</h2>
        <p>{canDownload ? c.bodyLocal : c.bodyProviders}</p>
        <Button
          variant="primary"
          onClick={() => void navigate(settingsPath('ki', canDownload ? 'ai-local' : 'ai'))}
        >
          {canDownload ? c.openLocal : c.openProviders}
        </Button>
      </div>
    </Card>
  );
}
