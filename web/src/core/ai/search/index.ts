/**
 * The in-memory full text index behind the palette and the assistant search.
 *
 * It used to be rebuilt from every searchable table for every query (about 31,000 documents and
 * 0.8–3.6 s per query with 20,000 bookings, `docs/perf/DATA-BASELINE-2026-11-03.md`). Now one
 * MiniSearch index lives for the set of enabled collections:
 * - built lazily by the first search, in slices so the page stays responsive,
 * - a table that was written to is marked dirty (Dexie's `storagemutated`, also for writes of other
 *   tabs and of sync) and is re-read by the next search, but only that table, and only the documents
 *   whose text changed are replaced,
 * - dropped after a few idle minutes; nothing is stored, so there is nothing to migrate, sync or back up.
 *
 * Which tables are indexed is decided by the caller (`aiModules`: a module without `aiSchema` is not
 * there for the AI, the vault included).
 */
import { Dexie } from 'dexie';
import MiniSearch from 'minisearch';
import { tableName } from '@/core/db/schema';
import { fold } from '../text';
import type { AiModule } from '../scope';

export interface Doc {
  uid: string;
  title: string;
  text: string;
}

/** Splits on anything that is not a letter or digit (after folding diacritics). */
export const tokenize = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export const newMiniSearch = () =>
  new MiniSearch<Doc>({
    idField: 'uid',
    fields: ['title', 'text'],
    tokenize,
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 2 } },
  });

/** The index drops after this long without a search (it is rebuilt by the next one). */
const IDLE_MS = 5 * 60_000;
/** Documents per slice of the first build, then the page may draw. */
const SLICE = 2_000;

type Row = Record<string, unknown> & { id: string; deletedAt: number | null };
type Database = { name: string; table(name: string): { toArray(): Promise<unknown[]> } };

interface Part {
  manifest: AiModule;
  collection: string;
  table: string;
  titleField: string;
  fields: string[];
  dirty: boolean;
  built: boolean;
  /** uid → what the document held (title + text), to replace only what changed. */
  held: Map<string, string>;
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const docOf = (
  part: Pick<Part, 'manifest' | 'collection' | 'titleField' | 'fields'>,
  row: Row,
): Doc => ({
  uid: `${part.manifest.id}/${part.collection}/${row.id}`,
  title: String(row[part.titleField] ?? ''),
  text: part.fields.map((f) => (row[f] === undefined ? '' : String(row[f]))).join(' '),
});

export class SearchIndex {
  readonly mini = newMiniSearch();
  private readonly parts: Part[];
  private refreshing: Promise<void> | undefined;
  private idle: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly database: Database,
    manifests: readonly AiModule[],
    private readonly onIdle: () => void,
  ) {
    this.parts = manifests.flatMap((manifest) =>
      Object.entries(manifest.aiSchema.collections).flatMap(([collection, schema]) =>
        (schema.searchable ?? []).length === 0
          ? []
          : [
              {
                manifest,
                collection,
                table: tableName(manifest.id, collection),
                titleField: schema.titleField,
                fields: [...(schema.searchable ?? [])],
                dirty: true,
                built: false,
                held: new Map<string, string>(),
              },
            ],
      ),
    );
  }

  /** A write happened in `table` (or in an unknown table: `undefined`). */
  markDirty(table: string | undefined): void {
    for (const part of this.parts)
      if (table === undefined || part.table === table) part.dirty = true;
  }

  /** Brings the index up to date; concurrent callers share the work. */
  async ready(): Promise<void> {
    clearTimeout(this.idle);
    this.idle = setTimeout(this.onIdle, IDLE_MS);
    (this.idle as { unref?: () => void }).unref?.();
    while (this.parts.some((p) => p.dirty)) {
      this.refreshing ??= this.refresh().finally(() => {
        this.refreshing = undefined;
      });
      await this.refreshing;
    }
  }

  stop(): void {
    clearTimeout(this.idle);
  }

  private async refresh(): Promise<void> {
    for (const part of this.parts) {
      if (!part.dirty) continue;
      // Cleared before reading: a write during the read marks it dirty again.
      part.dirty = false;
      const rows = (await this.database.table(part.table).toArray()) as Row[];
      const seen = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        if (row.deletedAt !== null) continue;
        const doc = docOf(part, row);
        seen.add(doc.uid);
        const signature = `${doc.title}\u0000${doc.text}`;
        const before = part.held.get(doc.uid);
        if (before === signature) continue;
        if (before === undefined) this.mini.add(doc);
        else this.mini.replace(doc);
        part.held.set(doc.uid, signature);
        // Only the first build is big: let the page draw between slices.
        if (!part.built && (i + 1) % SLICE === 0) await yieldToMain();
      }
      for (const uid of part.held.keys())
        if (!seen.has(uid)) {
          this.mini.discard(uid);
          part.held.delete(uid);
        }
      part.built = true;
    }
  }
}

// --- one index per database and set of collections, marked dirty by Dexie's mutation events ---

const indexes = new Map<string, { database: Database; index: SearchIndex }>();
let listening = false;

function listen(): void {
  if (listening) return;
  listening = true;
  Dexie.on('storagemutated', (parts) => {
    for (const key of Object.keys(parts)) {
      // `idb://<database>/<table>/…`; anything we cannot read marks everything of that database.
      const match = /^idb:\/\/([^/]+)(?:\/([^/]+))?/.exec(key);
      for (const entry of indexes.values())
        if (!match || match[1] === entry.database.name) entry.index.markDirty(match?.[2]);
    }
  });
}

/** The index for these modules, created on first use. */
export function searchIndexFor(database: Database, manifests: readonly AiModule[]): SearchIndex {
  listen();
  const key = `${database.name}|${manifests
    .map((m) => m.id)
    .sort()
    .join(',')}`;
  let entry = indexes.get(key);
  if (!entry) {
    const created = new SearchIndex(database, manifests, () => {
      created.stop();
      indexes.delete(key);
    });
    entry = { database, index: created };
    indexes.set(key, entry);
  }
  return entry.index;
}

/** Drops every index (tests, and the next search builds again). */
export function resetSearchIndexes(): void {
  for (const { index } of indexes.values()) index.stop();
  indexes.clear();
}
