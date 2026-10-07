import { create } from 'zustand';

/** A reminder shown inside the app (with "Erledigt" and "Später") while the app is open. */
export interface InAppPrompt {
  key: string;
  title: string;
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
  push: (p) =>
    set((s) => (s.items.some((x) => x.key === p.key) ? s : { items: [...s.items, p].slice(-5) })),
  dismiss: (key) => set((s) => ({ items: s.items.filter((x) => x.key !== key) })),
}));
