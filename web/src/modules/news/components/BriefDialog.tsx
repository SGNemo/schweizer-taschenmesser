import { useState } from 'react';
import { createRouterProvider, loadAiConfig } from '@/core/ai/config';
import { newsBrief, type BriefResult, type Headline } from '@/core/ai/newsBrief';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, Dialog } from '@/ui';
import styles from '../routes/news.module.css';

const s = t.news.brief;

/**
 * Explicit, per-press AI overview of the headlines on screen. Sends only titles and sources (see
 * `core/ai/newsBrief.ts`); the answer is shown here and stored nowhere.
 */
export function BriefDialog({
  headlines,
  open,
  onClose,
}: {
  headlines: Headline[];
  open: boolean;
  onClose: () => void;
}) {
  const [result, setResult] = useState<BriefResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const provider = await createRouterProvider(await loadAiConfig());
      setResult(await newsBrief(headlines, { provider }));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setResult(null);
    onClose();
  }

  const failure = result && !result.ok ? result.error : undefined;
  return (
    <Dialog open={open} onClose={close} title={s.title}>
      {open ? (
        <div className={styles.manager}>
          <p className={styles.muted}>{s.notice}</p>
          {headlines.length === 0 ? <p role="status">{s.none}</p> : null}
          {result?.ok ? (
            <div data-testid="news-brief">
              <p className={styles.briefText}>{result.text}</p>
              <p className={styles.muted}>
                {result.usage.model} · {result.usage.inputTokens + result.usage.outputTokens} Token
              </p>
            </div>
          ) : null}
          {failure ? (
            <p className={styles.error} role="alert">
              {failure === 'no-headlines' ? s.none : (t.ai.errors[failure] ?? t.ai.errors.fallback)}
            </p>
          ) : null}
          <div className={styles.row}>
            <Button
              variant="primary"
              disabled={busy || headlines.length === 0}
              onClick={() => void run()}
            >
              {busy ? s.running : s.title}
            </Button>
            {result?.ok ? (
              <Button
                onClick={() => void getPlatform().clipboard.writeSensitive(result.text, 60_000)}
              >
                {s.copy}
              </Button>
            ) : null}
            <Button onClick={close}>{s.close}</Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
