/**
 * The planner's quiet row below its settings (package 8, COPY Z3; `ModuleSettings.extra`): „Gemessene Zeiten löschen“
 * with one confirm and one undo. The switch „Aus gemessener Zeit vorschlagen“ is a plain field; off deletes nothing.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, SettingRow } from '@/ui';
import { deleteMeasures } from '../measure';
import { measureRepo } from '../repo';

export default function MeasureSettings() {
  const count = useLiveQuery(() => measureRepo.active().count(), []);
  const [open, setOpen] = useState(false);
  const m = t.planner.measure;
  const remove = async () => {
    setOpen(false);
    await undoableWithToast(m.deleteAll, m.deleted, deleteMeasures);
  };
  return (
    <SettingRow id="planner-measure-delete" label={m.deleteAll}>
      <Button variant="ghost" disabled={!count} onClick={() => setOpen(true)}>
        {t.actions.delete}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={m.deleteAll}
        footer={
          <>
            <Button data-autofocus onClick={() => setOpen(false)}>
              {t.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              {t.actions.delete}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </SettingRow>
  );
}
