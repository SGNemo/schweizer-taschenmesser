import { today } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { donePatch, whoseTurn, type StoredRoutine } from './logic';
import { routineRepo } from './repo';

/**
 * "Erledigt": the routine moves to its next day and the next name. The toast says whose turn it is then and
 * offers "Rückgängig", which puts day, turn and "last done" back exactly as they were.
 */
export async function markDone(r: StoredRoutine): Promise<void> {
  const patch = donePatch(r, today());
  const message = t.routines.doneToast(r.name, whoseTurn({ people: r.people, turn: patch.turn }));
  await undoableWithToast(message, message, () => routineRepo.update(r.id, patch));
}
