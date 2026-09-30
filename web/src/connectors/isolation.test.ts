import { describe, expect, it } from 'vitest';

// Same idea as registry.test.ts: scan the sources, so the rule also holds where ESLint is not run.
const connectorSources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const moduleSources = import.meta.glob('../modules/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const aiSources = import.meta.glob('../core/ai/**/*.{ts,tsx}', {
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

describe('connector isolation', () => {
  it('finds the sources it is meant to check', () => {
    expect(Object.keys(connectorSources).length).toBeGreaterThan(5);
    expect(Object.keys(moduleSources).length).toBeGreaterThan(50);
    expect(Object.keys(aiSources).length).toBeGreaterThan(10);
  });

  it('connectors never import modules, the database, the sync internals or the AI code', () => {
    expect(
      offenders(connectorSources, /^@\/(modules|core\/db|core\/ai|core\/sync|core\/backup)(\/|$)/),
    ).toEqual([]);
    expect(offenders(connectorSources, /^(\.\.\/)+(modules|core)\//)).toEqual([]);
  });

  it('modules never import connectors', () => {
    expect(offenders(moduleSources, /^@\/connectors(\/|$)/)).toEqual([]);
  });

  it('the AI code never imports connectors (mail content cannot reach a model)', () => {
    expect(offenders(aiSources, /(^@\/connectors(\/|$))|(^@\/core\/connectors(\/|$))/)).toEqual([]);
  });
});
