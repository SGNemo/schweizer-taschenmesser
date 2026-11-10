// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resync = vi.hoisted(() => vi.fn(async () => 1));
vi.mock('@/core/notifications/nativeSchedule', () => ({ resyncNativeSchedule: resync }));
import { clearAll } from '@/core/ai/testing';
import { patchFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { SavedCapture } from '../targets';
import { announceSaved } from './announceSaved';

const saved = (type: SavedCapture['type']): SavedCapture => ({
  id: 'x',
  type,
  moduleId: 'calendar',
  undo: async () => undefined,
});
const service = (state: string, answer = state) => ({
  permission: () => state as never,
  requestPermission: vi.fn(async () => answer as never),
  show: async () => undefined,
});
const lastToast = () => useUiStore.getState().toasts.at(-1);

beforeEach(async () => {
  resync.mockClear();
  localStorage.clear();
  await clearAll();
  useUiStore.setState({ toasts: [] });
});

describe('announceSaved – a reminder must be able to arrive (C01)', () => {
  it('asks for notifications once when a reminder is saved', async () => {
    const s = service('default', 'granted');
    await announceSaved(saved('reminder'), s);
    expect(s.requestPermission).toHaveBeenCalledTimes(1);
    expect(resync).toHaveBeenCalledTimes(1); // Android: the new alarm is scheduled right away
    expect(lastToast()?.message).toBe(t.quickCapture.saved(t.quickCapture.target.reminder));
    expect(lastToast()?.action?.label).toBe(t.quickCapture.undo);
  });

  it('says calmly where to unblock alerts after a no, and keeps undo', async () => {
    const s = service('denied');
    await announceSaved(saved('reminder'), s);
    expect(s.requestPermission).not.toHaveBeenCalled();
    expect(resync).not.toHaveBeenCalled();
    expect(lastToast()?.message).toBe(
      t.quickCapture.alertsBlocked(t.quickCapture.saved(t.quickCapture.target.reminder)),
    );
    expect(lastToast()?.action?.label).toBe(t.quickCapture.undo);
  });

  it('stays silent about alerts when the hint is switched off', async () => {
    await patchFocusSettings({ leadHint: false });
    await announceSaved(saved('reminder'), service('denied'));
    expect(lastToast()?.message).toBe(t.quickCapture.saved(t.quickCapture.target.reminder));
  });

  it('never asks for a ToDo', async () => {
    const s = service('default');
    await announceSaved(saved('todo'), s);
    expect(s.requestPermission).not.toHaveBeenCalled();
  });

  it('asks for a reminder inside a multi-line save', async () => {
    const s = service('default', 'granted');
    await announceSaved(
      { ...saved('todo'), count: 2, text: 'a\nb', types: ['todo', 'reminder'] },
      s,
    );
    expect(s.requestPermission).toHaveBeenCalledTimes(1);
    expect(lastToast()?.message).toBe(t.quickCapture.multi.saved(2));
  });

  it('a dismissed prompt is not asked again; the toast points to the settings', async () => {
    await announceSaved(saved('reminder'), service('default', 'default'));
    const again = service('default', 'granted');
    await announceSaved(saved('reminder'), again);
    expect(again.requestPermission).not.toHaveBeenCalled();
    expect(lastToast()?.message).toBe(
      t.quickCapture.alertsOff(t.quickCapture.saved(t.quickCapture.target.reminder)),
    );
  });

  it('still shows the toast with undo when the permission check fails', async () => {
    const broken = {
      ...service('default'),
      permission: () => {
        throw new Error('x');
      },
    };
    await announceSaved(saved('reminder'), broken as never);
    expect(lastToast()?.action?.label).toBe(t.quickCapture.undo);
  });
});

describe('announceSaved – the closing line after a batch (U05)', () => {
  it('reads „<n> Dinge gespeichert. Sortiert wird später.“ with „Ansehen“ and „Rückgängig“', async () => {
    const undo = vi.fn(async () => undefined);
    const navigate = vi.fn();
    await announceSaved(
      { ...saved('todo'), count: 5, text: 'a\nb', types: ['todo', 'todo'], undo },
      service('granted'),
      navigate,
    );
    const toast = lastToast()!;
    expect(toast.message).toBe('5 Dinge gespeichert. Sortiert wird später.');
    expect(toast.lead?.label).toBe('Ansehen');
    expect(toast.action?.label).toBe('Rückgängig');
    toast.lead!.run();
    // The planner is off in a fresh database: the ToDo inbox with „Eingang sortieren“.
    expect(navigate).toHaveBeenCalledWith('/todos?list=inbox');
    toast.action!.run();
    await vi.waitFor(() => expect(undo).toHaveBeenCalled());
  });

  it('offers no „Ansehen“ where the caller cannot navigate', async () => {
    await announceSaved({ ...saved('todo'), count: 2, text: 'a\nb' }, service('granted'));
    expect(lastToast()?.lead).toBeUndefined();
  });
});
