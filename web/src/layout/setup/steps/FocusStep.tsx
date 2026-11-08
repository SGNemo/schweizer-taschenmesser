import { useEffect, useState } from 'react';
import { calmPreset, readFocusAids, writeFocusAids, type FocusAids } from '@/core/setup/focusAids';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { PageFallback } from '@/layout/PageContainer';
import { patternStyles, Switch } from '@/ui';

const KEYS = ['motion', 'ownReminders', 'noCounts', 'toastStay', 'readAid'] as const;

/**
 * "Fokus-Hilfen": five switches, one complete sentence each, preselected "Ruhig" (the reading aid
 * stays as it is). Nothing is written until "Weiter"; then only the switches that changed.
 */
export default function FocusStep({ registerCommit }: SetupStepProps) {
  const s = t.setup.steps.focus;
  const [before, setBefore] = useState<FocusAids | null>(null);
  const [draft, setDraft] = useState<FocusAids | null>(null);

  useEffect(() => {
    let live = true;
    void readFocusAids().then((current) => {
      if (!live) return;
      setBefore(current);
      setDraft(calmPreset(current));
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!before || !draft) return;
    registerCommit(() => writeFocusAids(before, draft));
    return () => registerCommit(null);
  }, [registerCommit, before, draft]);

  if (!draft) return <PageFallback />;
  return (
    <>
      <p className={patternStyles.muted} data-testid="setup-focus-preselect">
        {s.preselect}
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
