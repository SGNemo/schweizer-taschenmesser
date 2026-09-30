import { useEffect, useRef, useState } from 'react';
import {
  addProvider,
  entryFromPreset,
  isEntryUsable,
  loadAiConfig,
  moveProvider,
  PRESETS,
  saveAiConfig,
  setProviderKey,
  type AiConfig,
  type ProviderEntry,
} from '@/core/ai/config';
import { detectOllama } from '@/core/ai/detectOllama';
import type { PresetId } from '@/core/ai/providers/presets';
import { testConnection, type ConnectionTest } from '@/core/ai/testConnection';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { Button, Card, HelpHint, patternStyles, SelectField, TextField } from '@/ui';

const s = t.setup.steps.ai;

interface Added {
  entry: ProviderEntry;
  /** Lives in this component only until "Weiter" hands it to the secret store. */
  key: string;
  limit: string;
  test?: ConnectionTest | 'running';
}

/** Adds providers as drafts; keys go to the secret store on "Weiter" and nowhere else. */
export default function AiStep({ registerCommit }: SetupStepProps) {
  const [stored, setStored] = useState<AiConfig | undefined>();
  const [order, setOrder] = useState<string[]>([]);
  const [added, setAdded] = useState<Added[]>([]);
  const [ollama, setOllama] = useState<string[] | undefined>();
  const addedRef = useRef(added);
  const orderRef = useRef(order);

  useEffect(() => {
    let live = true;
    void loadAiConfig().then((c) => {
      if (!live) return;
      setStored(c);
      setOrder(c.providers.map((p) => p.id));
    });
    void detectOllama().then((r) => live && setOllama(r.found ? r.models : undefined));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    addedRef.current = added;
    orderRef.current = order;
  });

  const changedOrder = !!stored && order.join() !== stored.providers.map((p) => p.id).join();
  const dirty = added.length > 0 || changedOrder;

  useEffect(() => {
    if (!dirty) {
      registerCommit(null);
      return;
    }
    registerCommit(async () => {
      let cfg = await loadAiConfig();
      for (const a of addedRef.current) {
        const limit = Number.parseInt(a.limit, 10);
        const entry: ProviderEntry = {
          ...a.entry,
          limits: {
            ...a.entry.limits,
            requestsPerDay: Number.isFinite(limit) && limit >= 0 ? limit : undefined,
          },
        };
        cfg = addProvider(cfg, entry);
        // Key first into the secret store (also flips `keySet`), then the list without secrets.
        cfg = await setProviderKey(cfg, entry.id, a.key);
      }
      const rank = new Map(orderRef.current.map((id, i) => [id, i]));
      const providers = [...cfg.providers].sort(
        (x, y) => (rank.get(x.id) ?? Infinity) - (rank.get(y.id) ?? Infinity),
      );
      await saveAiConfig({ ...cfg, providers });
    });
    return () => registerCommit(null);
  }, [dirty, registerCommit]);

  if (!stored) return null;

  const existing = order
    .map((id) => stored.providers.find((p) => p.id === id))
    .filter((p): p is ProviderEntry => !!p);

  const move = (id: string, delta: -1 | 1) => {
    const moved = moveProvider({ ...stored, providers: existing }, id, delta);
    setOrder(moved.providers.map((p) => p.id));
  };

  function add(preset: PresetId, model?: string) {
    const all = [...stored!.providers, ...added.map((a) => a.entry)];
    const entry = entryFromPreset(preset, all);
    setAdded((list) => [
      ...list,
      {
        entry: model ? { ...entry, model } : entry,
        key: '',
        limit: entry.limits.requestsPerDay === undefined ? '' : String(entry.limits.requestsPerDay),
      },
    ]);
  }
  const update = (id: string, patch: Partial<Added>) =>
    setAdded((list) => list.map((a) => (a.entry.id === id ? { ...a, ...patch } : a)));

  async function runTest(a: Added) {
    update(a.entry.id, { test: 'running' });
    const result = await testConnection({ ...a.entry, keySet: a.key !== '' }, a.key.trim());
    update(a.entry.id, { test: result });
  }

  const ollamaAdded = added.some((a) => a.entry.preset === 'ollama');
  return (
    <>
      <p className={patternStyles.muted}>
        {t.ai.settings.privacy} <HelpHint text={t.help.aiRouter} label={t.help.label} />
      </p>

      <h4>{s.existing}</h4>
      {existing.length === 0 ? <p>{s.none}</p> : null}
      <ul className={patternStyles.gridList}>
        {existing.map((p, i) => (
          <li
            key={p.id}
            style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', minHeight: 44 }}
          >
            <span className={patternStyles.grow}>
              {p.label} – {isEntryUsable(p) ? s.usable : s.incomplete}
            </span>
            <Button aria-label={s.up(p.label)} disabled={i === 0} onClick={() => move(p.id, -1)}>
              ↑
            </Button>
            <Button
              aria-label={s.down(p.label)}
              disabled={i === existing.length - 1}
              onClick={() => move(p.id, 1)}
            >
              ↓
            </Button>
          </li>
        ))}
      </ul>

      {ollama && !ollamaAdded ? (
        <p role="status">
          {s.ollamaFound}{' '}
          <Button onClick={() => add('ollama', ollama.length ? ollama[0] : undefined)}>
            {s.ollamaAdd}
          </Button>
        </p>
      ) : null}

      {added.map((a) => {
        const preset = PRESETS.find((p) => p.id === a.entry.preset);
        const id = a.entry.id;
        return (
          <Card key={id}>
            <div data-testid={`ai-draft-${id}`} style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <strong>{a.entry.label}</strong>
              {a.entry.mayTrainOnInputs ? <p role="note">{s.mayTrain}</p> : null}
              {a.entry.kind !== 'ollama' ? (
                <TextField
                  label={s.key}
                  hint={s.keyHint}
                  type="password"
                  autoComplete="off"
                  value={a.key}
                  onChange={(e) => update(id, { key: e.target.value, test: undefined })}
                />
              ) : null}
              {preset?.keyUrl ? (
                <a href={preset.keyUrl} target="_blank" rel="noreferrer noopener">
                  {s.keyLink}
                </a>
              ) : null}
              <TextField
                label={s.model}
                value={a.entry.model}
                onChange={(e) => update(id, { entry: { ...a.entry, model: e.target.value } })}
              />
              <TextField
                label={s.limit}
                inputMode="numeric"
                value={a.limit}
                onChange={(e) => update(id, { limit: e.target.value })}
              />
              <div className={patternStyles.hstackWrap}>
                <Button onClick={() => void runTest(a)} disabled={a.test === 'running'}>
                  {a.test === 'running' ? s.testing : s.test}
                </Button>
                <Button onClick={() => setAdded((l) => l.filter((x) => x.entry.id !== id))}>
                  {s.remove}
                </Button>
              </div>
              {a.test && a.test !== 'running' ? (
                <p role="status" data-testid={`ai-test-${id}`}>
                  {a.test.ok
                    ? t.ai.settings.testOk(a.test.ms)
                    : // Only the mapped reason – never the raw detail of the response.
                      t.ai.settings.testFailed(t.ai.settings.errors[a.test.code] ?? a.test.code)}
                </p>
              ) : null}
            </div>
          </Card>
        );
      })}

      <SelectField
        label={s.add}
        value=""
        onChange={(e) => e.target.value && add(e.target.value as PresetId)}
      >
        <option value="">–</option>
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </SelectField>
    </>
  );
}
