import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { updateSupporterPrefs } from '@/core/supporter';
import { settingsPath } from '@/core/settings/registry/paths';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, patternStyles } from '@/ui';

const s = t.setup.steps.support;

/**
 * Optional last hint, shown once at the end of the assistant. Writes nothing on "Weiter";
 * "Überspringen" is the "Später", "Nicht mehr zeigen" removes the step for good.
 */
export default function SupporterStep({ registerCommit }: SetupStepProps) {
  const navigate = useNavigate();
  const toast = useUiStore((st) => st.toast);
  useEffect(() => registerCommit(null), [registerCommit]);
  return (
    <>
      <p>{s.text}</p>
      <div className={patternStyles.actions}>
        <Button onClick={() => void navigate(settingsPath('ueber', 'supporter'))}>{s.open}</Button>
        <Button
          variant="ghost"
          onClick={() =>
            void updateSupporterPrefs({ hideSetupHint: true }).then(() => toast(s.hidden))
          }
        >
          {s.hide}
        </Button>
      </div>
    </>
  );
}
