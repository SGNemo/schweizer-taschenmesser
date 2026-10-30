/**
 * "Mit Partner teilen" without a server: selected modules leave as an encrypted file that the other
 * person opens with a pairing code (several words, told separately, never stored in the file).
 *
 * The file holds the same rows a backup holds (with per-field stamps and tombstones) sealed by the
 * existing password blob (Argon2id + AES-256-GCM). Opening it is always a **merge** through the
 * shared last-write-wins rule (`applyBackup` → `mergeOps`, the same rule as sync): nothing is
 * deleted, newer fields win, and everything that changed is queued for sync as usual.
 *
 * Never shared, on both sides: the vault (`accounts`) and device/core settings (`_settings`,
 * `_modules` …). A file that carries such tables is read, but those tables are ignored.
 */
import { z } from 'zod';
import {
  CryptoError,
  decryptWithPassword,
  encryptWithPassword,
  type PasswordBlob,
} from '@/core/crypto';
import { applyBackup, moduleOfTable, planRestore, type RestorePlan } from '@/core/backup/apply';
import { createBackup, parseBackup, type Backup } from '@/core/backup/backup';
import { sha256Hex } from '@/core/backup/encrypted';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { generatePassphrase, loadWordlist } from '@nemo/vault-core';
import { allManifests } from '@/core/modules/registry';
import { maxHlc } from '@/core/db/hlc';

export const SHARE_FORMAT = 'taschenmesser-share';
export const SHARE_VERSION = 1;
/** Names the payload inside the blob (bound as AAD: a backup blob cannot be opened as a share and back). */
const PAYLOAD_FORMAT = 'taschenmesser-share-payload';
export const PAIRING_WORDS = 6;
/** Modules whose data is never part of a share file. `core` = settings and module switches. */
export const NEVER_SHARED: ReadonlySet<string> = new Set(['accounts', 'core']);

const fileSchema = z.object({
  format: z.literal(SHARE_FORMAT),
  version: z.number().int().min(1),
  createdAt: z.string(),
  /** Standing connection this file belongs to (random id, readable before the code is tried). */
  pairId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{4,64}$/)
    .optional(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  blob: z.object({
    format: z.string(),
    v: z.literal(1),
    kdf: z.object({
      alg: z.literal('argon2id'),
      m: z.number(),
      t: z.number(),
      p: z.number(),
      salt: z.string(),
    }),
    data: z.string().min(1),
  }),
});

interface ShareFile {
  format: typeof SHARE_FORMAT;
  version: number;
  createdAt: string;
  pairId?: string;
  /** Hex SHA-256 of `blob.data`: damage is noticed before the code is tried. */
  checksum: string;
  blob: PasswordBlob;
}

/** Where a delta file starts and ends (stamps of the shared rows); lives inside the encrypted payload. */
export interface ShareRange {
  /** Absent: a full state (snapshot). */
  since?: string;
  upto?: string;
}

export type ShareReadFailure =
  'not-json' | 'wrong-format' | 'newer-version' | 'invalid' | 'checksum-mismatch' | 'wrong-code';

export type ShareReadResult =
  | {
      ok: true;
      backup: Backup;
      createdAt: string;
      modules: string[];
      pairId?: string;
      range: ShareRange;
    }
  | { ok: false; reason: ShareReadFailure };

/** Modules that can be offered for sharing, with their tables. */
export function shareableTables(tableNames: string[] = syncedTableNames(allManifests)): string[] {
  return tableNames.filter((name) => !NEVER_SHARED.has(moduleOfTable(name)));
}

export function shareableModules(
  tableNames: string[] = syncedTableNames(allManifests),
): { id: string; name: string }[] {
  const ids = new Set(shareableTables(tableNames).map(moduleOfTable));
  return allManifests.filter((m) => ids.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
}

/** The words people read out or type: lower case, single spaces. */
export const normalizeCode = (input: string): string =>
  input.trim().toLowerCase().split(/\s+/).join(' ');

export async function newPairingCode(): Promise<string> {
  return generatePassphrase(await loadWordlist(), {
    words: PAIRING_WORDS,
    separator: ' ',
    capitalize: false,
    includeNumber: false,
  });
}

export function shareFileName(date: Date = new Date()): string {
  return `nemo-teilen-${date.toISOString().slice(0, 10)}.json`;
}

export interface CreateShareOptions {
  modules: string[];
  code: string;
  database?: TaschenmesserDB;
  tableNames?: string[];
  kdf?: { m?: number; t?: number; p?: number };
  createdAt?: Date;
  /** A standing connection: the file carries its id and only what changed since `since`. */
  pairId?: string;
  since?: string;
}

export interface CreatedShare {
  text: string;
  /** Newest stamp among the shared rows at this moment (the next file starts after it). */
  upto: string | undefined;
  /** Rows in the file. */
  rows: number;
}

const rowStamps = (row: { _f: Record<string, string> }): string[] => Object.values(row._f);

/** The share file for the chosen modules. An empty choice or code is a programming error. */
export async function createPairFile(opts: CreateShareOptions): Promise<CreatedShare> {
  const code = normalizeCode(opts.code);
  if (!code) throw new RangeError('pairing code is empty');
  const chosen = new Set(opts.modules);
  const tables = shareableTables(opts.tableNames).filter((n) => chosen.has(moduleOfTable(n)));
  if (tables.length === 0) throw new RangeError('no module chosen');
  const at = opts.createdAt ?? new Date();
  const full = await createBackup(opts.database ?? defaultDb, tables, at);
  // Newest stamp of everything shared, before the delta filter: that is where the next file starts.
  const upto = maxHlc(Object.values(full.tables).flatMap((rows) => rows.flatMap(rowStamps)));
  const since = opts.since;
  const backup: Backup = since
    ? {
        ...full,
        tables: Object.fromEntries(
          Object.entries(full.tables).map(([name, rows]) => [
            name,
            rows.filter((r) => rowStamps(r).some((stamp) => stamp > since)),
          ]),
        ),
      }
    : full;
  const rows = Object.values(backup.tables).reduce((n, r) => n + r.length, 0);
  const payload = JSON.stringify({ ...backup, share: { since, upto } });
  const blob = await encryptWithPassword(PAYLOAD_FORMAT, code, payload, opts.kdf);
  const file: ShareFile = {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    createdAt: at.toISOString(),
    ...(opts.pairId ? { pairId: opts.pairId } : {}),
    checksum: await sha256Hex(blob.data),
    blob,
  };
  return { text: JSON.stringify(file), upto, rows };
}

/** A one-off share file (no standing connection): the full state of the chosen modules. */
export async function createShareFile(opts: CreateShareOptions): Promise<string> {
  return (await createPairFile({ ...opts, pairId: undefined, since: undefined })).text;
}

export async function readShareFile(text: string, codeInput: string): Promise<ShareReadResult> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (
    typeof json !== 'object' ||
    json === null ||
    (json as { format?: unknown }).format !== SHARE_FORMAT
  )
    return { ok: false, reason: 'wrong-format' };
  const version = (json as { version?: unknown }).version;
  if (typeof version === 'number' && version > SHARE_VERSION)
    return { ok: false, reason: 'newer-version' };
  const parsed = fileSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const file = parsed.data as ShareFile;
  if ((await sha256Hex(file.blob.data)) !== file.checksum)
    return { ok: false, reason: 'checksum-mismatch' };
  let plain: string;
  try {
    plain = await decryptWithPassword(PAYLOAD_FORMAT, normalizeCode(codeInput), file.blob);
  } catch (e) {
    // A wrong code and a modified file are indistinguishable by design (AEAD).
    if (e instanceof CryptoError && e.code === 'wrong-key')
      return { ok: false, reason: 'wrong-code' };
    return { ok: false, reason: 'invalid' };
  }
  const backup = parseBackup(plain);
  if (!backup.ok) return { ok: false, reason: 'invalid' };
  let range: ShareRange = {};
  try {
    const meta = (JSON.parse(plain) as { share?: { since?: unknown; upto?: unknown } }).share;
    if (typeof meta?.since === 'string') range.since = meta.since;
    if (typeof meta?.upto === 'string') range.upto = meta.upto;
  } catch {
    range = {};
  }
  const allowed = new Set(shareableTables());
  const modules = [
    ...new Set(
      Object.keys(backup.backup.tables)
        .filter((n) => allowed.has(n))
        .map(moduleOfTable),
    ),
  ];
  return {
    ok: true,
    backup: backup.backup,
    createdAt: file.createdAt,
    modules,
    ...(file.pairId ? { pairId: file.pairId } : {}),
    range,
  };
}

/** The connection id in the clear file header (before any code is tried), if the file has one. */
export function peekPairId(text: string): string | undefined {
  try {
    const parsed = fileSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data.pairId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Is this file the next one for the connection? A delta must start at or before what this device
 * already received; otherwise an earlier file was missed and its changes would silently be absent.
 */
export function followsReceived(range: ShareRange, receivedUpto: string | undefined): boolean {
  return !range.since || (receivedUpto !== undefined && receivedUpto >= range.since);
}

/** What opening the file would change, computed without writing. */
export function planShare(
  backup: Backup,
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
): Promise<RestorePlan> {
  return planRestore(backup, 'merge', database, shareableTables(tableNames));
}

/** Merges the file into this device's data (never deletes, newer fields win, queued for sync). */
export async function applyShare(
  backup: Backup,
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
): Promise<{ records: number }> {
  const { records } = await applyBackup(backup, 'merge', database, shareableTables(tableNames));
  return { records };
}
