/**
 * Full text search over the `searchable` fields of all enabled modules. The index is rebuilt for
 * every search – personal data volumes are small and this way it can never be stale.
 */
import MiniSearch from 'minisearch';
import { tableName } from '@/core/db/schema';
import { t } from '@/strings';
import { fold } from '../text';
import { toResultRow } from '../query/rows';
import type { AiResult, ExecContext, ResultRow } from '../query/types';

interface Doc {
  uid: string;
  title: string;
  text: string;
}

const MAX_HITS = 20;

/** Splits on anything that is not a letter or digit (after folding diacritics). */
const tokenize = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export async function searchEntries(
  text: string,
  ctx: Pick<ExecContext, 'manifests' | 'database'>,
  limit = MAX_HITS,
  /** Without a match for all words, fall back to entries matching any word. */
  loose = true,
): Promise<ResultRow[]> {
  if (tokenize(text).length === 0) return [];
  const docs: Doc[] = [];
  const rowsByUid = new Map<string, () => ResultRow>();

  for (const manifest of ctx.manifests) {
    for (const [collection, schema] of Object.entries(manifest.aiSchema.collections)) {
      const fields = schema.searchable ?? [];
      if (fields.length === 0) continue;
      const rows = await ctx.database
        .table<Record<string, unknown> & { id: string; deletedAt: number | null }, string>(
          tableName(manifest.id, collection),
        )
        .toArray();
      for (const row of rows) {
        if (row.deletedAt !== null) continue;
        const uid = `${manifest.id}/${collection}/${row.id}`;
        docs.push({
          uid,
          title: String(row[schema.titleField] ?? ''),
          text: fields.map((f) => (row[f] === undefined ? '' : String(row[f]))).join(' '),
        });
        rowsByUid.set(uid, () => toResultRow(manifest, collection, row, { withSubtitle: true }));
      }
    }
  }

  const index = new MiniSearch<Doc>({
    idField: 'uid',
    fields: ['title', 'text'],
    tokenize,
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 2 } },
  });
  index.addAll(docs);
  let hits = index.search(text, { combineWith: 'AND' });
  if (hits.length === 0 && loose) hits = index.search(text, { combineWith: 'OR' });
  return hits.slice(0, limit).flatMap((h) => {
    const row = rowsByUid.get(String(h.id));
    return row ? [row()] : [];
  });
}

export async function searchText(text: string, ctx: ExecContext): Promise<AiResult> {
  const rows = await searchEntries(text, ctx);
  return { kind: 'rows', heading: t.ai.searchHeading(text), rows, total: rows.length };
}
