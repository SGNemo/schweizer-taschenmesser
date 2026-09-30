/** The generic JSON importer every data-API module gets: runtime (database access) and wizard metadata. */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { ENVELOPE_KEYS } from '@/core/db/types';
import type { ImporterMeta, ImporterRuntime } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { describeCollection, titleFieldOf } from './format';
import { buildCandidates, canonicalKey, readItems, titleIndex, type RefLookup } from './parse';

export const JSON_IMPORTER_ID = 'json';

export const jsonImporterMeta = (): ImporterMeta => ({
  id: JSON_IMPORTER_ID,
  kind: 'json',
  label: t.dataApi.importerLabel,
  description: t.dataApi.importerDescription,
  accept: '.json,application/json',
  placeholder: '{"items": [ … ]}',
});

const envelope = new Set<string>(ENVELOPE_KEYS);

export function createLookup(
  manifest: ModuleManifest,
  database: TaschenmesserDB = defaultDb,
): RefLookup {
  return {
    async entries(collection) {
      const titleField = titleFieldOf(manifest, collection);
      const rows = await createCollectionRepo(manifest, collection, database).active().toArray();
      return rows.map((r) => {
        const v = titleField ? r[titleField] : undefined;
        return { id: r.id, title: typeof v === 'string' ? v : '' };
      });
    },
    async record(collection, id) {
      const row = await createCollectionRepo(manifest, collection, database).get(id);
      return row
        ? Object.fromEntries(Object.entries(row).filter(([k]) => !envelope.has(k)))
        : undefined;
    },
  };
}

export function createJsonRuntime(
  manifest: ModuleManifest,
  database: TaschenmesserDB = defaultDb,
): ImporterRuntime {
  const lookup = createLookup(manifest, database);
  return {
    async parse(_importerId, input, ctx) {
      if (input.kind !== 'json' && input.kind !== 'file') return { candidates: [], notes: [] };
      const items = readItems(input.text);
      const load = manifest.contributions?.aiCreateDefaults;
      const defaults = load ? async (c: string) => (await load()).default(c) : undefined;
      return buildCandidates(manifest, items, { batchId: ctx.batchId, lookup, defaults });
    },
    async existingKeys(collection) {
      const format = describeCollection(manifest, collection);
      const refTitles = new Map<string, Map<string, string>>();
      for (const f of format.fields) {
        if (f.kind === 'ref' && f.refCollection && !refTitles.has(f.refCollection)) {
          refTitles.set(f.refCollection, await titleIndex(lookup, f.refCollection));
        }
      }
      const rows = await createCollectionRepo(manifest, collection, database).active().toArray();
      return new Set(
        rows.map((row) =>
          canonicalKey(
            format,
            Object.fromEntries(Object.entries(row).filter(([k]) => !envelope.has(k))),
            (f, id) => refTitles.get(f.refCollection ?? '')?.get(id) ?? id,
          ),
        ),
      );
    },
  };
}
