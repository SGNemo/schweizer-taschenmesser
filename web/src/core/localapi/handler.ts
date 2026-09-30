/**
 * The meaning of an API request. The native server has already checked transport, Host/Origin,
 * token and limits; this decides modules, rights and content. Pure apart from the database, so it
 * is unit-tested without Tauri. Error bodies are fixed codes plus fixed German texts – they never
 * echo input values, and blocked modules look exactly like unknown ones.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { buildExample } from '@/core/dataapi/example';
import { describeCollection, toImportItem } from '@/core/dataapi/format';
import { createJsonRuntime } from '@/core/dataapi/importer';
import { buildOpenApi } from '@/core/dataapi/openapi';
import { ImportJsonError } from '@/core/dataapi/parse';
import { apiCollections, apiModules } from '@/core/dataapi/scope';
import { buildPreview } from '@/core/importer/plan';
import { loadModuleStates } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { now as clockNow, today } from '@/core/time/now';
import { t } from '@/strings';
import { isExpired, loadConfig, type ApiToken, type Grant } from './config';
import type { AccessEntry } from './log';

export interface ApiRequest {
  id: number;
  tokenId: string;
  method: string;
  path: string;
  query: string;
  idempotencyKey?: string | null;
  body?: string | null;
}

export interface ApiResult {
  status: number;
  body: unknown;
  /** What goes into the access log (no content). */
  log: AccessEntry;
}

export interface HandlerContext {
  manifests: readonly ModuleManifest[];
  database?: TaschenmesserDB;
  now?: () => number;
}

export const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const MODULE_RE = /^[a-z][a-z0-9]*$/;

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly text?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(code);
  }
}

const HINTS = [
  'Sende Einträge mit POST /v1/{module}/import als {"items":[…]}; zuerst mit ?dryRun=true prüfen.',
  'Jeder Eintrag braucht "collection". Keine "id" und keine Zeitstempel senden – die App vergibt sie.',
  'Beträge als Zahl in Euro, Datum JJJJ-MM-TT, Uhrzeit HH:mm.',
  'Verweise: vorhandene ID, Titel eines vorhandenen Eintrags oder "@key" eines Eintrags derselben Sendung.',
  'Fehler werden je Eintrag gemeldet; korrigiere nur diese und sende erneut. Gleiche Daten erzeugen keine Doppelten.',
  'Importe erscheinen in der App zur Bestätigung; einzelne Einträge lassen sich über die API nicht löschen.',
];

function grantOf(token: ApiToken, moduleId: string): Grant {
  return token.grants[moduleId] ?? { read: false, write: false };
}

interface Route {
  name: string;
  module?: string;
  rest?: string;
}

function route(method: string, path: string): Route {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'v1') throw new ApiError(404, 'not-found');
  const [, a, b, c] = parts;
  if (parts.length === 2 && a === 'modules' && method === 'GET') return { name: 'modules' };
  if (parts.length === 2 && a === 'openapi.json' && method === 'GET') return { name: 'openapi' };
  if (a === 'batches') {
    if (parts.length === 2 && method === 'GET') return { name: 'batches' };
    if (parts.length === 3 && (method === 'GET' || method === 'DELETE')) return { name: 'batch' };
    if (parts.length === 4 && c === 'commit' && method === 'POST') return { name: 'commit' };
  }
  if (parts.length === 3 && a && MODULE_RE.test(a)) {
    if (b === 'items' && method === 'GET') return { name: 'items', module: a };
    if (b === 'import' && method === 'POST') return { name: 'import', module: a };
  }
  throw new ApiError(404, 'not-found');
}

const ROUTE_LOG: Record<string, string> = {
  modules: '/v1/modules',
  openapi: '/v1/openapi.json',
  items: '/v1/{module}/items',
  import: '/v1/{module}/import',
  batches: '/v1/batches',
  batch: '/v1/batches/{id}',
  commit: '/v1/batches/{id}/commit',
};

export async function handleRequest(req: ApiRequest, ctx: HandlerContext): Promise<ApiResult> {
  const database = ctx.database ?? defaultDb;
  const at = (ctx.now ?? clockNow)();
  const log: AccessEntry = {
    at,
    token: '?',
    tokenId: req.tokenId,
    method: req.method,
    route: '?',
    status: 500,
  };
  const done = (status: number, body: unknown, extra: Partial<AccessEntry> = {}): ApiResult => ({
    status,
    body,
    log: { ...log, ...extra, status },
  });
  try {
    const config = await loadConfig(database);
    const token = config.tokens.find((x) => x.id === req.tokenId);
    // Second line of defence; the native server already checked this.
    if (!config.enabled) throw new ApiError(503, 'disabled');
    if (!token || isExpired(token, at)) throw new ApiError(401, 'token-invalid');
    log.token = token.name;

    const r = route(req.method, req.path);
    log.route = ROUTE_LOG[r.name] ?? '?';
    const states = await loadModuleStates(ctx.manifests, database);
    const permitted = apiModules(ctx.manifests, states).filter((m) => {
      const g = grantOf(token, m.id);
      return g.read || g.write;
    });
    const params = new URLSearchParams(req.query);

    switch (r.name) {
      case 'modules':
        return done(200, describeModules(permitted, token));
      case 'openapi':
        return done(200, buildOpenApi(permitted));
      case 'items': {
        const manifest = permitted.find((m) => m.id === r.module);
        if (!manifest) throw new ApiError(404, 'unknown-module');
        log.module = manifest.id;
        if (!grantOf(token, manifest.id).read) throw new ApiError(403, 'forbidden');
        const body = await readItemsPage(manifest, params, database);
        return done(200, body, { count: body.items.length });
      }
      case 'import': {
        const manifest = permitted.find((m) => m.id === r.module);
        if (!manifest) throw new ApiError(404, 'unknown-module');
        log.module = manifest.id;
        if (!grantOf(token, manifest.id).write) throw new ApiError(403, 'forbidden');
        const dryRun = params.get('dryRun') === 'true' || params.get('dryRun') === '1';
        const result = await checkImport(manifest, req.body ?? '', database);
        if (!dryRun) {
          // Batches waiting for confirmation come with the next step (phase 3).
          throw new ApiError(501, 'not-implemented', t.localApi.notYetText);
        }
        return done(200, { dryRun: true, ...result }, { count: result.items.length });
      }
      default:
        throw new ApiError(501, 'not-implemented', t.localApi.notYetText);
    }
  } catch (e) {
    if (e instanceof ApiError) {
      return done(e.status, {
        error: e.code,
        message: e.text ?? t.localApi.errors[e.code] ?? e.code,
        ...e.extra,
      });
    }
    return done(500, { error: 'internal', message: t.localApi.errors.internal });
  }
}

function describeModules(modules: readonly ModuleManifest[], token: ApiToken) {
  return {
    hints: HINTS,
    modules: modules.map((m) => {
      const g = grantOf(token, m.id);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        rights: { read: g.read, write: g.write },
        collections: apiCollections(m).map((c) => {
          const f = describeCollection(m, c);
          return {
            name: c,
            label: f.label,
            titleField: f.titleField,
            fields: f.fields.map((x) => ({
              name: x.name,
              required: x.required,
              ...(x.kind === 'ref' ? { refersTo: x.refCollection } : {}),
              schema: x.schema,
            })),
          };
        }),
        example: { items: buildExample(m) },
      };
    }),
  };
}

async function readItemsPage(
  manifest: ModuleManifest,
  params: URLSearchParams,
  database: TaschenmesserDB,
) {
  const collections = apiCollections(manifest);
  const collection =
    params.get('collection') ?? (collections.length === 1 ? collections[0] : undefined);
  if (!collection || !collections.includes(collection)) {
    throw new ApiError(400, 'bad-collection', undefined, { collections });
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new ApiError(400, 'bad-limit');
  }
  const cursor = params.get('cursor') ?? '';
  if (cursor.length > 200) throw new ApiError(400, 'bad-cursor');
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q.length > 200) throw new ApiError(400, 'bad-query');

  const format = describeCollection(manifest, collection);
  const repo = createCollectionRepo(manifest, collection, database);
  const rows = await repo.table
    .where('id')
    .above(cursor)
    .filter((r) => {
      if (r.deletedAt !== null) return false;
      if (!q) return true;
      const title = format.titleField ? r[format.titleField] : undefined;
      return typeof title === 'string' && title.toLowerCase().includes(q);
    })
    .limit(limit + 1)
    .toArray();
  const page = rows.slice(0, limit);
  return {
    collection,
    items: page.map((r) => toImportItem(format, r)),
    nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
  };
}

async function checkImport(manifest: ModuleManifest, text: string, database: TaschenmesserDB) {
  const runtime = createJsonRuntime(manifest, database);
  let candidates;
  try {
    ({ candidates } = await runtime.parse(
      'json',
      { kind: 'json', text },
      { today: today(), options: {}, batchId: 'check' },
    ));
  } catch (e) {
    if (e instanceof ImportJsonError) throw new ApiError(400, 'bad-body', e.text);
    throw e;
  }
  const rows = await buildPreview(manifest, runtime, candidates);
  const items2 = rows.map((row) => ({
    index: row.index,
    collection: row.candidate.collection || undefined,
    label: row.candidate.label,
    status: row.invalid ? 'invalid' : row.duplicate ? 'duplicate' : 'ok',
    ...(row.invalid ? { errors: [row.invalid] } : {}),
  }));
  const count = (s: string) => items2.filter((i) => i.status === s).length;
  return {
    summary: { ok: count('ok'), duplicate: count('duplicate'), invalid: count('invalid') },
    items: items2,
  };
}
