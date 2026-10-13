import { useState, type ReactNode } from 'react';
import { useAdvanced } from '@/core/settings/comfort';
import { tAdvanced } from '@/strings.advanced';
import { Button } from './Button';
import { Switch } from './Fields';

/**
 * "Erweitert" switch for a module header: Basis (default) or Erweitert for this module. The choice
 * is remembered (synced) and overrides the global "Alle Module Erweitert" setting.
 */
export function AdvancedToggle({ moduleId }: { moduleId: string }) {
  const [advanced, setAdvanced] = useAdvanced(moduleId);
  const tx = tAdvanced.use();
  return <Switch label={tx.switchLabel} checked={advanced} onChange={setAdvanced} />;
}

/**
 * Rarely used fields of a form. Shown when the module is in the Erweitert view, when one of them
 * already holds data (`hasData`: nothing is ever hidden that is in use), or after "Mehr Felder"
 * in this dialog (that does not change the module's setting). Nothing important lives only here.
 */
export function AdvancedFields({
  moduleId,
  hasData = false,
  children,
}: {
  moduleId: string;
  hasData?: boolean;
  children: ReactNode;
}) {
  const [advanced] = useAdvanced(moduleId);
  const [revealed, setRevealed] = useState(false);
  const tx = tAdvanced.use();
  if (advanced || hasData || revealed) return <>{children}</>;
  return (
    <div>
      <Button variant="ghost" aria-label={tx.moreFieldsAria} onClick={() => setRevealed(true)}>
        {tx.moreFields}
      </Button>
    </div>
  );
}
