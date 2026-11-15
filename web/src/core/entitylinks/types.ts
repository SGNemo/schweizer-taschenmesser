/**
 * The shared link contract „one thing, many places“ (docs/design/planner-hub/CONCEPT-LINKS.md §1.1): what a
 * link between two entities of different modules looks like. Pure types and helpers – no database, no registry.
 * Reading a link's target is the target module's `contributions.linkTarget`, asked through `resolveLink`
 * (`core/modules/contributions.ts`). The folder is `entitylinks` because `core/links.ts` is about web links.
 */

/** One entity of one module; its key is `<module>:<id>`, like the planner's item key. */
export interface EntityRef {
  module: string;
  id: string;
}

/** Why the link exists. Stored as a plain string: unknown values read as `about` (`linkRel`). */
export type LinkRel = 'origin' | 'dunning' | 'about';
export const LINK_RELS: readonly LinkRel[] = ['origin', 'dunning', 'about'];

export interface EntityLink {
  /** The thing that carries the link (ToDo, invoice). */
  from: EntityRef;
  /** Where it leads (mail thread, note, event, invoice). */
  to: EntityRef;
  rel: LinkRel;
  /** The target's title when the link was made; the fallback where the target cannot be read. Rendered as text only. */
  label: string;
  /** 'YYYY-MM-DD' of the occasion (the mail's day). */
  on?: string;
}

/** The link kinds a ToDo stores today (the Zod enum of `modules/todos/schema.ts` is built from this list). */
export const LINK_KINDS = ['note', 'mail', 'invoice', 'event'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/**
 * The link shape of before the contract: stored on a ToDo (`links[]`) and carried by `todo.requested`,
 * `plan.requested` and quick capture. One alias instead of four literal unions; the stored shape stays.
 */
export type LegacyLink = { kind: LinkKind; id: string; label: string };

/** The module a legacy kind points into. */
export const refOfKind = {
  note: 'notes',
  mail: 'mail',
  invoice: 'invoices',
  event: 'calendar',
} as const satisfies Record<LinkKind, string>;

/** The vault is never a link source or target: no module is asked, not even a label is read (docs/RULES.md "AI privacy"). */
export const NEVER_LINKED = 'accounts';

/** A label is capped: it may hold whatever a sender wrote (a mail subject). */
export const MAX_LINK_LABEL = 120;

/** `<module>:<id>` – the one key format of a ref. */
export const refKey = (ref: EntityRef): string => `${ref.module}:${ref.id}`;

/**
 * `<module>:<id>` → its ref, or `undefined` for anything that is no key: a module id is lowercase alphanumeric, and
 * an id (it may hold a colon) has no whitespace or control character and is capped at 128 characters like every
 * record id. Stored keys are untrusted input.
 */
export function refOfKey(key: unknown): EntityRef | undefined {
  if (typeof key !== 'string') return undefined;
  const at = key.indexOf(':');
  if (at <= 0) return undefined;
  const module = key.slice(0, at);
  const id = key.slice(at + 1);
  if (!/^[a-z][a-z0-9]*$/.test(module) || id === '' || id.length > 128) return undefined;
  if (/[\s\p{Cc}\p{Cf}]/u.test(id)) return undefined;
  return { module, id };
}

/** A stored `rel` is a plain string: anything unknown (a newer app's value) reads as `about`. */
export const linkRel = (raw: unknown): LinkRel =>
  LINK_RELS.includes(raw as LinkRel) ? (raw as LinkRel) : 'about';

/** A legacy link as the target half of an `EntityLink`: every writer of today records where the thing came from. */
export function fromLegacy(link: LegacyLink): Omit<EntityLink, 'from'> {
  return { to: { module: refOfKind[link.kind], id: link.id }, rel: 'origin', label: link.label };
}
