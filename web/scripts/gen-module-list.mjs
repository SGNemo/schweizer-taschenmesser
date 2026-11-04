#!/usr/bin/env node
/**
 * `npm run gen:modules`: one source for every list of modules and tools outside the app.
 *
 * Loads the real registry (`core/modules/registry.ts`, `core/tools/registry.ts`) and the language
 * catalogs through Vite's SSR loader, so names and descriptions are the ones the app shows, then
 * writes
 *   - `site/src/catalog/modules.json`   (all five languages; the website reads it),
 *   - the block between `<!-- modules:start -->` and `<!-- modules:end -->` in README.md,
 *     README.de.md, docs/user/modules.md and docs/user/modules.de.md (English and German).
 *
 *   node scripts/gen-module-list.mjs           write everything
 *   node scripts/gen-module-list.mjs --check   write nothing, exit 1 when a file is out of date
 *
 * The one-line text of a module is the first clause of its library description (`shortText` in
 * scripts/lib/moduleList.ts), so a new or reworded module shows up everywhere without a second text.
 */
import { createServer } from 'vite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, moduleBlock, platformKey, replaceBlock, shortText } from './lib/moduleList.ts';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(web, '..');
const check = process.argv.includes('--check');

const vite = await createServer({
  configFile: false,
  root: web,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: {
    alias: {
      '@': join(web, 'src'),
      zod: join(web, 'node_modules', 'zod'),
      tldts: join(web, 'node_modules', 'tldts'),
    },
  },
});

const status = (x) =>
  x.maturity === 'preview' ? 'preview' : x.defaultEnabled ? 'default' : 'optional';

let data;
try {
  const lang = await vite.ssrLoadModule('/src/core/i18n/lang.ts');
  await vite.ssrLoadModule('/src/core/i18n/catalogs.ts');
  const { allManifests } = await vite.ssrLoadModule('/src/core/modules/registry.ts');
  const { allTools } = await vite.ssrLoadModule('/src/core/tools/registry.ts');
  const { AREAS } = await vite.ssrLoadModule('/src/core/modules/types.ts');
  const { TOOL_CATEGORIES } = await vite.ssrLoadModule('/src/core/tools/types.ts');
  const { t } = await vite.ssrLoadModule('/src/strings.ts');

  // Same order as the library: `order`, then id. Dev-only (example) and retired modules are not listed.
  const modules = allManifests
    .filter((m) => !m.devOnly && !m.retired && m.area)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
  const tools = [...allTools];

  data = {
    areas: AREAS.map((id) => ({ id, name: {} })),
    modules: modules.map((m) => ({
      id: m.id,
      area: m.area,
      status: status(m),
      platforms: platformKey(m.platforms),
      name: {},
      short: {},
      description: {},
    })),
    toolCategories: TOOL_CATEGORIES.map((id) => ({ id, name: {} })),
    tools: tools.map((x) => ({ id: x.id, category: x.category, status: status(x), name: {} })),
  };

  for (const l of LANGS) {
    await lang.setLangPref(l);
    data.areas.forEach((a) => (a.name[l] = t.nav.areas[a.id]));
    modules.forEach((m, i) => {
      data.modules[i].name[l] = m.name;
      data.modules[i].short[l] = shortText(m.description);
      data.modules[i].description[l] = m.description;
    });
    data.toolCategories.forEach((c) => (c.name[l] = t.tools.panel.categories[c.id]));
    tools.forEach((x, i) => (data.tools[i].name[l] = x.name));
  }
} finally {
  await vite.close();
}

const stale = [];
function writeIfChanged(file, content) {
  const path = join(repo, file);
  const old = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (old === content) return;
  if (check) {
    stale.push(file);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${file}`);
}

writeIfChanged('site/src/catalog/modules.json', `${JSON.stringify(data, null, 2)}\n`);

const TARGETS = [
  ['README.md', 'en'],
  ['README.de.md', 'de'],
  ['docs/user/modules.md', 'en'],
  ['docs/user/modules.de.md', 'de'],
];
for (const [file, l] of TARGETS) {
  const path = join(repo, file);
  if (!existsSync(path)) continue;
  const next = replaceBlock(readFileSync(path, 'utf8'), moduleBlock(data, l));
  if (next !== undefined) writeIfChanged(file, next); // a file without markers has no generated block (yet)
}

if (check && stale.length) {
  console.error(`Out of date (run \`npm run gen:modules\`): ${stale.join(', ')}`);
  process.exit(1);
}
if (check) console.log('Module lists are up to date.');
