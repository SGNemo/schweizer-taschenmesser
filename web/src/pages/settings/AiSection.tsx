import { useState, type FormEvent } from 'react';
import { clearAiCache } from '@/core/ai/cache';
import {
  addProvider,
  entryFromPreset,
  keyName,
  moveProvider,
  removeProvider,
  saveAiConfig,
  setProviderKey,
  useAiConfig,
  type AiConfig,
  type ProviderEntry,
} from '@/core/ai/config';
import { PRESETS, getPreset, type PresetId } from '@/core/ai/providers/presets';
import { coolingDown, clearCooldown } from '@/core/ai/router';
import { testConnection, type ConnectionTest } from '@/core/ai/testConnection';
import {
  resetUsage,
  totalsByProvider,
  totalsOf,
  useUsageRows,
  type UsageTotals,
} from '@/core/ai/usage';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Badge, Button, Icon, IconButton, SelectField, Switch, TextField } from '@/ui';
import { Card } from '@/ui';
import styles from './settings.module.css';

const usd = (n: number) => n.toFixed(4).replace('.', ',');

/** "12,5" / "12.5" → 12.5; empty → undefined; garbage → NaN. */
function parseNumber(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? undefined : Number(trimmed);
}
const show = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

function ProviderCard({
  entry,
  index,
  count,
  stats,
  open,
  onToggleOpen,
  onConfig,
}: {
  entry: ProviderEntry;
  index: number;
  count: number;
  stats: UsageTotals | undefined;
  open: boolean;
  onToggleOpen: () => void;
  onConfig: (
    next: AiConfig | ((current: AiConfig) => AiConfig | Promise<AiConfig>),
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState(entry);
  const [key, setKey] = useState('');
  const [limitReq, setLimitReq] = useState(show(entry.limits.requestsPerDay));
  const [limitCost, setLimitCost] = useState(show(entry.limits.costUsdPerMonth));
  const [priceIn, setPriceIn] = useState(show(entry.price?.inputPerMTok));
  const [priceOut, setPriceOut] = useState(show(entry.price?.outputPerMTok));
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<ConnectionTest | 'running' | undefined>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const preset = getPreset(entry.preset);
  const cooling = coolingDown(entry.id, now());
  const s = t.ai.settings;

  const set = (patch: Partial<ProviderEntry>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  function built(): ProviderEntry {
    const requestsPerDay = parseNumber(limitReq);
    const costUsdPerMonth = parseNumber(limitCost);
    const inPrice = parseNumber(priceIn);
    const outPrice = parseNumber(priceOut);
    return {
      ...draft,
      limits: {
        requestsPerDay:
          requestsPerDay !== undefined && requestsPerDay >= 0
            ? Math.floor(requestsPerDay)
            : undefined,
        costUsdPerMonth:
          costUsdPerMonth !== undefined && costUsdPerMonth >= 0 ? costUsdPerMonth : undefined,
      },
      price:
        inPrice !== undefined || outPrice !== undefined
          ? {
              inputPerMTok: Math.max(0, inPrice ?? 0) || 0,
              outputPerMTok: Math.max(0, outPrice ?? 0) || 0,
            }
          : undefined,
    };
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const next = built();
    await onConfig(async (config) => {
      let updated = {
        ...config,
        providers: config.providers.map((p) => (p.id === next.id ? next : p)),
      };
      if (key.trim()) updated = await setProviderKey(updated, next.id, key);
      return updated;
    });
    clearCooldown(next.id);
    setKey('');
    setSaved(true);
  }

  async function runTest() {
    setTest('running');
    const stored = (await getPlatform().secrets.get(keyName(entry.id))) ?? '';
    setTest(await testConnection(built(), key.trim() || stored));
  }

  const failure = test && test !== 'running' && !test.ok ? test : undefined;

  return (
    <li className={styles.provider} data-testid={`provider-${entry.id}`}>
      <div className={styles.providerHead}>
        <span className={styles.providerTitle}>
          {entry.label || preset.label}
          <Badge>{s.tiers[entry.tier]}</Badge>
          {entry.mayTrainOnInputs ? <Badge tone="accent">{s.trainingNotice}</Badge> : null}
        </span>
        <span className={styles.row}>
          <Switch
            label={s.enabled}
            checked={entry.enabled}
            onChange={(enabled) =>
              void onConfig((c) => ({
                ...c,
                providers: c.providers.map((p) => (p.id === entry.id ? { ...p, enabled } : p)),
              }))
            }
          />
          <IconButton
            label={s.moveUp(entry.label || preset.label)}
            disabled={index === 0}
            onClick={() => void onConfig((c) => moveProvider(c, entry.id, -1))}
          >
            <Icon name="chevronUp" size={18} />
          </IconButton>
          <IconButton
            label={s.moveDown(entry.label || preset.label)}
            disabled={index === count - 1}
            onClick={() => void onConfig((c) => moveProvider(c, entry.id, 1))}
          >
            <Icon name="chevronDown" size={18} />
          </IconButton>
        </span>
      </div>

      <p className={styles.muted} data-testid={`stats-${entry.id}`}>
        {stats ? s.stats(stats.requests, stats.errors, stats.fallbacks) : s.stats(0, 0, 0)}
        {stats && stats.requests > 0
          ? ` · ${s.statsTokens(stats.inputTokens, stats.outputTokens)}`
          : ''}
        {stats?.costUsd !== undefined ? ` · ${s.statsCost(usd(stats.costUsd))}` : ''}
      </p>
      {cooling ? (
        <p className={styles.muted} role="status">
          {s.coolingDown(Math.max(1, Math.ceil((cooling.until - now()) / 60_000)))}{' '}
          {s.errors[cooling.code] ?? ''}
        </p>
      ) : null}

      <div className={styles.row}>
        <Button onClick={onToggleOpen} aria-expanded={open}>
          {open ? s.collapse : s.edit}
        </Button>
      </div>

      {open ? (
        <form className={styles.form} onSubmit={(e) => void save(e)}>
          <TextField
            label={s.label}
            value={draft.label}
            onChange={(e) => set({ label: e.target.value })}
          />
          {entry.kind !== 'anthropic' ? (
            <TextField
              label={s.baseUrl}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={draft.baseUrl}
              onChange={(e) => set({ baseUrl: e.target.value })}
            />
          ) : null}
          <TextField
            label={s.model}
            autoComplete="off"
            value={draft.model}
            onChange={(e) => set({ model: e.target.value })}
          />
          {entry.kind !== 'ollama' ? (
            <TextField
              label={s.apiKey}
              hint={
                (entry.keySet ? `${s.apiKeySet}. ` : '') +
                (draft.keyRequired ? '' : `${s.apiKeyOptional} `) +
                s.keyStorage
              }
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setSaved(false);
              }}
            />
          ) : null}
          {preset.keyUrl ? (
            <p className={styles.muted}>
              <a href={preset.keyUrl} target="_blank" rel="noreferrer noopener">
                {s.getKey}
              </a>
            </p>
          ) : null}
          {entry.kind === 'openai-compatible' ? (
            <SelectField
              label={s.toolMode}
              value={draft.toolMode}
              onChange={(e) => set({ toolMode: e.target.value as ProviderEntry['toolMode'] })}
            >
              <option value="native">{s.toolModeNative}</option>
              <option value="json">{s.toolModeJson}</option>
            </SelectField>
          ) : null}
          <TextField
            label={s.limitRequests}
            hint={s.limitHint}
            inputMode="numeric"
            value={limitReq}
            onChange={(e) => {
              setLimitReq(e.target.value);
              setSaved(false);
            }}
          />
          <TextField
            label={s.limitCost}
            inputMode="decimal"
            value={limitCost}
            onChange={(e) => {
              setLimitCost(e.target.value);
              setSaved(false);
            }}
          />
          <TextField
            label={s.priceIn}
            hint={s.priceHint}
            inputMode="decimal"
            value={priceIn}
            onChange={(e) => {
              setPriceIn(e.target.value);
              setSaved(false);
            }}
          />
          <TextField
            label={s.priceOut}
            inputMode="decimal"
            value={priceOut}
            onChange={(e) => {
              setPriceOut(e.target.value);
              setSaved(false);
            }}
          />
          {!getPlatform().isNative && entry.kind === 'openai-compatible' ? (
            <p className={styles.muted}>{s.browserNote}</p>
          ) : null}
          <div className={styles.row}>
            <Button type="submit" variant="primary">
              {s.save}
            </Button>
            <Button onClick={() => void runTest()} disabled={test === 'running'}>
              {test === 'running' ? s.testing : s.test}
            </Button>
            {saved ? <span role="status">{s.saved}</span> : null}
          </div>
          {test && test !== 'running' ? (
            <p
              role="status"
              data-testid={`test-${entry.id}`}
              className={failure ? styles.error : undefined}
            >
              {test.ok
                ? s.testOk(test.ms)
                : s.testFailed(
                    `${s.errors[test.code] ?? test.code}${test.detail && test.detail !== test.code ? ` (${test.detail})` : ''}`,
                  )}
            </p>
          ) : null}
          <div className={styles.row}>
            {confirmRemove ? (
              <Button
                variant="danger"
                onClick={() => void onConfig((c) => removeProvider(c, entry.id))}
              >
                {s.confirmRemove}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmRemove(true)}>
                {s.remove}
              </Button>
            )}
          </div>
        </form>
      ) : null}
    </li>
  );
}

function UsageBlock() {
  const rows = useUsageRows();
  const [cleared, setCleared] = useState(false);
  if (!rows) return null;
  const usage = totalsOf(rows);
  const empty = usage.requests === 0 && usage.cacheHits === 0 && usage.errors === 0;
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
            <li>{t.ai.settings.usageCost(usd(usage.costUsd))}</li>
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
  const rows = useUsageRows();
  const [openId, setOpenId] = useState<string | undefined>();
  const s = t.ai.settings;

  if (!config) return <Card>{null}</Card>;
  const stats = totalsByProvider(rows ?? []);

  async function apply(next: AiConfig | ((current: AiConfig) => AiConfig | Promise<AiConfig>)) {
    const value = typeof next === 'function' ? await next(config!) : next;
    await saveAiConfig(value);
  }

  async function add(id: PresetId) {
    const entry = entryFromPreset(id, config!.providers);
    await apply(addProvider(config!, entry));
    setOpenId(entry.id);
  }

  return (
    <Card>
      <div className={styles.form}>
        <p>{s.intro}</p>
        <p className={styles.muted}>{s.privacy}</p>
        <h3 className={styles.legend}>{s.providers}</h3>
        {config.providers.length === 0 ? <p className={styles.muted}>{s.noProviders}</p> : null}
        <ul className={styles.providerList} aria-label={s.providers}>
          {config.providers.map((p, i) => (
            <ProviderCard
              key={p.id}
              entry={p}
              index={i}
              count={config.providers.length}
              stats={stats.get(p.id)}
              open={openId === p.id}
              onToggleOpen={() => setOpenId(openId === p.id ? undefined : p.id)}
              onConfig={apply}
            />
          ))}
        </ul>
        <SelectField
          label={s.addProvider}
          value=""
          onChange={(e) => {
            if (e.target.value) void add(e.target.value as PresetId);
          }}
        >
          <option value="">{s.addPlaceholder}</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <UsageBlock />
      </div>
    </Card>
  );
}
