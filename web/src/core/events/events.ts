import type { EntityRef, LegacyLink } from '@/core/entitylinks/types';

/**
 * Central catalogue of cross-module events. Adding an event here is the
 * "defined interface" through which modules communicate.
 */
export type DataPolicy = 'keep' | 'delete';

export interface EventMap {
  /**
   * The app lock closed the app (Einstellungen → Sicherheit → App-Sperre; idle, background, "Jetzt sperren" or
   * another window). The vault locks too, so passing the app's PIN never opens a vault that needs its master
   * password. No payload.
   */
  'app.locked': Record<string, never>;
  /** An invoice was marked as paid (or a paid invoice was edited). Finance books an expense. */
  'invoice.paid': {
    invoiceId: string;
    payee: string;
    /** What was still open when the invoice was paid (the whole amount without part payments; 0 when part payments covered it). */
    amountMinor: number;
    /** 'YYYY-MM-DD' */
    paidAt: string;
    note?: string;
    /** ISO 4217 code; none means euro. */
    currency?: string;
  };
  /** A paid invoice was reopened. Finance removes the expense it booked. */
  'invoice.unpaid': { invoiceId: string };
  /** A part of an invoice was paid. Finance books an expense `inv-<invoiceId>-<paymentId>`; `invoice.paid` then carries only the rest. */
  'invoice.payment': {
    invoiceId: string;
    paymentId: string;
    payee: string;
    amountMinor: number;
    /** 'YYYY-MM-DD' */
    date: string;
    note?: string;
    /** ISO 4217 code; none means euro. */
    currency?: string;
  };
  /** A part payment was removed again. Finance removes the expense it booked for it. */
  'invoice.paymentRemoved': { invoiceId: string; paymentId: string };
  /** Something wants to be remembered (a news article, a shared link). The bookmarks module stores it. */
  'bookmark.requested': {
    title: string;
    url: string;
    note?: string;
    /** What it is (the bookmarks module ignores a value it does not know); none means "read later". */
    kind?: 'link' | 'read' | 'watch' | 'book' | 'place' | 'idea' | 'other';
    tags?: string[];
  };
  /** Something is running low (pantry). The shopping list adds the item unless it is already open there. */
  'shopping.requested': {
    name: string;
    quantity?: string;
    /** The thing that asked (the pantry entry), so the list item can link back. No handler reads it yet: planner hub S3. */
    ref?: EntityRef;
  };
  /** Something was bought (shopping list). The pantry adds the amount to the item of that name or creates it. */
  'pantry.restock': { name: string; quantity?: string };
  /** A saved link could be a gift idea (bookmarks). The people module keeps it until the reader picks a person. */
  'gift.requested': { title: string; url?: string; priceCents?: number };
  /** Something becomes a to-do (a checklist item in a note). The todos module adds it to the inbox. */
  'todo.requested': {
    title: string;
    note?: string;
    dueDate?: string;
    /** Where the to-do came from (a note, a mail, an invoice, an event): only the id and the title. */
    link?: LegacyLink;
  };
  /**
   * Close one open to-do (the mail row „Beantwortet? · Erledigt“, use case „Wochenende retten“ F5): the todos
   * module ticks it off the way a tap in the list does (`setDone`, next instance of a repeating one). Only the
   * id travels; a missing, deleted or done to-do is left alone. The asker wraps the emit in `undoable` for its
   * „Rückgängig“ (the handler's writes happen inside the awaited emit). Never sent without a tap.
   */
  'todo.doneRequested': { id: string };
  /**
   * Something should go into the plan (a note: „In den Plan“). The planner adds a to-do through the
   * quick-capture target (with the link) plus its planner item, plans it and says on which day it landed.
   * Nothing happens while the planner is off.
   */
  'plan.requested': {
    title: string;
    /** Whole minutes the thing takes. */
    durationMin?: number;
    /** 0 none … 3 high, as in ToDos. */
    priority?: 0 | 1 | 2 | 3;
    /** 'YYYY-MM-DD'; `hard` = must be done by then (a deadline the planner keeps). */
    due?: { date: string; hard: boolean };
    /** Where it came from: only the id and the title. */
    link?: LegacyLink;
    /**
     * The thing is a plan item itself (an invoice, a list): the planner places `<module>:<id>` and creates no ToDo
     * (CONCEPT-SOURCES §3.3). No handler reads it yet: planner hub K2.
     */
    ref?: EntityRef;
  };
  /**
   * „Tag abschließen“ on the ToDo widget while the planner is on (use case „Wochenende retten“, F3): the planner
   * answers by opening its preview of „Rest verteilen“ through `open` (the asker's navigation; the planner names its
   * own page). Nothing moves before the user takes the preview. Nothing happens while the planner is off.
   */
  'plan.restRequested': { open: (path: string) => void };
  /** Something starts the clock (a calendar event: "Zeit erfassen"). Time tracking starts a session without a project, titled as a note. */
  'timetrack.start.requested': { title: string; sourceRef?: string };
  /**
   * A module reports something to the automation engine (`core/automation`): a domain event such as
   * `mail.invoiceReceived`. Nothing happens unless a rule listens. Keep `data` to what rules need.
   */
  'automation.event': {
    type: string;
    moduleId?: string;
    /** Stable per occurrence: a rule runs at most once for the same key. */
    key: string;
    data: Record<string, unknown>;
    /** Short text for the rule log; leave out for anything private (mail). */
    title?: string;
  };
  'module.enabled': { moduleId: string };
  /**
   * A module is about to be switched off: emitted and awaited before the state is written and before
   * any data is wiped (delete policy), so a module can hand foreign records back (the planner restores
   * the ToDos' own dates). A throwing handler never stops the switch-off.
   */
  'module.disabling': { moduleId: string; policy: DataPolicy };
  'module.disabled': { moduleId: string; policy: DataPolicy };
}
