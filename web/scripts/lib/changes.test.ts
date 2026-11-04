import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AREAS, formatChangeFile, parseChangeFile } from './changes';

const ok = `---
type: fixed
area: calendar
breaking: false
pr: 12
de: Der Kalender zeigt Feiertage richtig an.
en: The calendar shows holidays correctly.
---

Free text between entries is ignored.

---
type: added
area: todos
breaking: true
highlight: true
de: "Todos haben Tags."
en: 'Todos have tags.'
---
`;

describe('parseChangeFile', () => {
  it('reads several entries, quotes and optional fields', () => {
    const { entries, errors } = parseChangeFile(ok);
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ type: 'fixed', area: 'calendar', pr: 12, highlight: false });
    expect(entries[1]).toMatchObject({ breaking: true, highlight: true, de: 'Todos haben Tags.' });
  });
  it('requires both languages, a known type and area', () => {
    const bad = parseChangeFile('---\ntype: oops\narea: nowhere\nde: x\n---\n');
    expect(bad.entries).toEqual([]);
    expect(bad.errors.join('\n')).toMatch(/type must be/);
    expect(bad.errors.join('\n')).toMatch(/unknown area/);
    expect(bad.errors.join('\n')).toMatch(/en is missing/);
  });
  it('rejects long sentences, unknown keys, unterminated blocks and empty files', () => {
    const long = `---\ntype: added\narea: app\nde: ${'a'.repeat(201)}\nen: ok\n---\n`;
    expect(parseChangeFile(long).errors.join()).toMatch(/max 200/);
    expect(parseChangeFile('---\nfoo: 1\n---\n').errors.join()).toMatch(/unknown or malformed/);
    expect(parseChangeFile('---\ntype: added\n').errors.join()).toMatch(/closing/);
    expect(parseChangeFile('nothing').errors.join()).toMatch(/no entry/);
  });
  it('accepts commit-style type aliases and stores the canonical type', () => {
    const { entries, errors } = parseChangeFile(
      '---\ntype: perf\narea: app\nde: Schneller.\nen: Faster.\n---\n',
    );
    expect(errors).toEqual([]);
    expect(entries[0]?.type).toBe('performance');
  });
  it('round-trips through formatChangeFile', () => {
    const { entries } = parseChangeFile(ok);
    expect(parseChangeFile(formatChangeFile(entries)).entries).toEqual(entries);
  });
});

describe('areas', () => {
  it('has a label for every module and tool', () => {
    const dir = (p: string) =>
      readdirSync(fileURLToPath(new URL(p, import.meta.url)), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    const ids = [...dir('../../src/modules'), ...dir('../../src/tools')];
    // Tool ids are covered by the single area "tools".
    const toolIds = new Set(dir('../../src/tools'));
    const missing = ids.filter((id) => !toolIds.has(id) && !AREAS[id]);
    expect(missing).toEqual([]);
  });
});
