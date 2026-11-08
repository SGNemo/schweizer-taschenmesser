// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  await clearAll();
  useUiStore.setState({ toasts: [] });
});

describe('announceSaved – a reminder must be able to arrive (C01)', () => {
  it('asks for notifications once when a reminder is saved', async () => {
    const s = service('default', 'granted');
    await announceSaved(saved('reminder'), s);
    expect(s.requestPermission).toHaveBeenCalledTimes(1);
    expect(lastToast()?.message).toBe(t.quickCapture.saved(t.quickCapture.target.reminder));
    expect(lastToast()?.action?.label).toBe(t.quickCapture.undo);
  });

  it('says calmly where to turn alerts on after a no, and keeps undo', async () => {
    const s = service('denied');
    await announceSaved(saved('reminder'), s);
    expect(s.requestPermission).not.toHaveBeenCalled();
    expect(lastToast()?.message).toBe(
      t.quickCapture.alertsOff(t.quickCapture.saved(t.quickCapture.target.reminder)),
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
});
