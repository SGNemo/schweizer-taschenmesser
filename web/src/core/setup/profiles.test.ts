import { describe, expect, it } from 'vitest';
import { allManifests } from '@/core/modules/registry';
import { allTools } from '@/core/tools/registry';
import {
  diffSelection,
  PROFILES,
  resolveProfile,
  toggleModule,
  withDependencies,
} from './profiles';

const infos = [
  { id: 'finance' },
  { id: 'invoices', requires: ['finance'] },
  { id: 'budgets', requires: ['finance'] },
  { id: 'todos' },
];

describe('profiles', () => {
  it('only reference modules and tools that exist', () => {
    const modules = new Set(allManifests.map((m) => m.id));
    const tools = new Set(allTools.map((t) => t.id));
    for (const p of PROFILES) {
      expect(
        p.modules.filter((m) => !modules.has(m)),
        p.id,
      ).toEqual([]);
      expect(
        p.tools.filter((x) => !tools.has(x)),
        p.id,
      ).toEqual([]);
    }
  });

  it('declares only existing requirements without cycles', () => {
    const ids = new Set(allManifests.map((m) => m.id));
    for (const m of allManifests) {
      for (const r of m.requires ?? []) expect(ids.has(r), `${m.id} → ${r}`).toBe(true);
      expect(m.requires ?? []).not.toContain(m.id);
    }
    expect(allManifests.find((m) => m.id === 'invoices')?.requires).toContain('finance');
  });

  it('pulls in dependencies and reports why', () => {
    const r = withDependencies(['invoices'], infos);
    expect([...r.ids].sort()).toEqual(['finance', 'invoices']);
    expect(r.viaDependency).toEqual({ finance: ['invoices'] });
  });

  it('resolves a profile with its dependencies and ignores unknown ids', () => {
    const r = resolveProfile(
      {
        id: 'x',
        modules: ['invoices', 'gone'],
        tools: ['calc', 'gone'],
      },
      infos,
      [{ id: 'calc' }],
    );
    expect([...r.modules].sort()).toEqual(['finance', 'invoices']);
    expect([...r.tools]).toEqual(['calc']);
  });

  it('every real profile resolves to a consistent set', () => {
    for (const p of PROFILES) {
      const r = resolveProfile(p, allManifests, allTools);
      for (const id of r.modules) {
        for (const dep of allManifests.find((m) => m.id === id)?.requires ?? [])
          expect(r.modules.has(dep), `${p.id}: ${id} needs ${dep}`).toBe(true);
      }
    }
  });

  it('switching on adds what a module builds on, switching off drops dependents', () => {
    const on = toggleModule(new Set(['todos']), 'budgets', true, infos);
    expect([...on].sort()).toEqual(['budgets', 'finance', 'todos']);
    const off = toggleModule(
      new Set(['todos', 'finance', 'budgets', 'invoices']),
      'finance',
      false,
      infos,
    );
    expect([...off]).toEqual(['todos']);
  });

  it('diffs the current against the target state', () => {
    expect(diffSelection(new Set(['a', 'b']), new Set(['b', 'c']))).toEqual({
      enable: ['c'],
      disable: ['a'],
    });
    expect(diffSelection(new Set(['a']), new Set(['a']))).toEqual({ enable: [], disable: [] });
  });
});
