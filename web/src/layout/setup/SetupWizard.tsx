import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { useBackClose, useSetupState } from '@/core/setup/hooks';
import { applicableSteps, buildSetupCtx, detectDone, allSetupSteps } from '@/core/setup/registry';
import {
  completeSetup,
  continueOutcome,
  countedSteps,
  dismissSetup,
  initialState,
  markStepDone,
  markStepSkipped,
  newSteps,
  pauseSetup,
  resumeStep,
  stepProgress,
} from '@/core/setup/state';
import type { SetupCtx, SetupStepDef, SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { Badge, Button, Dialog, ReadableText } from '@/ui';
import { PageContainer, PageFallback } from '../PageContainer';
import styles from './SetupWizard.module.css';

type View = 'start' | 'step' | 'summary' | 'confirm' | 'quick';

/** The three first-run questions, in order; a step the app does not offer right now is left out. */
const QUICK_IDS = ['core.basics', 'core.profiles', 'core.ai'] as const;

const lazyCache = new WeakMap<object, ComponentType<SetupStepProps>>();
function stepComponent(step: SetupStepDef): ComponentType<SetupStepProps> {
  let cmp = lazyCache.get(step.component);
  if (!cmp) {
    cmp = lazy(step.component);
    lazyCache.set(step.component, cmp);
  }
  return cmp;
}

function StepView({ step, ...props }: SetupStepProps & { step: SetupStepDef }) {
  const [Step] = useState(() => stepComponent(step));
  return <Step {...props} />;
}

interface Props {
  onClose: () => void;
  /** Open at this step (checklist link). */
  stepId?: string | null;
  /** Injectable for tests; defaults to all registered steps. */
  steps?: readonly SetupStepDef[];
}

/**
 * The setup assistant. Every "Weiter" writes that step on its own (via the step's registered
 * commit) and records it; closing at any point drops only the current, unconfirmed step.
 */
export function SetupWizard({ onClose, stepId, steps = allSetupSteps }: Props) {
  const stored = useSetupState();
  // No row yet (start migration not run): behave like a fresh, untouched setup.
  const state = stored === undefined ? undefined : (stored ?? initialState());
  const [ctx, setCtx] = useState<SetupCtx | null>(null);
  const [list, setList] = useState<SetupStepDef[] | null>(null);
  const [auto, setAuto] = useState<Set<string>>(new Set());
  const [pickedView, setView] = useState<View | null>(null);
  const [before, setBefore] = useState<View>('step');
  const [pickedIndex, setIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [canContinue, setCanContinue] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [quickIndex, setQuickIndex] = useState(0);
  const commit = useRef<(() => Promise<void | 'skipped'>) | null>(null);
  const cancelled = useRef(false);

  // Load the applicable steps once.
  useEffect(() => {
    let live = true;
    void (async () => {
      const c = await buildSetupCtx();
      const applicable = await applicableSteps(steps, c);
      const done = await detectDone(applicable, c);
      if (!live) return;
      setCtx(c);
      setList(applicable);
      setAuto(done);
    })();
    return () => {
      live = false;
    };
  }, [steps]);

  // Where to begin: the checklist target, else the resume offer when there is progress.
  const target = list && stepId ? list.findIndex((s) => s.id === stepId) : -1;
  const hasProgress = !!state && state.doneSteps.length + state.skippedSteps.length > 0;
  // A really empty installation gets the three questions; everyone else (or a checklist link) the full list.
  const quickSteps = (list ?? []).filter((s) => (QUICK_IDS as readonly string[]).includes(s.id));
  const firstRun =
    quickSteps.length > 0 &&
    target < 0 &&
    !stepId &&
    !hasProgress &&
    state?.status === 'notStarted';
  const view: View =
    pickedView ?? (target < 0 && hasProgress ? 'start' : firstRun ? 'quick' : 'step');
  const index = pickedIndex ?? Math.max(0, target);

  const total = list?.length ?? 0;
  const counted = countedSteps(list ?? []);
  const step = view === 'quick' ? quickSteps[quickIndex] : list?.[index];
  const numberOf = (s: SetupStepDef) => counted.findIndex((c) => c.id === s.id) + 1;

  const requestClose = useCallback(() => {
    if (view === 'confirm') setView(before);
    else if (view === 'step' || view === 'quick') {
      setBefore(view);
      setView('confirm');
    } else onClose();
  }, [view, before, onClose]);

  useBackClose(true, requestClose);

  function go(next: number) {
    commit.current = null;
    setCanContinue(true);
    setBlockedReason(null);
    setError(false);
    if (next >= total) setView('summary');
    else {
      setIndex(Math.max(0, next));
      setView('step');
    }
  }

  async function onNext() {
    if (!step) return;
    // The first answer creates progress, which must not turn the questions into the resume view.
    if (view === 'quick') setView('quick');
    setBusy(true);
    setError(false);
    let outcome: void | 'skipped';
    const committed = commit.current !== null;
    try {
      outcome = await commit.current?.();
    } catch {
      // Deliberately generic: a failing step must never echo values (or secrets) into the UI.
      setError(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    if (cancelled.current) return;
    if (continueOutcome(step, committed, outcome) === 'skipped') await markStepSkipped(step.id);
    else await markStepDone(step.id);
    if (view === 'quick') nextQuestion();
    else go(index + 1);
  }

  /** After a question: the next one, or done – the rest lives on in the dashboard checklist. */
  function nextQuestion() {
    commit.current = null;
    setCanContinue(true);
    setBlockedReason(null);
    if (quickIndex + 1 < quickSteps.length) setQuickIndex(quickIndex + 1);
    else void finish();
  }

  async function onSkip() {
    if (!step) return;
    await markStepSkipped(step.id);
    go(index + 1);
  }

  /** "Alle Schritte ansehen": leave the questions for the full list, at the same step. */
  function showAll() {
    const at = step ? (list ?? []).findIndex((s) => s.id === step.id) : 0;
    commit.current = null;
    setCanContinue(true);
    setBlockedReason(null);
    setIndex(Math.max(0, at));
    setView('step');
  }

  async function leave(kind: 'later' | 'end') {
    cancelled.current = true;
    if (kind === 'later') await pauseSetup();
    else await dismissSetup();
    onClose();
  }

  async function finish() {
    await completeSetup();
    onClose();
  }

  const ready = !!list && !!ctx && !!state;

  let footer = null;
  let body;
  if (!ready) {
    body = <PageFallback />;
  } else if (view === 'confirm') {
    body = (
      <div className={styles.body} data-testid="setup-confirm">
        <h3 className={styles.stepTitle}>{t.setup.cancelTitle}</h3>
        <p className={styles.desc}>{t.setup.cancelText}</p>
        <div className={styles.actions}>
          <Button variant="primary" data-autofocus onClick={() => setView(before)}>
            {t.setup.keepGoing}
          </Button>
          <Button onClick={() => void leave('later')}>{t.setup.later}</Button>
          <Button onClick={() => void leave('end')}>{t.setup.end}</Button>
          <p className={styles.hint}>{t.setup.endHint}</p>
        </div>
      </div>
    );
  } else if (total === 0) {
    body = <p className={styles.desc}>{t.setup.noSteps}</p>;
  } else if (view === 'start') {
    const next = resumeStep(list, state);
    const fresh = newSteps(list, state);
    body = (
      <div className={styles.body}>
        <h3 className={styles.stepTitle}>{t.setup.startTitle}</h3>
        <p className={styles.desc}>
          <ReadableText text={t.setup.startIntro} />
        </p>
        {fresh.length > 0 ? <Badge tone="accent">{t.setup.isNew}</Badge> : null}
        <div className={styles.actions}>
          {next ? (
            <Button
              variant="primary"
              data-autofocus
              onClick={() => go(list.findIndex((s) => s.id === next.id))}
            >
              {t.setup.resumeAt(next.title)}
            </Button>
          ) : (
            <Button variant="primary" data-autofocus onClick={() => setView('summary')}>
              {t.setup.summaryTitle}
            </Button>
          )}
          <Button onClick={() => go(0)}>{t.setup.fromStart}</Button>
          <p className={styles.hint}>{t.setup.fromStartHint}</p>
        </div>
      </div>
    );
  } else if (view === 'summary') {
    body = (
      <div className={styles.body} data-testid="setup-summary">
        <h3 className={styles.stepTitle}>{t.setup.summaryTitle}</h3>
        <p className={styles.desc}>
          <ReadableText text={t.setup.summaryIntro} />
        </p>
        <p className={styles.meta}>
          {t.setup.checklistProgress(
            counted.filter((s) => stepProgress(state, s.id, auto.has(s.id)) === 'done').length,
            counted.length,
          )}
        </p>
        <ul className={styles.list}>
          {counted.map((s) => {
            const i = list.findIndex((x) => x.id === s.id);
            const p = stepProgress(state, s.id, auto.has(s.id));
            return (
              <li key={s.id} className={styles.row}>
                <span>
                  {s.title}{' '}
                  <Badge tone={p === 'done' ? 'accent' : 'neutral'}>
                    {p === 'done'
                      ? t.setup.statusDone
                      : p === 'skipped'
                        ? t.setup.statusSkipped
                        : t.setup.statusOpen}
                  </Badge>
                </span>
                {p !== 'done' ? (
                  <Button aria-label={`${s.title}: ${t.setup.openStep}`} onClick={() => go(i)}>
                    {t.setup.openStep}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
    footer = (
      <>
        <Button onClick={() => go(total - 1)}>{t.setup.back}</Button>
        <Button variant="primary" data-autofocus onClick={() => void finish()}>
          {t.setup.finish}
        </Button>
      </>
    );
  } else if (step && ctx) {
    const isQuick = view === 'quick';
    const quickText = t.setup.quick[step.id.replace('core.', '') as keyof typeof t.setup.quick];
    const position = isQuick ? quickIndex + 1 : numberOf(step);
    const of = isQuick ? quickSteps.length : counted.length;
    const last = isQuick ? quickIndex + 1 >= quickSteps.length : index + 1 >= total;
    body = (
      <div className={styles.body} key={step.id}>
        {position > 0 ? (
          <>
            <div
              className={styles.progress}
              role="progressbar"
              aria-label={t.setup.progressLabel}
              aria-valuemin={0}
              aria-valuemax={of}
              aria-valuenow={position}
            >
              <div className={styles.bar} style={{ width: `${(position / of) * 100}%` }} />
            </div>
            <p className={styles.meta}>
              {isQuick ? t.setup.questionOf(position, of) : t.setup.stepOf(position, of)}
            </p>
          </>
        ) : null}
        <h3 className={styles.stepTitle}>{isQuick && quickText ? quickText.title : step.title}</h3>
        <p className={styles.desc}>
          <ReadableText text={isQuick && quickText ? quickText.description : step.description} />
        </p>
        <Suspense fallback={<PageFallback />}>
          <StepView
            step={step}
            ctx={ctx}
            mode={isQuick ? 'quick' : 'full'}
            registerCommit={(fn) => {
              commit.current = fn;
            }}
            setCanContinue={setCanContinue}
            setBlockedReason={setBlockedReason}
          />
        </Suspense>
        {error ? (
          <p role="alert" className={styles.error}>
            {t.setup.commitFailed}
          </p>
        ) : null}
        <div className={styles.later}>
          <Button variant="ghost" onClick={() => void leave('later')} disabled={busy}>
            {t.setup.restLater}
          </Button>
          {isQuick ? (
            <Button variant="ghost" onClick={showAll} disabled={busy}>
              {t.setup.allSteps}
            </Button>
          ) : null}
        </div>
      </div>
    );
    footer = (
      <>
        {blockedReason && !canContinue ? (
          <p role="status" className={styles.blocked}>
            {blockedReason}
          </p>
        ) : null}
        <Button
          onClick={() => (isQuick ? setQuickIndex(Math.max(0, quickIndex - 1)) : go(index - 1))}
          disabled={(isQuick ? quickIndex === 0 : index === 0) || busy}
        >
          {t.setup.back}
        </Button>
        <span className={styles.footerGroup}>
          {isQuick ? null : (
            <Button onClick={() => void onSkip()} disabled={busy}>
              {t.setup.skip}
            </Button>
          )}
          <Button variant="primary" onClick={() => void onNext()} disabled={busy || !canContinue}>
            {last ? t.setup.finish : t.setup.next}
          </Button>
        </span>
      </>
    );
  }

  return (
    <Dialog
      open
      onClose={requestClose}
      title={t.setup.dialogTitle}
      variant="full"
      footer={footer}
      backHandled
    >
      <PageContainer variant="narrow">{body}</PageContainer>
    </Dialog>
  );
}
