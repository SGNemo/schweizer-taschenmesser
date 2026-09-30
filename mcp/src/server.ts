/**
 * The MCP tools. Each one is a single call of the app's local API (`docs/AI-IMPORT.md`); there is
 * no other data access. Rights, validation, previews and undo are enforced by the app.
 */
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BATCH_RE, MODULE_RE, type Api, type ApiResponse } from './api.js';

export const VERSION = '0.1.0';

const moduleId = z.string().regex(MODULE_RE).describe('Modul-ID aus list_modules, z. B. "todos".');
const batchId = z.string().regex(BATCH_RE).describe('batchId aus import_items oder list_batches.');

function result(res: ApiResponse) {
  const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2);
  const ok = res.status >= 200 && res.status < 300;
  return {
    content: [{ type: 'text' as const, text: ok ? text : `HTTP ${res.status}\n${text}` }],
    ...(ok ? {} : { isError: true }),
  };
}

export function createServer(api: Api): McpServer {
  const server = new McpServer({ name: 'taschenmesser', version: VERSION });
  const read = { readOnlyHint: true, openWorldHint: false };

  server.registerTool(
    'list_modules',
    {
      title: 'Module anzeigen',
      description:
        'Listet die Module, die dieser Zugang lesen oder beschreiben darf, mit Sammlungen, Feldern, Beispielen und Hinweisen. Immer zuerst aufrufen.',
      annotations: read,
    },
    async () => result(await api('GET', '/v1/modules')),
  );

  server.registerTool(
    'get_schema',
    {
      title: 'Schema (OpenAPI)',
      description:
        'OpenAPI-3.1-Dokument der Schnittstelle mit dem genauen JSON-Schema jeder erlaubten Sammlung.',
      annotations: read,
    },
    async () => result(await api('GET', '/v1/openapi.json')),
  );

  server.registerTool(
    'read_items',
    {
      title: 'Einträge lesen',
      description:
        'Liest vorhandene Einträge einer Sammlung (Recht „Lesen“ nötig), seitenweise. Nutze nextCursor für die nächste Seite.',
      inputSchema: {
        module: moduleId,
        collection: z.string().max(64).optional().describe('Sammlung; nötig bei mehreren.'),
        limit: z.number().int().min(1).max(200).optional(),
        cursor: z.string().max(200).optional(),
        q: z.string().max(200).optional().describe('Filter auf den Titel (enthält).'),
      },
      annotations: read,
    },
    async ({ module, collection, limit, cursor, q }) =>
      result(await api('GET', `/v1/${module}/items`, { query: { collection, limit, cursor, q } })),
  );

  server.registerTool(
    'import_items',
    {
      title: 'Einträge senden',
      description:
        'Sendet Einträge an ein Modul. Erst mit dryRun=true prüfen (speichert nichts, meldet je Eintrag ok/duplicate/invalid/update mit Fehlern), fehlerhafte korrigieren, dann mit dryRun=false senden. Der Import wartet danach auf die Bestätigung des Nutzers in der App. Neue Einträge ohne "id"; mit "id" wird ein vorhandener Eintrag geändert (nur als Vorschlag). Höchstens 500 Einträge.',
      inputSchema: {
        module: moduleId,
        items: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .max(500)
          .describe('Einträge im Format aus list_modules, jeweils mit "collection".'),
        dryRun: z.boolean().describe('true = nur prüfen, false = senden.'),
        idempotencyKey: z
          .string()
          .regex(/^[\x21-\x7e]{1,200}$/)
          .optional()
          .describe('Für Wiederholungen derselben Sendung denselben Wert verwenden.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ module, items, dryRun, idempotencyKey }) =>
      result(
        await api('POST', `/v1/${module}/import`, {
          query: dryRun ? { dryRun: true } : undefined,
          body: { items },
          idempotencyKey: dryRun ? undefined : (idempotencyKey ?? randomUUID()),
        }),
      ),
  );

  server.registerTool(
    'list_batches',
    {
      title: 'Importe anzeigen',
      description: 'Die Importe dieses Zugangs mit Stand (pending, committed, rejected, undone).',
      annotations: read,
    },
    async () => result(await api('GET', '/v1/batches')),
  );

  server.registerTool(
    'get_batch',
    {
      title: 'Import anzeigen',
      description: 'Stand und Ergebnis je Eintrag eines Imports.',
      inputSchema: { batchId },
      annotations: read,
    },
    async ({ batchId: id }) => result(await api('GET', `/v1/batches/${id}`)),
  );

  server.registerTool(
    'commit_batch',
    {
      title: 'Import übernehmen',
      description:
        'Übernimmt einen wartenden Import. Geht nur, wenn der Nutzer dem Zugang „Automatisch übernehmen“ erlaubt hat und der Import keine Änderungen vorhandener Einträge enthält; sonst bestätigt der Nutzer in der App.',
      inputSchema: { batchId },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ batchId: id }) => result(await api('POST', `/v1/batches/${id}/commit`)),
  );

  server.registerTool(
    'undo_batch',
    {
      title: 'Import rückgängig machen',
      description:
        'Lehnt einen wartenden Import ab oder macht einen übernommenen rückgängig. Vom Nutzer inzwischen bearbeitete Einträge bleiben erhalten.',
      inputSchema: { batchId },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ batchId: id }) => result(await api('DELETE', `/v1/batches/${id}`)),
  );

  return server;
}
