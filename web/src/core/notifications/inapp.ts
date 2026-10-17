import { create } from 'zustand';
import { baseKey } from './policy';

/** A reminder shown inside the app (with "Erledigt" and "Später") while the app is open. */
export interface InAppPrompt {
  key: string;
  title: string;
  /** The reminder's own title (a repeat shows "Noch offen: …"); "Später" keeps this one. */
  baseTitle?: string;
  body?: string;
  url?: string;
}

interface PromptState {
  items: InAppPrompt[];
  push(p: InAppPrompt): void;
  dismiss(key: string): void;
}

export const useReminderPrompts = create<PromptState>((set) => ({
  items: [],
  // A repeat ("Noch offen: …") replaces the card of the same reminder instead of stacking up.
  push: (p) =>
    set((s) =>
      s.items.some((x) => x.key === p.key)
        ? s
        : { items: [...s.items.filter((x) => baseKey(x.key) !== baseKey(p.key)), p].slice(-5) },
    ),
  dismiss: (key) => set((s) => ({ items: s.items.filter((x) => x.key !== key) })),
}));
