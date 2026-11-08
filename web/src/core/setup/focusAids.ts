/**
 * Setup step "Fokus-Hilfen" (core.focus): five switches over existing settings, nothing new is
 * stored here. Each switch maps to the values its sentence in the step promises (strings
 * `t.setup.steps.focus`); the calm preselection is the recommendation, never forced. Pure apart
 * from `readFocusAids` / `writeFocusAids`.
 */
import { getFocusSettings, patchFocusSettings, type FocusSettings } from '@/core/settings/focus';
import { useUiStore, type MotionChoice } from '@/stores/ui';

export interface FocusAids {
  /** Motion "Weniger" (`motion: 'reduce'`). */
  motion: boolean;
  /** No morning ToDo digest and no extra staggered leads; reminders set on an entry still come. */
  ownReminders: boolean;
  /** No "n in Folge" on recurring ToDos, no longest habit streak, no week review in "Jetzt dran". */
  noCounts: boolean;
  /** Toasts stay until "Schließen". */
  toastStay: boolean;
  /** Reading aid; offered, not part of the calm preselection. */
  readAid: boolean;
}

export const CALM_KEYS = ['motion', 'ownReminders', 'noCounts', 'toastStay'] as const;

export function calmPreset(current: FocusAids): FocusAids {
  return { ...current, motion: true, ownReminders: true, noCounts: true, toastStay: true };
}

interface UiPart {
  motion: MotionChoice;
  toastStay: boolean;
  readAid: boolean;
}
type FocusPart = Pick<FocusSettings, 'todoDigest' | 'staggered' | 'streaks' | 'weekReview'>;

export function focusAidsOf(ui: UiPart, focus: FocusPart): FocusAids {
  return {
    motion: ui.motion === 'reduce',
    ownReminders: !focus.todoDigest && !focus.staggered,
    noCounts: !focus.streaks && !focus.weekReview,
    toastStay: ui.toastStay,
    readAid: ui.readAid,
  };
}

/** What to write to get from `before` to `next`: only switches that changed. */
export function focusAidsPatch(
  before: FocusAids,
  next: FocusAids,
): { ui: Partial<UiPart>; focus: Partial<FocusPart> } {
  const ui: Partial<UiPart> = {};
  const focus: Partial<FocusPart> = {};
  if (next.motion !== before.motion) ui.motion = next.motion ? 'reduce' : 'system';
  if (next.toastStay !== before.toastStay) ui.toastStay = next.toastStay;
  if (next.readAid !== before.readAid) ui.readAid = next.readAid;
  if (next.ownReminders !== before.ownReminders) {
    if (next.ownReminders) Object.assign(focus, { todoDigest: false, staggered: false });
    else focus.todoDigest = true;
  }
  if (next.noCounts !== before.noCounts) {
    if (next.noCounts) Object.assign(focus, { streaks: false, weekReview: false });
    else Object.assign(focus, { streaks: true, weekReview: true });
  }
  return { ui, focus };
}

export async function readFocusAids(): Promise<FocusAids> {
  const s = useUiStore.getState();
  return focusAidsOf(s, await getFocusSettings());
}

export async function writeFocusAids(before: FocusAids, next: FocusAids): Promise<void> {
  const { ui, focus } = focusAidsPatch(before, next);
  const s = useUiStore.getState();
  if (ui.motion) s.setMotion(ui.motion);
  if (ui.toastStay !== undefined) s.setToastStay(ui.toastStay);
  if (ui.readAid !== undefined) s.setReadAid(ui.readAid);
  if (Object.keys(focus).length > 0) await patchFocusSettings(focus);
}
