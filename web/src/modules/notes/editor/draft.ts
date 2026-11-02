/**
 * Crash safety: while a page is open the current text is also kept in `localStorage` (this device
 * only, never synced) a moment after each change and dropped once the database write is done. After
 * a crash or a killed tab the page offers the text again. Every access is guarded: storage can be
 * blocked or full, and the editor works without it.
 */
export interface NoteDraft {
  /** Id a not yet stored page will be created with. */
  id?: string;
  title: string;
  body: string;
  at: number;
}

const key = (id: string) => `tm-notes-draft:${id}`;

export function saveDraft(id: string, draft: NoteDraft): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(draft));
  } catch {
    /* storage unavailable or full */
  }
}

export function loadDraft(id: string): NoteDraft | undefined {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return undefined;
    const v = JSON.parse(raw) as Partial<NoteDraft>;
    return typeof v.title === 'string' && typeof v.body === 'string' && typeof v.at === 'number'
      ? {
          title: v.title,
          body: v.body,
          at: v.at,
          ...(typeof v.id === 'string' ? { id: v.id } : {}),
        }
      : undefined;
  } catch {
    return undefined;
  }
}

export function clearDraft(id: string): void {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}
