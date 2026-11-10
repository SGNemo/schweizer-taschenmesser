import { useState } from 'react';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, TextField } from '@/ui';
import { placeRepo, type StoredPlace } from '../repo';

/** Gives a place the person's own name ("Mama", "Büro Tokio"); the zone stays. Keyed by the place, so it starts fresh. */
export function RenameDialog({
  place,
  onClose,
}: {
  place: StoredPlace | null;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(place?.label ?? '');
  const value = label.trim();
  const save = () => {
    if (!place || !value) return;
    if (value !== place.label)
      void changeWithUndo(() => placeRepo.update(place.id, { label: value }), t.clock.renamed);
    onClose();
  };
  return (
    <Dialog
      open={!!place}
      onClose={onClose}
      title={t.clock.rename.title}
      askAfterTyping
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button variant="primary" onClick={save} disabled={!value}>
            {t.actions.save}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextField
          label={t.clock.rename.label}
          hint={place ? t.clock.rename.hint(place.zone) : undefined}
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
          data-autofocus
          data-testid="clock-rename"
        />
      </form>
    </Dialog>
  );
}
