/**
 * The compose window opened from a plan row (planner hub 2, package 4c). It lives in mail's strip at the planner's
 * foot (`components/PlanFoot.tsx`), not in the row: closing or losing the row (Esc on it, a sync that ticks the ToDo,
 * the day re-reading) never takes a typed reply along. Closing it gives the focus back to what opened it.
 */
import { create } from 'zustand';
import type { MailAccountRef } from '@/core/mail/types';
import type { ComposeState } from './composeState';

interface OpenCompose {
  state: ComposeState;
  title: string;
  account: MailAccountRef;
}

interface Store {
  open?: OpenCompose;
  /** What had the focus when it opened („Antworten“ in the panel, „Zurückziehen“ at the foot). */
  returnTo?: HTMLElement | null;
}

export const usePlanCompose = create<Store>(() => ({}));

export function openPlanCompose(open: OpenCompose): void {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  usePlanCompose.setState({ open, returnTo: active instanceof HTMLElement ? active : null });
}

export function closePlanCompose(): void {
  const back = usePlanCompose.getState().returnTo;
  usePlanCompose.setState({ open: undefined, returnTo: undefined });
  // After the dialog left the page: back to what opened it, when it is still there.
  setTimeout(() => {
    if (back?.isConnected) back.focus({ preventScroll: true });
  });
}
