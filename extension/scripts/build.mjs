// Builds the unpacked extension into dist/: one bundle per entry (content script and pages as
// classic scripts, service worker as module), plus manifest, HTML, CSS and icons.
import { build } from 'vite';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
// `NEMO_EXT_E2E=1` builds the test flavour (open shadow root so Playwright can reach the overlay)
// into dist-e2e/. The release flavour in dist/ always uses a closed shadow root.
const e2e = process.env.NEMO_EXT_E2E === '1';
const dist = join(root, e2e ? 'dist-e2e' : 'dist');
const at = (p) => join(root, p);

const alias = {
  '@nemo/vault-core': at('../packages/vault-core/src/index.ts'),
  tldts: at('node_modules/tldts'),
  zod: at('node_modules/zod'),
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const entries = [
  { name: 'background', input: 'src/background.ts', format: 'es' },
  { name: 'content', input: 'src/content/main.ts', format: 'iife' },
  { name: 'popup', input: 'src/popup/popup.ts', format: 'iife' },
  { name: 'offscreen', input: 'src/offscreen/offscreen.ts', format: 'iife' },
];

for (const { name, input, format } of entries) {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    resolve: { alias },
    define: { __NEMO_E2E__: JSON.stringify(e2e) },
    build: {
      outDir: dist,
      emptyOutDir: false,
      minify: false, // readable for review; the zip is small either way
      sourcemap: false,
      target: 'es2022',
      lib: {
        entry: at(input),
        name: `nemo_${name}`,
        formats: [format],
        fileName: () => `${name}.js`,
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
}

for (const file of ['popup.html', 'popup.css', 'offscreen.html'])
  cpSync(at(`static/${file}`), join(dist, file));
cpSync(at('static/icons'), join(dist, 'icons'), { recursive: true });
cpSync(at('manifest.json'), join(dist, 'manifest.json'));

// Sanity: every file the manifest points at exists.
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
const files = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...manifest.content_scripts.flatMap((c) => c.js),
  ...Object.values(manifest.icons),
];
for (const f of files) if (!existsSync(join(dist, f))) throw new Error(`missing ${f} in dist`);
writeFileSync(join(dist, 'BUILD.txt'), `Nemo browser extension ${manifest.version}\n`);
console.log(`Built ${manifest.name} ${manifest.version} → ${e2e ? 'dist-e2e' : 'dist'}/`);
