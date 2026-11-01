import { describe, expect, it } from 'vitest';
import {
  compareBudget,
  criticalPath,
  entries,
  forbiddenInPrecache,
  formatBudget,
  isStale,
  labelOf,
  lazyFiles,
  makeBudget,
  precacheUrls,
  type ViteManifest,
} from './bundleReport';

const manifest: ViteManifest = {
  'index.html': {
    file: 'assets/main.js',
    src: 'index.html',
    isEntry: true,
    imports: ['_react.js', '_db.js'],
    dynamicImports: ['src/tools/pdf/Tool.tsx'],
    css: ['assets/main.css'],
  },
  'capture.html': { file: 'assets/capture.js', isEntry: true, imports: ['_react.js'] },
  '_react.js': { file: 'assets/react.js' },
  '_db.js': { file: 'assets/db.js', imports: ['_react.js'] },
  'src/tools/pdf/Tool.tsx': {
    file: 'assets/Tool.js',
    src: 'src/tools/pdf/Tool.tsx',
    isDynamicEntry: true,
    imports: ['_db.js'],
    css: ['assets/Tool.css'],
  },
};
const sizes: Record<string, number> = {
  'assets/main.js': 100,
  'assets/main.css': 10,
  'assets/react.js': 50,
  'assets/db.js': 40,
  'assets/capture.js': 5,
  'assets/Tool.js': 300,
  'assets/Tool.css': 3,
};
const sizeOf = (f: string) => ({ bytes: sizes[f]! * 3, gzip: sizes[f]! });

describe('criticalPath', () => {
  it('follows static imports transitively, adds CSS, never dynamic imports', () => {
    const p = criticalPath(manifest, 'index.html', sizeOf);
    expect(p.files.map((f) => f.file)).toEqual([
      'assets/main.js',
      'assets/react.js',
      'assets/db.js',
      'assets/main.css',
    ]);
    expect(p.gzip).toBe(200);
    expect(p.bytes).toBe(600);
    expect(p.requests).toBe(4);
  });
  it('counts a shared chunk once', () => {
    expect(criticalPath(manifest, 'capture.html', sizeOf).files.map((f) => f.file)).toEqual([
      'assets/react.js',
      'assets/capture.js',
    ]);
  });
});

describe('entries / lazyFiles / labelOf', () => {
  it('lists the HTML entries', () => {
    expect(entries(manifest)).toEqual(['capture.html', 'index.html']);
  });
  it('lazy = every JS/CSS file on no critical path', () => {
    const critical = [
      'assets/main.js',
      'assets/react.js',
      'assets/db.js',
      'assets/main.css',
      'assets/capture.js',
    ];
    expect(lazyFiles(manifest, critical, sizeOf).map((f) => f.file)).toEqual([
      'assets/Tool.js',
      'assets/Tool.css',
    ]);
  });
  it('names a file by its source', () => {
    expect(labelOf(manifest, 'assets/Tool.js')).toBe('src/tools/pdf/Tool.tsx');
    expect(labelOf(manifest, 'assets/react.js')).toBe('_react.js');
    expect(labelOf(manifest, 'unknown.js')).toBe('unknown.js');
  });
});

describe('precacheUrls / forbiddenInPrecache', () => {
  const sw =
    'precacheAndRoute([{"revision":null,"url":"assets/main.js"},{"revision":"ab","url":"index.html"}]);';
  it('reads the injected precache list', () => {
    expect(precacheUrls(sw)).toEqual(['assets/main.js', 'index.html']);
  });
  it('reports online-only files that leaked into the precache', () => {
    expect(
      forbiddenInPrecache(['assets/main.js', 'assets/Tool.js'], ['assets/Tool.js', 'assets/x.js']),
    ).toEqual(['assets/Tool.js']);
  });
});

describe('budget', () => {
  const measured = {
    criticalGzip: 1000,
    criticalRequests: 20,
    precacheFiles: 100,
    precacheBytes: 50_000,
  };
  const budget = makeBudget(measured, 5);
  it('same numbers: all ok', () => {
    expect(compareBudget(budget, measured).every((l) => !l.over)).toBe(true);
  });
  it('at the limit passes, above warns', () => {
    const lines = compareBudget(budget, { ...measured, criticalGzip: 1050, precacheFiles: 106 });
    expect(lines.find((l) => l.metric === 'criticalGzip')).toMatchObject({
      limit: 1050,
      over: false,
    });
    expect(lines.find((l) => l.metric === 'precacheFiles')).toMatchObject({
      limit: 105,
      over: true,
    });
    expect(formatBudget(lines)).toMatch(/precacheFiles\s+106\s+105\s+OVER/);
  });
  it('a smaller bundle is never a warning', () => {
    expect(compareBudget(budget, { ...measured, criticalGzip: 10 }).some((l) => l.over)).toBe(
      false,
    );
  });
});

describe('isStale', () => {
  it('no build yet, or a source newer than the build: rebuild', () => {
    expect(isStale(undefined, [1])).toBe(true);
    expect(isStale(100, [50, 101])).toBe(true);
  });
  it('every source older than the build: reuse it', () => {
    expect(isStale(100, [50, 100])).toBe(false);
    expect(isStale(100, [])).toBe(false);
  });
});
