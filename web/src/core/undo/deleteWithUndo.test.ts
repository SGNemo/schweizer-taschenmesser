import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { changeWithUndo, deleteWithUndo } from './withToast';
import { resetUndoJournal, undoDepth } from './index';

describe('deleteWithUndo / changeWithUndo', () => {
  beforeEach(() => resetUndoJournal());

  it('runs the action and returns its result without a journal entry when nothing was written', async () => {
    await expect(deleteWithUndo(async () => 42)).resolves.toBe(42);
    expect(undoDepth()).toBe(0);
  });

  it('shows a toast with an undo action only when a write happened (changeWithUndo, no write: no action)', async () => {
    const toast = useUiStore.getState().toast;
    const calls: unknown[][] = [];
    useUiStore.setState({ toast: ((...a: unknown[]) => calls.push(a)) as typeof toast });
    await changeWithUndo(async () => undefined);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBeUndefined();
    useUiStore.setState({ toast });
  });
});
