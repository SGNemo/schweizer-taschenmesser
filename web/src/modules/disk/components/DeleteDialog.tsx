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
import { Button, Dialog } from '@/ui';
import { formatBytes, formatCount } from '../format';
import styles from './DeleteDialog.module.css';

type Step =
  | { kind: 'planning' }
  | { kind: 'confirm'; plan: DeletePlan }
  /** The second confirmation of a permanent or large deletion. */
  | { kind: 'again'; plan: DeletePlan }
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

/** A click this soon after the second question appears is ignored (a double click is not two yeses). */
const ARM_MS = 600;

/**
 * The only way to delete: check (block list, sizes, warnings) → confirm (path, size, bin vs.
 * permanent) → for large or permanent deletions a second, separate confirmation → run with
 * progress and cancel → report. The native side re-checks everything, including that the second
 * confirmation was given.
 */
export function DeleteDialog({ scanId, nodeIds, presetMode = 'trash', onClose }: Props) {
  const disk = getPlatform().disk;
  const [ids, setIds] = useState(nodeIds);
  const [mode, setMode] = useState<DeleteMode>(presetMode);
  const [step, setStep] = useState<Step>({ kind: 'planning' });
  const [armed, setArmed] = useState(false);
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

  // The "yes" of the second question only works after a short moment, so one hasty double click
  // can never give both confirmations.
  const asking = step.kind === 'again';
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setArmed(true), ARM_MS);
    return () => {
      clearTimeout(timer);
      setArmed(false);
    };
  }, [asking]);

  const running = step.kind === 'running';
  const close = () => {
    if (!running) onClose(changed.current, root.current);
  };

  const needsTwice = (plan: DeletePlan) =>
    mode === 'trash' ? plan.trashDoubleConfirm : plan.permanentDoubleConfirm;

  const start = async (plan: DeletePlan, confirmedTwice: boolean) => {
    setStep({ kind: 'running', plan, progress: null });
    try {
      const report = await disk.runDelete(plan.planId, mode, confirmedTwice, (progress) =>
        setStep((s) => (s.kind === 'running' ? { ...s, progress } : s)),
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
        return <Confirm plan={step.plan} mode={mode} onMode={setMode} />;
      case 'again':
        return (
          <div className={styles.again} role="alert" data-testid="delete-again">
            <p className={styles.strong}>{t.disk.del.againTitle}</p>
            <p>
              {mode === 'trash'
                ? t.disk.del.againTrash(
                    step.plan.items.length,
                    formatBytes(step.plan.totalBytes),
                    formatCount(step.plan.totalFiles),
                  )
                : t.disk.del.againPermanent(
                    step.plan.items.length,
                    formatBytes(step.plan.totalBytes),
                    formatCount(step.plan.totalFiles),
                  )}
            </p>
          </div>
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
    footer = (
      <>
        <Button onClick={close}>{t.disk.del.cancel}</Button>
        {plan.items.length > 0 ? (
          <Button
            variant="danger"
            onClick={() =>
              needsTwice(plan) ? setStep({ kind: 'again', plan }) : void start(plan, false)
            }
          >
            {mode === 'trash' ? t.disk.del.trashBtn : t.disk.del.permBtn}
          </Button>
        ) : null}
      </>
    );
  } else if (step.kind === 'again') {
    const plan = step.plan;
    footer = (
      <>
        <Button onClick={() => setStep({ kind: 'confirm', plan })} data-autofocus>
          {t.disk.del.back}
        </Button>
        <Button variant="danger" disabled={!armed} onClick={() => void start(plan, true)}>
          {mode === 'trash' ? t.disk.del.againYesTrash : t.disk.del.againYesPermanent}
        </Button>
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
  onMode,
}: {
  plan: DeletePlan;
  mode: DeleteMode;
  onMode: (m: DeleteMode) => void;
}) {
  const twice = mode === 'trash' ? plan.trashDoubleConfirm : plan.permanentDoubleConfirm;
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
          {twice ? (
            <p className={styles.muted} data-testid="delete-twice-hint">
              {t.disk.del.twiceHint}
            </p>
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
