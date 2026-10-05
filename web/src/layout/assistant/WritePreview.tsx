/**
 * The preview card for entries the assistant proposes (rules, local model or cloud): fields are shown
 * (and editable), changes and deletions show before → after, a missing field or an unclear entry is
 * asked right here. Nothing is stored before "Eintragen"; the toast offers "Rückgängig" afterwards.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { enumLabel, fieldLabel } from '@/core/ai/query/format';
import type { AiResult } from '@/core/ai/query/types';
import { AiQueryError } from '@/core/ai/query/types';
import { enumValues } from '@/core/ai/query/validate';
import { commitOps, undoGroup } from '@/core/ai/write/commit';
import { prepareOp } from '@/core/ai/write/prepare';
import type { PreparedOp, ProposedOp } from '@/core/ai/write/types';
import { aiModules } from '@/core/ai/scope';
import { db } from '@/core/db/db';
import { formatMoney, parseMoney } from '@/core/money';
import { activeManifests } from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import type { AiFieldType } from '@/core/modules/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Checkbox, DateField, Icon, SelectField, TextField } from '@/ui';
import styles from './WritePreview.module.css';
import answer from './assistant.module.css';

type WriteResult = Extract<AiResult, { kind: 'write' }>;

const FREQS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

/** A field the user can fill in or correct; commits on blur and on Enter. */
function FieldInput({
  field,
  type,
  value,
  onCommit,
}: {
  field: string;
  type: AiFieldType;
  value: unknown;
  onCommit: (v: unknown) => void;
}) {
  const label = fieldLabel(field);
  if (type === 'bool') {
    return (
      <Checkbox
        label={label}
        checked={value === true}
        onChange={(e) => onCommit(e.target.checked)}
      />
    );
  }
  if (type === 'date') {
    return (
      <DateField
        label={label}
        defaultValue={typeof value === 'string' ? value : ''}
        key={String(value)}
        onBlur={(e) => onCommit(e.target.value || undefined)}
      />
    );
  }
  if (type.startsWith('enum:')) {
    return (
      <SelectField
        label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onCommit(e.target.value || undefined)}
      >
        <option value="">{t.ai.write.choose}</option>
        {enumValues(type).map((v) => (
          <option key={v} value={v}>
            {enumLabel(v)}
          </option>
        ))}
      </SelectField>
    );
  }
  if (type === 'recurrence') {
    const current = (value as { freq?: string } | undefined)?.freq ?? '';
    return (
      <SelectField
        label={label}
        value={current}
        onChange={(e) =>
          onCommit(e.target.value ? { freq: e.target.value, interval: 1 } : undefined)
        }
      >
        <option value="">{t.ai.write.choose}</option>
        {FREQS.map((f) => (
          <option key={f} value={f}>
            {t.ai.write.recurrence[f]}
          </option>
        ))}
      </SelectField>
    );
  }
  const text =
    type === 'money' && typeof value === 'number'
      ? formatMoney(value).replace(/[\s€]/g, '')
      : Array.isArray(value)
        ? value.join(', ')
        : value === undefined || value === null
          ? ''
          : String(value);
  const parse = (raw: string): unknown => {
    const v = raw.trim();
    if (!v) return undefined;
    if (type === 'money') return parseMoney(v);
    if (type === 'num') {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    return v;
  };
  return (
    <TextField
      label={label}
      key={text}
      defaultValue={text}
      inputMode={type === 'money' || type === 'num' ? 'decimal' : undefined}
      onBlur={(e) => onCommit(parse(e.target.value))}
    />
  );
}

function OpCard({
  op,
  included,
  editing,
  onInclude,
  onEdit,
  onTarget,
}: {
  op: PreparedOp;
  included: boolean;
  editing: boolean;
  onInclude: (v: boolean) => void;
  onEdit: (field: string, value: unknown) => void;
  onTarget: (id: string) => void;
}) {
  const manifest = availableManifests().find((m) => m.id === op.module);
  const def = manifest?.aiSchema?.actions?.[op.action];
  const collection = manifest?.aiSchema?.collections[op.collection];
  const typeOf = (f: string): AiFieldType => collection?.fields[f] ?? 'text';
  const fields = def?.fields ?? [];
  const askFields = editing
    ? op.kind === 'create'
      ? fields
      : Object.keys(op.data).length > 0
        ? Object.keys(op.data)
        : fields
    : op.missing.filter((f) => f !== 'change' && fields.includes(f));
  const editValue = (f: string): unknown => (op.source.data ?? {})[f] ?? op.data[f];
  const title = op.targetTitle ?? String(op.data[collection?.titleField ?? 'title'] ?? '');

  return (
    <li
      className={[styles.card, included ? '' : styles.cardOff].join(' ')}
      data-testid="ai-write-op"
    >
      <div className={styles.head}>
        <Icon name={op.moduleIcon} size={20} />
        <div className={styles.headText}>
          <span className={styles.title}>{op.actionLabel}</span>
          <span className={styles.sub}>
            {op.moduleName}
            {title && op.kind !== 'create' ? ` · ${title}` : ''}
          </span>
        </div>
        <Checkbox
          label={t.ai.write.include(op.actionLabel)}
          labelHidden
          checked={included}
          onChange={(e) => onInclude(e.target.checked)}
        />
      </div>

      {op.needsTarget ? (
        op.candidates.length > 0 ? (
          <>
            <p className={styles.question}>{t.ai.write.chooseTarget}</p>
            <ul className={styles.choices}>
              {op.candidates.map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.choice} onClick={() => onTarget(c.id)}>
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={answer.error} role="alert">
            {t.ai.write.noTarget}
          </p>
        )
      ) : (
        <dl className={styles.lines}>
          {op.lines.map((l) => (
            <div key={l.field} style={{ display: 'contents' }}>
              <dt>{l.label}</dt>
              <dd>
                {l.from !== undefined && l.to !== undefined ? (
                  <>
                    <del className={styles.from}>{l.from}</del>
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                    <ins className={styles.to}>{l.to}</ins>
                  </>
                ) : l.to !== undefined ? (
                  l.to
                ) : (
                  l.from
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {op.kind === 'delete' && !op.needsTarget ? (
        <p className={styles.danger}>{t.ai.write.willDelete}</p>
      ) : null}
      {op.error === 'no-change' ? <p className={answer.note}>{t.ai.write.noChange}</p> : null}

      {askFields.length > 0 ? (
        <div className={editing ? styles.fields : styles.missing}>
          {editing ? null : <strong>{t.ai.write.missing}</strong>}
          {askFields.map((f) => (
            <FieldInput
              key={f}
              field={f}
              type={typeOf(f)}
              value={editValue(f)}
              onCommit={(v) => onEdit(f, v)}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function WritePreview({ result, onDone }: { result: WriteResult; onDone: () => void }) {
  const toast = useUiStore((s) => s.toast);
  const [sources, setSources] = useState<ProposedOp[]>(() => result.ops.map((o) => o.source));
  const [ops, setOps] = useState<PreparedOp[]>(result.ops);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(sources);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.current?.querySelector<HTMLElement>('input, select, button')?.focus();
  }, []);

  async function prepareAll(next: ProposedOp[]): Promise<PreparedOp[]> {
    const states = await loadModuleStates();
    const ctx = {
      manifests: aiModules(activeManifests(states)),
      known: availableManifests(),
      database: db,
      today: today(),
    };
    const out: PreparedOp[] = [];
    for (const [i, s] of next.entries()) {
      try {
        out.push(await prepareOp(s, i, ctx));
      } catch (e) {
        if (!(e instanceof AiQueryError)) throw e;
        out.push({ ...ops[i]!, source: s, error: e.code, ready: false });
      }
    }
    return out;
  }

  async function change(
    index: number,
    patch: (s: ProposedOp) => ProposedOp,
  ): Promise<PreparedOp[]> {
    const next = latest.current.map((s, i) => (i === index ? patch(s) : s));
    latest.current = next;
    setSources(next);
    const prepared = await prepareAll(next);
    setOps(prepared);
    return prepared;
  }

  const edit = (index: number, field: string, value: unknown) =>
    change(index, (s) => {
      const data = { ...s.data };
      if (value === undefined) delete data[field];
      else data[field] = value;
      return { ...s, data };
    });

  const chosen = useMemo(() => ops.filter((o, i) => !off.has(i) && o.ready), [ops, off]);
  const kinds = new Set(chosen.map((o) => o.kind));
  const confirmLabel =
    kinds.size === 1 && kinds.has('create')
      ? t.ai.write.confirmCreate
      : kinds.size === 1 && kinds.has('delete')
        ? t.ai.write.confirmDelete
        : t.ai.write.confirmChange;

  async function confirm(list: PreparedOp[] = chosen) {
    if (list.length === 0 || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const manifests = availableManifests();
      const res = await commitOps(list, {
        manifests,
        source: list.map((o) => o.actionLabel).join(', '),
      });
      const note = res.conflicts > 0 ? ` ${t.ai.write.conflicts(res.conflicts)}` : '';
      toast(
        `${t.ai.write.done(res.written)}${note}`,
        {
          label: t.ai.write.undo,
          run: () => {
            void undoGroup(res.groupId, { manifests }).then((u) =>
              toast(
                u.kept > 0
                  ? `${t.ai.write.undone} ${t.ai.write.undoKept(u.kept)}`
                  : t.ai.write.undone,
              ),
            );
          },
        },
        'check',
      );
      onDone();
    } catch (e) {
      console.error('[assistant] write failed', e);
      setFailed(true);
      setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const el = e.target as HTMLElement;
    if (el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') (el as HTMLInputElement).blur();
    // The blur commits an edit asynchronously; confirm with what is prepared afterwards.
    setTimeout(
      () =>
        void prepareAll(latest.current).then((p) =>
          confirm(p.filter((o, i) => !off.has(i) && o.ready)),
        ),
      0,
    );
  }

  return (
    <div
      ref={container}
      onKeyDown={onKeyDown}
      className={answer.answer}
      style={{ maxHeight: 'none' }}
    >
      <h3 className={answer.heading}>{t.ai.write.heading(ops.length)}</h3>
      <p className={answer.note}>{t.ai.write.intro}</p>
      {result.question ? (
        <p className={styles.question}>
          <strong>{t.ai.write.question}: </strong>
          {result.question}
        </p>
      ) : null}
      <ul className={answer.list} data-testid="ai-write-preview" style={{ gap: 'var(--space-2)' }}>
        {ops.map((op, i) => (
          <OpCard
            key={`${op.index}-${op.action}`}
            op={op}
            included={!off.has(i)}
            editing={editing}
            onInclude={(v) =>
              setOff((prev) => {
                const next = new Set(prev);
                if (v) next.delete(i);
                else next.add(i);
                return next;
              })
            }
            onEdit={(f, v) => void edit(i, f, v)}
            onTarget={(id) => void change(i, (s) => ({ ...s, target: { id } }))}
          />
        ))}
      </ul>
      {failed ? (
        <p role="alert" className={answer.error}>
          {t.ai.write.failed}
        </p>
      ) : null}
      {chosen.length === 0 && !busy ? (
        <p className={answer.note}>{t.ai.write.nothingReady}</p>
      ) : null}
      <div className={answer.actions}>
        <Button
          variant="primary"
          onClick={() => void confirm()}
          disabled={busy || chosen.length === 0}
          data-testid="ai-write-confirm"
        >
          {confirmLabel}
        </Button>
        <Button onClick={() => setEditing((v) => !v)} disabled={busy}>
          {editing ? t.ai.write.editDone : t.ai.write.edit}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          {t.ai.write.discard}
        </Button>
      </div>
    </div>
  );
}
