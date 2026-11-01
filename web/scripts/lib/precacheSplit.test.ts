import { describe, expect, it } from 'vitest';
import { isOnlineRoot, onlineOnlyFiles, type GraphChunk } from './precacheSplit';

const chunk = (file: string, o: Partial<GraphChunk> = {}): GraphChunk => ({
  file,
  isEntry: false,
  facadeModuleId: null,
  imports: [],
  dynamicImports: [],
  assets: [],
  ...o,
});

describe('isOnlineRoot', () => {
  it('tool views, the chat view and the password dictionaries', () => {
    expect(isOnlineRoot('/repo/web/src/tools/pdf/View.tsx')).toBe(true);
    expect(isOnlineRoot('C:\\repo\\web\\src\\tools\\calc\\View.tsx')).toBe(true);
    expect(isOnlineRoot('/repo/web/src/modules/chat/routes/ChatView.tsx')).toBe(true);
    expect(isOnlineRoot('/repo/web/node_modules/@zxcvbn-ts/language-de/dist/index.mjs')).toBe(true);
    expect(isOnlineRoot('/repo/web/node_modules/mathjs/lib/esm/index.js')).toBe(true);
  });
  it('never the thin entries, module pages or other libraries', () => {
    expect(isOnlineRoot('/repo/web/src/tools/pdf/Tool.tsx')).toBe(false);
    expect(isOnlineRoot('/repo/web/src/tools/pdf/manifest.ts')).toBe(false);
    expect(isOnlineRoot('/repo/web/src/modules/chat/routes/ChatPage.tsx')).toBe(false);
    expect(isOnlineRoot('/repo/web/src/modules/todos/routes/TodosPage.tsx')).toBe(false);
    expect(isOnlineRoot('/repo/web/node_modules/pdf-lib/es/index.js')).toBe(false);
    expect(isOnlineRoot('/repo/web/node_modules/@anthropic-ai/sdk/index.mjs')).toBe(false);
    expect(isOnlineRoot(null)).toBe(false);
  });
});

describe('onlineOnlyFiles', () => {
  const chunks = [
    chunk('main.js', {
      isEntry: true,
      imports: ['vendor.js'],
      dynamicImports: ['Tool.js', 'Page.js'],
    }),
    chunk('vendor.js'),
    // Precached module page that lazily loads a shared helper.
    chunk('Page.js', {
      facadeModuleId: 'src/modules/todos/routes/TodosPage.tsx',
      dynamicImports: ['helper.js'],
    }),
    // Thin tool entry → the tool view (online root).
    chunk('Tool.js', { facadeModuleId: 'src/tools/pdf/Tool.tsx', dynamicImports: ['View.js'] }),
    chunk('View.js', {
      facadeModuleId: 'src/tools/pdf/View.tsx',
      imports: ['pdflib.js', 'helper.js'],
      assets: ['View.css'],
    }),
    chunk('pdflib.js'),
    chunk('helper.js', { assets: ['helper.css'] }),
  ];

  it('drops what only an online root reaches, keeps what a precached part needs too', () => {
    expect(onlineOnlyFiles(chunks)).toEqual(['View.css', 'View.js', 'pdflib.js']);
  });

  it('a root that a precached chunk imports statically stays precached', () => {
    const withStatic = chunks.map((c) =>
      c.file === 'Page.js' ? { ...c, imports: ['View.js'] } : c,
    );
    expect(onlineOnlyFiles(withStatic)).toEqual([]);
  });

  it('a root reached by a dynamic import of a non-root through another path stays out', () => {
    const viaTwo = [...chunks, chunk('capture.js', { isEntry: true, dynamicImports: ['Tool.js'] })];
    expect(onlineOnlyFiles(viaTwo)).toEqual(['View.css', 'View.js', 'pdflib.js']);
  });

  it('no roots: nothing leaves the precache', () => {
    expect(onlineOnlyFiles(chunks, () => false)).toEqual([]);
  });
});
