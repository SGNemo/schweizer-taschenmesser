import {
  dailyByStage,
  resetUsage,
  totalsByStage,
  useUsageRows,
  type StageName,
} from '@/core/ai/usage';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, SettingRow, SettingsGroup } from '@/ui';

const STAGES: readonly StageName[] = ['rule', 'local', 'cloud', 'cache'];
const usd = (n: number) => n.toFixed(4).replace('.', ',');

/** Settings → KI → Statistik: answers per stage (rules / local / cloud / cache), tokens and cost, per day. */
export function AiStatsSection() {
  const rows = useUsageRows();
  const s = t.ai.stats;
  const stages = totalsByStage(rows ?? []);
  const total = STAGES.reduce((n, k) => n + stages[k].answers, 0);
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const free = total - stages.cloud.answers;
  const days = dailyByStage(rows ?? []).slice(0, 7);
  return (
    <SettingsGroup id="ai-stats" title={s.title} description={s.description}>
      {total === 0 ? <p>{s.empty}</p> : null}
      {total > 0 ? (
        <SettingRow label={s.noCloud(pct(free))} description={s.answers(total)} />
      ) : null}
      {total > 0
        ? STAGES.map((k) => (
            <SettingRow
              key={k}
              id={`ai-stats--${k}`}
              label={s.stage[k]!}
              description={[
                s.answers(stages[k].answers),
                s.tokens(stages[k].inputTokens + stages[k].outputTokens),
                k === 'cloud' && stages.cloud.costUsd > 0 ? s.cost(usd(stages.cloud.costUsd)) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <span>{s.share(pct(stages[k].answers))}</span>
            </SettingRow>
          ))
        : null}
      {days.length > 0 ? <h3>{s.perDay}</h3> : null}
      {days.map((d) => {
        const n = STAGES.reduce((sum, k) => sum + d.stages[k].answers, 0);
        const cloud = d.stages.cloud;
        return (
          <SettingRow
            key={d.day}
            label={d.day === today() ? s.today : d.day}
            description={[
              STAGES.filter((k) => d.stages[k].answers > 0)
                .map((k) => `${s.stage[k]}: ${d.stages[k].answers}`)
                .join(', '),
              cloud.answers > 0
                ? s.tokens(cloud.inputTokens + cloud.outputTokens) +
                  (cloud.costUsd > 0 ? ` · ${s.cost(usd(cloud.costUsd))}` : '')
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <span>{s.answers(n)}</span>
          </SettingRow>
        );
      })}
      {total > 0 ? <Button onClick={() => void resetUsage()}>{s.reset}</Button> : null}
    </SettingsGroup>
  );
}
