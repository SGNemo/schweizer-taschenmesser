/**
 * OpenAPI 3.1 document of the data API, generated from the module manifests (no hand-kept schema).
 * Only the modules handed in appear – callers pass the active, permitted ones.
 */
import type { ModuleManifest } from '@/core/modules/types';
import { buildExample } from './example';
import { describeCollection, itemJsonSchema } from './format';
import { MAX_ITEMS } from './parse';
import { apiCollections } from './scope';

type Json = Record<string, unknown>;

const errorResponse = (description: string): Json => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

export function buildOpenApi(modules: readonly ModuleManifest[], version = '1'): Json {
  const schemas: Record<string, unknown> = {
    Error: {
      type: 'object',
      properties: { error: { type: 'string' }, message: { type: 'string' } },
      required: ['error'],
    },
  };
  const examples: Record<string, unknown> = {};
  for (const m of modules) {
    const collections = apiCollections(m);
    for (const c of collections) {
      schemas[`${m.id}.${c}`] = itemJsonSchema(describeCollection(m, c));
    }
    schemas[`${m.id}.Item`] = {
      oneOf: collections.map((c) => ({ $ref: `#/components/schemas/${m.id}.${c}` })),
    };
    examples[m.id] = { summary: m.name, value: { items: buildExample(m) } };
  }
  const bearer = [{ bearer: [] }];
  return {
    openapi: '3.1.0',
    info: {
      title: 'Taschenmesser – lokale Import-API',
      version,
      description:
        'Lokale Schnittstelle der Desktop-App (nur 127.0.0.1). Importe warten in der App auf Bestätigung; es gibt keinen Endpunkt zum Löschen einzelner Einträge.',
    },
    servers: [{ url: 'http://127.0.0.1:47631' }],
    security: bearer,
    paths: {
      '/v1/modules': {
        get: {
          summary: 'Erlaubte Module, Sammlungen, Beispiele',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v1/openapi.json': {
        get: { summary: 'Dieses Dokument', responses: { '200': { description: 'OK' } } },
      },
      '/v1/{module}/items': {
        get: {
          summary: 'Einträge lesen (Recht „read“)',
          parameters: [
            {
              name: 'module',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: modules.map((m) => m.id) },
            },
            { name: 'collection', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 200 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OK' },
            '403': errorResponse('Recht fehlt'),
            '404': errorResponse('Unbekanntes Modul'),
          },
        },
      },
      '/v1/{module}/import': {
        post: {
          summary:
            'Einträge senden (Recht „write“); landen als Batch zur Bestätigung in der App. Mit "id" wird ein vorhandener Eintrag geändert (nur als Vorschlag, der Nutzer bestätigt einzeln).',
          parameters: [
            {
              name: 'module',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: modules.map((m) => m.id) },
            },
            { name: 'dryRun', in: 'query', schema: { type: 'boolean' } },
            { name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', maxItems: MAX_ITEMS, items: { type: 'object' } },
                  },
                  required: ['items'],
                },
                examples,
              },
            },
          },
          responses: {
            '200': { description: 'Ergebnis je Eintrag' },
            '403': errorResponse('Recht fehlt'),
            '413': errorResponse('Zu groß'),
          },
        },
      },
      '/v1/batches': {
        get: { summary: 'Eigene Importe', responses: { '200': { description: 'OK' } } },
      },
      '/v1/batches/{id}': {
        get: { summary: 'Ein Import', responses: { '200': { description: 'OK' } } },
        delete: {
          summary: 'Import rückgängig machen',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/v1/batches/{id}/commit': {
        post: {
          summary: 'Übernehmen (nur Tokens mit „Automatisch übernehmen“)',
          responses: {
            '200': { description: 'OK' },
            '403': errorResponse('Bestätigung in der App nötig'),
          },
        },
      },
    },
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      schemas,
    },
  };
}
