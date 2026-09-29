import { useState, type FormEvent } from 'react';
import { clearAiCache } from '@/core/ai/cache';
import { saveAiConfig, useAiConfig, type AiConfig } from '@/core/ai/config';
import { resetUsage, useUsageTotals } from '@/core/ai/usage';
import { t } from '@/strings';
import { Button, Card, SelectField, TextField } from '@/ui';
import styles from './settings.module.css';

function AiForm({ initial }: { initial: AiConfig }) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<AiConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    await saveAiConfig(draft);
    setSaved(true);
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={styles.form}>
      <SelectField
        label={t.ai.settings.provider}
        value={draft.provider}
        onChange={(e) => set({ provider: e.target.value as AiConfig['provider'] })}
      >
        <option value="off">{t.ai.settings.providerOff}</option>
        <option value="claude">{t.ai.settings.providerClaude}</option>
        <option value="ollama">{t.ai.settings.providerOllama}</option>
      </SelectField>

      {draft.provider === 'claude' ? (
        <>
          <TextField
            label={t.ai.settings.apiKey}
            hint={t.ai.settings.apiKeyHint}
            type="password"
            autoComplete="off"
            value={draft.anthropicKey}
            onChange={(e) => set({ anthropicKey: e.target.value })}
          />
          <TextField
            label={t.ai.settings.claudeModel}
            hint={t.ai.settings.claudeModelHint}
            autoComplete="off"
            value={draft.claudeModel}
            onChange={(e) => set({ claudeModel: e.target.value })}
          />
        </>
      ) : null}

      {draft.provider === 'ollama' ? (
        <>
          <TextField
            label={t.ai.settings.ollamaUrl}
            type="url"
            inputMode="url"
            autoComplete="off"
            value={draft.ollamaUrl}
            onChange={(e) => set({ ollamaUrl: e.target.value })}
          />
          <TextField
            label={t.ai.settings.ollamaModel}
            hint={t.ai.settings.ollamaHint}
            autoComplete="off"
            value={draft.ollamaModel}
            onChange={(e) => set({ ollamaModel: e.target.value })}
          />
        </>
      ) : null}

      <div className={styles.row}>
        <Button type="submit" variant="primary">
          {t.ai.settings.save}
        </Button>
        {saved ? <span role="status">{t.ai.settings.saved}</span> : null}
      </div>
    </form>
  );
}

function UsageBlock() {
  const usage = useUsageTotals();
  const [cleared, setCleared] = useState(false);
  if (!usage) return null;
  const empty = usage.requests === 0 && usage.cacheHits === 0;
  return (
    <div className={styles.form}>
      <h3 className={styles.legend}>{t.ai.settings.usageTitle}</h3>
      {empty ? (
        <p className={styles.muted}>{t.ai.settings.usageEmpty}</p>
      ) : (
        <ul data-testid="ai-usage" className={styles.muted}>
          <li>{t.ai.settings.usageRequests(usage.requests)}</li>
          <li>{t.ai.settings.usageCacheHits(usage.cacheHits)}</li>
          <li>{t.ai.settings.usageTokens(usage.inputTokens, usage.outputTokens)}</li>
          {usage.costUsd !== undefined ? (
            <li>{t.ai.settings.usageCost(usage.costUsd.toFixed(4).replace('.', ','))}</li>
          ) : null}
        </ul>
      )}
      <div className={styles.row}>
        <Button onClick={() => void resetUsage()} disabled={empty}>
          {t.ai.settings.usageReset}
        </Button>
        <Button
          onClick={async () => {
            await clearAiCache();
            setCleared(true);
          }}
        >
          {t.ai.settings.clearCache}
        </Button>
        {cleared ? <span role="status">{t.ai.settings.cacheCleared}</span> : null}
      </div>
    </div>
  );
}

export function AiSection() {
  const config = useAiConfig();
  return (
    <Card>
      <div className={styles.form}>
        <p>{t.ai.settings.intro}</p>
        <p className={styles.muted}>{t.ai.settings.privacy}</p>
        {config ? <AiForm initial={config} /> : null}
        <UsageBlock />
      </div>
    </Card>
  );
}
