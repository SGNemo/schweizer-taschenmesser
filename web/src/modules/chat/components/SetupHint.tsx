import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { isAiConfigured, useAiConfig } from '@/core/ai/config';
import { useLocalModel } from '@/core/ai/local/state';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import styles from '../chat.module.css';

/** Shown in the chat until a local model is downloaded or a provider is usable. */
export function SetupHint() {
  const navigate = useNavigate();
  const config = useAiConfig();
  const status = useLocalModel((s) => s.status);
  useEffect(() => {
    void useLocalModel.getState().refresh();
  }, []);
  // Wait for both answers so the notice doesn't flash up for someone who is set up.
  if (!config || !status) return null;
  if (isAiConfigured(config) || status.models.length > 0) return null;
  const canDownload = !status.unavailable;
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
