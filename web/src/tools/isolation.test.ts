import { describe, expect, it } from 'vitest';

// Same idea as registry.test.ts: scan the sources, so the rule also holds where ESLint is not run.
const toolSources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const moduleSources = import.meta.glob('../modules/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const importsOf = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);

const offenders = (sources: Record<string, string>, bad: RegExp) =>
  Object.entries(sources)
    .filter(([file]) => !file.endsWith('isolation.test.ts'))
    .flatMap(([file, src]) =>
      importsOf(src)
        .filter((i) => bad.test(i))
        .map((i) => `${file} → ${i}`),
    );

describe('tool isolation', () => {
  it('finds the sources it is meant to check', () => {
    expect(Object.keys(toolSources).length).toBeGreaterThan(20);
    expect(Object.keys(moduleSources).length).toBeGreaterThan(50);
  });

  it('tools never import modules, connectors, the database or the AI code', () => {
    expect(
      offenders(toolSources, /^@\/(modules|connectors|core\/db|core\/ai|core\/connectors)(\/|$)/),
    ).toEqual([]);
    expect(offenders(toolSources, /^(\.\.\/){2,}(modules|connectors|core\/db)\//)).toEqual([]);
  });

  it('tools do not import each other (only their own folder and shared.ts)', () => {
    const bad = Object.entries(toolSources).flatMap(([file, src]) => {
      const own = file.split('/')[1];
      return importsOf(src)
        .filter(
          (i) => /^\.\.\/[^/]+/.test(i) && i !== '../shared' && !i.startsWith('../tools.module'),
        )
        .filter((i) => !i.startsWith(`../${own}`))
        .map((i) => `${file} → ${i}`);
    });
    expect(bad).toEqual([]);
  });

  it('modules never import tools', () => {
    expect(offenders(moduleSources, /^@\/tools(\/|$)/)).toEqual([]);
  });
});
