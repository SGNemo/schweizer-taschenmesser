import { useEffect, useState } from 'react';
import { calmPreset, readFocusAids, writeFocusAids, type FocusAids } from '@/core/setup/focusAids';
import { readSetupState } from '@/core/setup/state';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { patternStyles, Switch } from '@/ui';

const KEYS = ['motion', 'ownReminders', 'noCounts', 'toastStay', 'readAid'] as const;

/**
 * "Fokus-Hilfen": five switches, one complete sentence each, the calm preselection (the reading aid
 * stays as it is) – only while the step is still open; reopened after it was done, it shows the
 * current values. Nothing is written until the wizard's primary button; then only what changed.
 */
export default function FocusStep({ registerCommit, setCanContinue, mode }: SetupStepProps) {
  const s = t.setup.steps.focus;
  const [before, setBefore] = useState<FocusAids | null>(null);
  const [draft, setDraft] = useState<FocusAids | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([readFocusAids(), readSetupState()]).then(([current, state]) => {
      if (!live) return;
      setBefore(current);
      const done = state?.doneSteps.includes('core.focus') ?? false;
      setDraft(done ? current : calmPreset(current));
    });
    return () => {
      live = false;
    };
  }, []);

  // "Weiter" waits until the switches are shown: a tap before would record the step without writing.
  useEffect(() => {
    setCanContinue(!!draft);
  }, [setCanContinue, draft]);

  useEffect(() => {
    if (!before || !draft) return;
    registerCommit(() => writeFocusAids(before, draft));
    return () => registerCommit(null);
  }, [registerCommit, before, draft]);

  // Loads in a moment; the wizard keeps "Weiter" off meanwhile. No PageContainer import: it would
  // split a shared chunk onto the start path (bundle budget).
  if (!draft) return null;
  return (
    <>
      <p className={patternStyles.muted} data-testid="setup-focus-preselect">
        {s.preselect} {mode === 'quick' ? s.laterQuick : s.laterFull}
      </p>
      {KEYS.map((key) => (
        <div key={key} data-testid={`setup-focus-${key}`}>
          <Switch
            label={s[key]}
            checked={draft[key]}
            onChange={(on) => setDraft({ ...draft, [key]: on })}
          />
          <p className={patternStyles.muted}>{s[`${key}Hint`]}</p>
        </div>
      ))}
      <p className={patternStyles.muted}>{s.where}</p>
    </>
  );
}
