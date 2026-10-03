import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { useUiStore } from '@/stores/ui';
import { loadModuleStates } from './activation';
import { offerEnableModule } from './offerEnable';

beforeEach(async () => {
  await db.table('_modules').clear();
  useUiStore.setState({ toasts: [] });
});

describe('offerEnableModule', () => {
  it('toasts the reason with an action that switches the module on, then finishes the job', async () => {
    const then = vi.fn();
    offerEnableModule('lists', 'Dafür braucht es „Listen“.', then);
    const [toast] = useUiStore.getState().toasts;
    expect(toast).toMatchObject({ message: 'Dafür braucht es „Listen“.' });
    expect(toast!.action?.label).toBe('Aktivieren');
    expect((await loadModuleStates()).lists).not.toBe(true);

    toast!.action!.run();
    await vi.waitFor(() => expect(then).toHaveBeenCalledTimes(1));
    expect((await loadModuleStates()).lists).toBe(true);
    expect(useUiStore.getState().toasts.map((x) => x.message)).toContain(
      'Das Modul „Listen“ ist jetzt eingeschaltet.',
    );
  });

  it('only shows the message for an unknown module', () => {
    offerEnableModule('does-not-exist', 'Nicht verfügbar.');
    const [toast] = useUiStore.getState().toasts;
    expect(toast).toMatchObject({ message: 'Nicht verfügbar.' });
    expect(toast!.action).toBeUndefined();
  });
});
