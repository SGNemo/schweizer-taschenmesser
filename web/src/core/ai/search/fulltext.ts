/**
 * Full text search over the `searchable` fields of all enabled modules. The index is kept in memory and
 * updated when a table changes (`./index.ts`), so a search costs the search itself, not a read of
 * every table; results are read from the tables when they are shown, so they are never stale.
 */
import { tableName } from '@/core/db/schema';
import { t } from '@/strings';
import { aiModules } from '../scope';
import { toResultRow } from '../query/rows';
import type { AiResult, ExecContext, ResultRow } from '../query/types';
import { searchIndexFor, tokenize } from './index';

const MAX_HITS = 20;

export async function searchEntries(
  text: string,
  ctx: Pick<ExecContext, 'manifests' | 'database'>,
  limit = MAX_HITS,
  /** Without a match for all words, fall back to entries matching any word. */
  loose = true,
): Promise<ResultRow[]> {
  if (tokenize(text).length === 0) return [];
  const modules = aiModules(ctx.manifests);
  const index = searchIndexFor(ctx.database, modules);
  await index.ready();

  let hits = index.mini.search(text, { combineWith: 'AND' });
  if (hits.length === 0 && loose) hits = index.mini.search(text, { combineWith: 'OR' });

  const byId = new Map(modules.map((m) => [m.id, m]));
  const rows: ResultRow[] = [];
  for (const hit of hits) {
    if (rows.length >= limit) break;
    // `<module>/<collection>/<record id>`: the record id may itself contain a slash.
    const [moduleId, collection, ...rest] = String(hit.id).split('/');
    const manifest = byId.get(moduleId!);
    if (!manifest || !collection) continue;
    const row = (await ctx.database
      .table<Record<string, unknown> & { id: string; deletedAt: number | null }, string>(
        tableName(manifest.id, collection),
      )
      .get(rest.join('/'))) as
      (Record<string, unknown> & { id: string; deletedAt: number | null }) | undefined;
    // Gone or deleted since the index was updated: the next search drops it.
    if (!row || row.deletedAt !== null) continue;
    rows.push(toResultRow(manifest, collection, row, { withSubtitle: true }));
  }
  return rows;
}

export async function searchText(text: string, ctx: ExecContext): Promise<AiResult> {
  const rows = await searchEntries(text, ctx);
  return { kind: 'rows', heading: t.ai.searchHeading(text), rows, total: rows.length };
}
