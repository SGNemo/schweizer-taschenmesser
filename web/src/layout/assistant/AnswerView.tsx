import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { AskResponse } from '@/core/ai/assistant';
import { commitCreate } from '@/core/ai/query/create';
import type { AiResult, PreparedCreate, ResultRow } from '@/core/ai/query/types';
import { db } from '@/core/db/db';
import { visibleManifests } from '@/core/modules/registry';
import type { CalendarItem } from '@/core/modules/types';
import { formatDay, relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button } from '@/ui';
import styles from './assistant.module.css';

const MAX_ROWS = 10;
const MAX_AGENDA = 30;

function Rows({
  heading,
  rows,
  total,
  go,
}: {
  heading: string;
  rows: ResultRow[];
  total: number;
  go: (to?: string) => void;
}) {
  return (
    <>
      <h3 className={styles.heading}>{heading}</h3>
      {rows.length === 0 ? (
        <p>{t.ai.palette.noResults}</p>
      ) : (
        <ul className={styles.list}>
          {rows.slice(0, MAX_ROWS).map((r) => (
            <li key={`${r.subtitle}-${r.id}`}>
              <button type="button" className={styles.item} onClick={() => go(r.to)}>
                <span className={styles.itemTitle}>{r.title}</span>
                {r.subtitle ? <span className={styles.meta}>{r.subtitle}</span> : null}
                {r.fields.length > 0 ? (
                  <span className={styles.meta}>
                    {r.fields.map((f) => (
                      <span key={f.label}>
                        {f.label}: {f.value}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {total > MAX_ROWS ? (
        <p className={styles.note}>{t.ai.palette.more(total - MAX_ROWS)}</p>
      ) : null}
    </>
  );
}

function Agenda({
  from,
  to,
  items,
  go,
}: {
  from: string;
  to: string;
  items: CalendarItem[];
  go: (to?: string) => void;
}) {
  const shown = items.slice(0, MAX_AGENDA);
  const days = [...new Set(shown.map((i) => i.date))];
  const range =
    from === to
      ? relativeDayLabel(from)
      : `${formatDay(from, 'd. MMM')} – ${formatDay(to, 'd. MMM yyyy')}`;
  const sourceName = (id: string) => visibleManifests.find((m) => m.id === id)?.name ?? id;
  return (
    <>
      <h3 className={styles.heading}>{range}</h3>
      {items.length === 0 ? <p>{t.ai.palette.agendaEmpty}</p> : null}
      {days.map((day) => (
        <div key={day}>
          <h4 className={styles.day}>{relativeDayLabel(day)}</h4>
          <ul className={styles.list}>
            {shown
              .filter((i) => i.date === day)
              .map((i) => (
                <li key={`${i.source}-${i.id}`}>
                  <button type="button" className={styles.item} onClick={() => go(i.to)}>
                    <span className={styles.itemTitle}>{i.title}</span>
                    <span className={styles.meta}>
                      <span>{sourceName(i.source)}</span>
                      {i.time ? <span>{i.time}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {items.length > MAX_AGENDA ? (
        <p className={styles.note}>{t.ai.palette.more(items.length - MAX_AGENDA)}</p>
      ) : null}
    </>
  );
}

function CreateCard({ prepared, onDone }: { prepared: PreparedCreate; onDone: () => void }) {
  const toast = useUiStore((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      await commitCreate(prepared, { known: visibleManifests, database: db });
      toast(t.ai.create.done(prepared.label));
      onDone();
    } catch (e) {
      console.error('[assistant] create failed', e);
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <>
      <h3 className={styles.heading}>{t.ai.create.title(prepared.label)}</h3>
      <p className={styles.note}>{t.ai.create.intro}</p>
      <dl className={styles.lines} data-testid="ai-create-preview">
        <dt>{prepared.moduleName}</dt>
        <dd>{prepared.label}</dd>
        {prepared.preview.map((p) => (
          <div key={p.label} style={{ display: 'contents' }}>
            <dt>{p.label}</dt>
            <dd>{p.value}</dd>
          </div>
        ))}
      </dl>
      {failed ? (
        <p role="alert" className={styles.error}>
          {t.ai.create.failed}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => void confirm()} disabled={busy} data-autofocus>
          {t.ai.create.confirm}
        </Button>
        <Button onClick={onDone} disabled={busy}>
          {t.ai.create.cancel}
        </Button>
      </div>
    </>
  );
}

function Result({
  result,
  go,
  onDone,
}: {
  result: AiResult;
  go: (to?: string) => void;
  onDone: () => void;
}) {
  switch (result.kind) {
    case 'rows':
      return <Rows heading={result.heading} rows={result.rows} total={result.total} go={go} />;
    case 'aggregate':
      return (
        <>
          <h3 className={styles.heading}>{result.heading}</h3>
          <p className={styles.big} data-testid="ai-aggregate">
            {result.value}
          </p>
          {result.note ? <p className={styles.note}>{result.note}</p> : null}
        </>
      );
    case 'agenda':
      return <Agenda from={result.from} to={result.to} items={result.items} go={go} />;
    case 'computed':
      return (
        <>
          <h3 className={styles.heading}>{result.title}</h3>
          <dl className={styles.lines}>
            {result.lines.map((l, i) => (
              <div key={l.label} style={{ display: 'contents' }}>
                <dt className={i === result.lines.length - 1 ? styles.strong : undefined}>
                  {l.label}
                </dt>
                <dd>{l.value}</dd>
              </div>
            ))}
          </dl>
        </>
      );
    case 'create':
      return <CreateCard prepared={result.prepared} onDone={onDone} />;
    case 'message':
      return <p>{result.text}</p>;
  }
}

export function tierLabel(response: Extract<AskResponse, { ok: true }>): string {
  if (response.tier === 'model' && response.usage) {
    return t.ai.tier.model(response.usage.inputTokens, response.usage.outputTokens);
  }
  return t.ai.tier[response.tier === 'model' ? 'local' : response.tier];
}

/** Renders the assistant's answer (or a friendly error). `onDone` closes the palette. */
export function AnswerView({ response, onDone }: { response: AskResponse; onDone: () => void }) {
  const navigate = useNavigate();
  const go = (to?: string) => {
    if (!to) return;
    onDone();
    void navigate(to);
  };

  if (!response.ok) {
    return (
      <p role="alert" className={styles.error} data-testid="ai-error">
        {t.ai.errors[response.error] ?? t.ai.errors.fallback}
      </p>
    );
  }
  return (
    <>
      <Result result={response.result} go={go} onDone={onDone} />
      <div className={styles.footer}>
        <Badge tone={response.tier === 'model' ? 'accent' : 'neutral'}>
          <span data-testid="ai-tier">{tierLabel(response)}</span>
        </Badge>
        {response.hint === 'no-model' ? <span>{t.ai.palette.noModelHint}</span> : null}
      </div>
    </>
  );
}
