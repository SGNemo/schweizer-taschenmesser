import { useSetupHost } from '@/core/setup/host';
import { t } from '@/strings';
import { Button } from '@/ui';

/** "Einrichtung öffnen" – for empty states and the module library. */
export function SetupLink({ variant = 'ghost' }: { variant?: 'ghost' | 'secondary' | 'primary' }) {
  const open = useSetupHost((s) => s.openWizard);
  return (
    <Button variant={variant} onClick={() => open()}>
      {t.setup.open}
    </Button>
  );
}
