import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { provideCatalog } from '@/core/i18n/catalogs';
import { setLang } from '@/core/i18n/lang';
import { connectors } from '@/core/connectors/registry';
import { allManifests } from '@/core/modules/registry';
import { SETTINGS_CATEGORIES } from '@/core/settings/registry/categories';
import { allSetupSteps } from '@/core/setup/registry';
import { allTools } from '@/core/tools/registry';
import { CORE_SECTIONS } from '@/pages/settings/sections';
import { de } from '@/strings';
import { pseudoCatalog } from './pseudo';

/**
 * Registries (manifests, tools, settings sections and categories, setup steps, connectors) are built
 * when their module is imported. A text read at that moment would stay in the language of the first
 * start. Switch to a pseudo language and make sure no German source text is left in any of them.
 */
/** Code, plus `aiSchema` (sent to the model, German by design; the preview reads `t.aiLabels`). */
const SKIP_KEYS = new Set([
  'aiSchema',
  'component',
  'render',
  'importer',
  'run',
  'load',
  'detect',
  'Component',
]);

/** Every string reachable from `root` (getters are read) as `path = value`. */
function collectStrings(root: unknown): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, path: string, depth: number) => {
    if (typeof v === 'string') return void out.push([path, v]);
    if (!v || typeof v !== 'object' || seen.has(v) || depth > 10) return;
    seen.add(v);
    if ('$$typeof' in v) return; // React elements
    const id = (v as { id?: unknown }).id;
    for (const key of Object.keys(v)) {
      if (SKIP_KEYS.has(key)) continue;
      const step = typeof id === 'string' && Array.isArray(root) ? `${id}.${key}` : key;
      walk((v as Record<string, unknown>)[key], path ? `${path}.${step}` : step, depth + 1);
    }
  };
  walk(root, '', 0);
  return out;
}

const sourceTexts = new Set(
  collectStrings(de)
    .map(([, s]) => s)
    .filter((s) => s.length >= 4 && /[a-zäöüß]/i.test(s) && s !== de.appName),
);

describe('registries follow a language switch', () => {
  beforeAll(() => provideCatalog('es', pseudoCatalog(de)));
  // The global setup switches back to German after every test.
  beforeEach(() => setLang('es'));

  it.each([
    ['module manifests', () => allManifests],
    ['tools', () => allTools],
    ['settings sections', () => CORE_SECTIONS],
    ['settings categories', () => SETTINGS_CATEGORIES],
    ['setup steps', () => allSetupSteps],
    ['connectors', () => connectors],
  ])('%s hold no German text read at import time', (_name, get) => {
    const stale = collectStrings(get())
      .filter(([, s]) => sourceTexts.has(s))
      .map(([path, s]) => `${path} = ${s}`);
    expect(stale).toEqual([]);
  });
});
