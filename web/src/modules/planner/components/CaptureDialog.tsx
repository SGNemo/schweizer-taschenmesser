import type { ReactNode } from 'react';
import { t } from '@/strings';
import { Dialog } from '@/ui';

/**
 * The phone's capture (planner hub R1): the first screen there is band and sheet, the plus of the bottom bar
 * („Ding“) opens the field as a sheet. The dialog brings focus into the field, the trap, Esc / scrim / swipe to close and
 * the way back to the plus; it stays open after an entry, so the next one follows right away.
 */
export function CaptureDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The field (`Capture` with `focusOnOpen`) and what the planner answers under it. */
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.planner.add.label}>
      {children}
    </Dialog>
  );
}
