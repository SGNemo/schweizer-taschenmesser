import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type {
  DeleteMode,
  DeletePlan,
  DeleteProgress,
  DeleteReport,
  DenyReason,
  DiskNode,
} from '@/core/platform/disk';
import { t } from '@/strings';
import { Button, Dialog, TextField } from '@/ui';
import { formatBytes, formatCount } from '../format';
import styles from './DeleteDialog.module.css';

type Step =
  | { kind: 'planning' }
  | { kind: 'confirm'; plan: DeletePlan }
  | { kind: 'running'; plan: DeletePlan; progress: DeleteProgress | null }
  | { kind: 'report'; report: DeleteReport }
  | { kind: 'error'; message: string };

interface Props {
  scanId: number;
  /** Entries to delete (ids from the scan tree). */
  nodeIds: number[];
  presetMode?: DeleteMode;
  /** `changed`: something was deleted, so the views must refresh. */
  onClose: (changed: boolean, root: DiskNode | null) => void;
}

const denyText = (r: DenyReason): string => t.disk.deny[r];

/**
 * The only way to delete: check (block list, sizes, warnings) → confirm (path, size, bin vs.
 * permanent, name typed in for large or permanent deletions) → run with progress and cancel →
 * report. The native side re-checks everything, including the typed phrase.
 */
export function DeleteDialog({ scanId, nodeIds, presetMode = 'trash', onClose }: Props) {
  const disk = getPlatform().disk;
  const [ids, setIds] = useState(nodeIds);
  const [mode, setMode] = useState<DeleteMode>(presetMode);
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'planning' });
  const changed = useRef(false);
  const root = useRef<DiskNode | null>(null);

  useEffect(() => {
    let alive = true;
    disk
      .planDelete(scanId, ids)
      .then((plan) => alive && setStep({ kind: 'confirm', plan }))
      .catch(() => alive && setStep({ kind: 'error', message: t.disk.del.planFailed }));
    return () => {
      alive = false;
    };
  }, [disk, scanId, ids]);

  const running = step.kind === 'running';
  const close = () => {
    if (!running) onClose(changed.current, root.current);
  };

  const start = async (plan: DeletePlan) => {
    const confirm = mode === 'trash' ? plan.trashConfirmation : plan.permanentConfirmation;
    setStep({ kind: 'running', plan, progress: null });
    try {
      const report = await disk.runDelete(
        plan.planId,
        mode,
        confirm === null ? null : typed,
        (progress) => setStep((s) => (s.kind === 'running' ? { ...s, progress } : s)),
      );
      if (report.items.some((i) => i.outcome === 'deleted' || i.outcome === 'partial'))
        changed.current = true;
      if (report.rootNode) root.current = report.rootNode;
      setStep({ kind: 'report', report });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setStep({ kind: 'error', message: t.disk.del.errors[code] ?? t.disk.del.errors.generic! });
    }
  };

  const body = (() => {
    switch (step.kind) {
      case 'planning':
        return <p aria-live="polite">{t.disk.del.planning}</p>;
      case 'error':
        return <p role="alert">{step.message}</p>;
      case 'confirm':
        return (
          <Confirm plan={step.plan} mode={mode} typed={typed} onMode={setMode} onTyped={setTyped} />
        );
      case 'running': {
        const p = step.progress;
        return (
          <div aria-live="polite">
            <p className={styles.strong}>{t.disk.del.running}</p>
            <progress
              className={styles.bar}
              max={step.plan.items.length}
              value={p?.itemsDone ?? 0}
              aria-label={t.disk.del.running}
            />
            <p>
              {t.disk.del.progress(
                p?.itemsDone ?? 0,
                step.plan.items.length,
                formatCount(p?.filesDeleted ?? 0),
              )}
            </p>
            {p?.current ? <p className={styles.muted}>{p.current}</p> : null}
          </div>
        );
      }
      case 'report':
        return (
          <Report
            report={step.report}
            onPermanentInstead={(nodes) => {
              setMode('permanent');
              setTyped('');
              setStep({ kind: 'planning' });
              setIds(nodes);
            }}
          />
        );
    }
  })();

  let footer;
  if (step.kind === 'confirm') {
    const plan = step.plan;
    const required = mode === 'trash' ? plan.trashConfirmation : plan.permanentConfirmation;
    const ok = plan.items.length > 0 && (required === null || typed.trim() === required);
    footer = (
      <>
        <Button onClick={close}>{t.disk.del.cancel}</Button>
        {plan.items.length > 0 ? (
          <Button variant="danger" disabled={!ok} onClick={() => void start(plan)}>
            {mode === 'trash' ? t.disk.del.trashBtn : t.disk.del.permBtn}
          </Button>
        ) : null}
      </>
    );
  } else if (step.kind === 'running') {
    footer = (
      <Button onClick={() => void disk.cancelDelete(step.plan.planId)}>{t.disk.del.stop}</Button>
    );
  } else {
    footer = <Button onClick={close}>{t.disk.del.close}</Button>;
  }

  return (
    <Dialog
      open
      onClose={close}
      title={step.kind === 'report' ? t.disk.del.titleDone : t.disk.del.title}
      footer={footer}
    >
      <div className={styles.body} data-testid="delete-dialog">
        {body}
      </div>
    </Dialog>
  );
}

function Confirm({
  plan,
  mode,
  typed,
  onMode,
  onTyped,
}: {
  plan: DeletePlan;
  mode: DeleteMode;
  typed: string;
  onMode: (m: DeleteMode) => void;
  onTyped: (v: string) => void;
}) {
  const required = mode === 'trash' ? plan.trashConfirmation : plan.permanentConfirmation;
  const has = (flag: 'userData' | 'program') => plan.items.some((i) => i.flags.includes(flag));
  return (
    <>
      {plan.items.length === 0 ? (
        <p role="alert">{t.disk.del.nothing}</p>
      ) : (
        <>
          <h3 className={styles.h}>{t.disk.del.items}</h3>
          <ul className={styles.items} data-testid="delete-items">
            {plan.items.map((i) => (
              <li key={i.nodeId}>
                <span className={styles.path}>{i.path}</span>
                <span className={styles.muted}>
                  {formatBytes(i.bytes)} · {t.disk.details.files}: {formatCount(i.files)}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.strong} data-testid="delete-total">
            {t.disk.del.total(
              plan.items.length,
              formatBytes(plan.totalBytes),
              formatCount(plan.totalFiles),
            )}
          </p>

          {has('userData') ? (
            <p className={styles.warn} role="note">
              {t.disk.del.warnUser}
            </p>
          ) : null}
          {has('program') ? (
            <p className={styles.warn} role="note">
              {t.disk.del.warnProgram}
            </p>
          ) : null}
          {plan.large ? (
            <p className={styles.warn} role="note">
              {t.disk.del.warnLarge(formatCount(plan.totalFiles), formatBytes(plan.totalBytes))}
            </p>
          ) : null}
          {!plan.trashLikely ? (
            <p className={styles.warn} role="note">
              {t.disk.del.warnNoBin}
            </p>
          ) : null}

          <fieldset className={styles.modes}>
            <legend>{t.disk.del.modeLabel}</legend>
            <label>
              <input
                type="radio"
                name="del-mode"
                checked={mode === 'trash'}
                onChange={() => onMode('trash')}
              />
              {t.disk.del.modeTrash}
            </label>
            <label>
              <input
                type="radio"
                name="del-mode"
                checked={mode === 'permanent'}
                onChange={() => onMode('permanent')}
              />
              {t.disk.del.modePermanent}
            </label>
          </fieldset>
          {mode === 'permanent' ? (
            <p className={styles.warn} role="note">
              {t.disk.del.warnPermanent}
            </p>
          ) : null}
          {required !== null ? (
            <TextField
              label={t.disk.del.typeLabel(required)}
              hint={t.disk.del.typeHint}
              value={typed}
              onChange={(e) => onTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-autofocus
            />
          ) : null}
        </>
      )}
      {plan.denied.length > 0 ? (
        <>
          <h3 className={styles.h}>{t.disk.del.notDeletable}</h3>
          <ul className={styles.items} data-testid="delete-denied">
            {plan.denied.map((d) => (
              <li key={d.nodeId}>
                <span className={styles.path}>{d.name || '—'}</span>
                <span className={styles.muted}>{denyText(d.reason)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function Report({
  report,
  onPermanentInstead,
}: {
  report: DeleteReport;
  onPermanentInstead: (nodes: number[]) => void;
}) {
  const unavailable = report.items.filter((i) => i.outcome === 'trashUnavailable');
  const partial = report.items.some((i) => i.outcome === 'partial');
  return (
    <div data-testid="delete-report">
      {report.cancelled ? <p role="status">{t.disk.del.report.cancelled}</p> : null}
      <p className={styles.strong}>
        {t.disk.del.report.freed(formatBytes(report.freedBytes))} ·{' '}
        {t.disk.del.report.files(formatCount(report.filesDeleted))}
      </p>
      {report.freedBytes > 0 ? (
        <p className={styles.muted}>
          {report.mode === 'trash' ? t.disk.del.report.toBin : t.disk.del.report.permanent}
        </p>
      ) : null}
      <ul className={styles.items}>
        {report.items.map((i) => (
          <li key={i.node}>
            <span className={styles.path}>{i.name}</span>
            <span data-outcome={i.outcome}>
              {t.disk.del.report.outcome[i.outcome]}
              {i.reason
                ? ` – ${t.disk.del.report.reason[i.reason] ?? t.disk.deny[i.reason as DenyReason] ?? i.reason}`
                : ''}
            </span>
            {i.errors.length > 0 ? (
              <ul className={styles.errors}>
                {i.errors.map((e) => (
                  <li key={e.path}>
                    <code>{e.path}</code> – {t.disk.del.report.reason[e.reason]}
                  </li>
                ))}
                {i.errorsTotal > i.errors.length ? (
                  <li>{t.disk.del.report.moreErrors(i.errorsTotal - i.errors.length)}</li>
                ) : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {partial ? <p className={styles.muted}>{t.disk.del.report.partialHint}</p> : null}
      {unavailable.length > 0 ? (
        <Button variant="danger" onClick={() => onPermanentInstead(unavailable.map((i) => i.node))}>
          {t.disk.del.report.permanentInstead}
        </Button>
      ) : null}
    </div>
  );
}
