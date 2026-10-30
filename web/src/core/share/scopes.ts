/**
 * Sharing one list instead of a whole module: for modules built as "list → entries that carry the
 * list's id", a connection can name the lists it shares. Everything else of the module stays home.
 *
 * Table names are plain strings on purpose (`core` does not import modules); `scopes.test.ts` checks
 * that every table and field named here exists in the schema.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import type { SyncRow } from '@/core/sync/ops';

export interface ListScope {
  moduleId: string;
  /** The table of lists and the field that names one. */
  parent: { table: string; nameField: string };
  /** Tables whose rows belong to a list through `fk` (the list's id). */
  children: { table: string; fk: string }[];
}

export const LIST_SCOPES: readonly ListScope[] = [
  {
    moduleId: 'lists',
    parent: { table: 'lists_list', nameField: 'name' },
    children: [{ table: 'lists_item', fk: 'listId' }],
  },
  {
    moduleId: 'todos',
    parent: { table: 'todos_list', nameField: 'name' },
    children: [{ table: 'todos_task', fk: 'listId' }],
  },
];

export const listScopeOf = (moduleId: string): ListScope | undefined =>
  LIST_SCOPES.find((s) => s.moduleId === moduleId);

/** The lists of a module a person can pick from (live ones, by name). */
export async function listChoices(
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<{ id: string; name: string }[]> {
  const scope = listScopeOf(moduleId);
  if (!scope) return [];
  const rows = await database.table<SyncRow, string>(scope.parent.table).toArray();
  return rows
    .filter((r) => r.deletedAt === null)
    .map((r) => ({ id: r.id, name: String(r[scope.parent.nameField] ?? r.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Keeps, for a module with chosen lists, only those list rows and the entries that belong to them
 * (deleted ones too, so a removal travels). Modules without a choice are left as they are.
 */
export function applyListChoice(
  tables: Record<string, SyncRow[]>,
  lists: Record<string, string[]> | undefined,
): Record<string, SyncRow[]> {
  if (!lists) return tables;
  const out = { ...tables };
  for (const [moduleId, ids] of Object.entries(lists)) {
    const scope = listScopeOf(moduleId);
    if (!scope || ids.length === 0) continue;
    const chosen = new Set(ids);
    if (out[scope.parent.table])
      out[scope.parent.table] = out[scope.parent.table]!.filter((r) => chosen.has(r.id));
    for (const child of scope.children)
      if (out[child.table])
        out[child.table] = out[child.table]!.filter((r) => chosen.has(String(r[child.fk])));
  }
  return out;
}
