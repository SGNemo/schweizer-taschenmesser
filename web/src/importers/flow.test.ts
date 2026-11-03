// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport, listBatches, undoImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import type { ImportInput, ImportReportCounts } from '@/core/importer/types';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { noteRepo, notebookRepo } from '@/modules/notes/repo';
import { taskRepo } from '@/modules/todos/repo';
import { planRuns } from '@/core/importer/appImport';
import { expandFiles } from './files';
import { detectSources, SOURCES } from './registry';
import { skipNotes } from './report';

const fixture = (n: string) =>
  readFileSync(resolve(process.cwd(), 'src/importers/__fixtures__', n), 'utf8');

async function parse(
  moduleId: string,
  importerId: string,
  input: ImportInput,
  options: Record<string, string> = {},
) {
  const manifest = getManifest(moduleId)!;
  const runtime = (await manifest.contributions!.onboarding!.load!()).default;
  const parsed = await runtime.parse(importerId, input, {
    today: '2026-09-29',
    options,
    batchId: 'tb',
  });
  return {
    manifest,
    runtime,
    parsed,
    rows: await buildPreview(manifest, runtime, parsed.candidates),
  };
}

const files = (...f: { name: string; text: string }[]): ImportInput => ({
  kind: 'file',
  text: f[0]!.text,
  fileName: f[0]!.name,
  files: f,
});

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  for (const m of visibleManifests)
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  await db.table('_imports').clear();
  await db.table('_outbox').clear();
});
afterEach(() => setNow());

describe('Evernote import end to end', () => {
  const input = () => files({ name: 'notes.enex', text: fixture('notes.enex') });

  it('previews, commits with a report, finds duplicates on the second run and undoes', async () => {
    const first = await parse('notes', 'file', input());
    expect(first.rows.map((r) => r.candidate.label)).toContain('Einkaufsliste & Ideen');
    expect(first.parsed.skipped?.attachment).toBe(1);
    expect(first.rows.every((r) => r.selected)).toBe(true);

    const report: ImportReportCounts = {
      found: first.rows.length,
      imported: 0,
      duplicates: 0,
      invalid: 0,
      deselected: 0,
      skipped: { ...first.parsed.skipped },
    };
    const batch = await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'file',
      source: 'notes.enex',
      rows: first.rows,
      base: { report },
    });
    expect(batch.report?.imported).toBe(2);
    expect(batch.report?.skipped.attachment).toBe(1);
    expect(await noteRepo.active().count()).toBe(2);
    expect((await listBatches('notes'))[0]!.report?.imported).toBe(2);

    // The same file again: everything is recognised as already there and unticked.
    const again = await parse('notes', 'file', input());
    expect(again.rows.every((r) => r.duplicate && !r.selected)).toBe(true);

    expect(await undoImport(first.manifest, 'tb')).toEqual({ removed: 2, kept: 0 });
    expect(await noteRepo.active().count()).toBe(0);
  });

  it('a broken ENEX gives a report line, not a crash', async () => {
    const r = await parse(
      'notes',
      'file',
      files({ name: 'kaputt.enex', text: '<en-export><note><title>x' }),
    );
    expect(r.rows).toHaveLength(0);
    expect(r.parsed.skipped?.unreadable).toBe(1);
    expect(skipNotes(r.parsed.skipped!)[0]).toMatch(/1/);
  });
});

describe('Obsidian ZIP end to end', () => {
  const zip = zipSync({
    'Vault/.obsidian/x.json': strToU8('{}'),
    'Vault/Alltag/Plan.md': strToU8('---\ntags: [privat]\n---\n# Plan\nSiehe [[Liste]]'),
    'Vault/Alltag/Liste.md': strToU8('# Liste\n- [ ] Milch'),
    'Vault/Bild.png': new Uint8Array([1, 2, 3]),
  });

  it('creates a notebook per top-level folder and reuses an existing one', async () => {
    await notebookRepo.create({ name: 'alltag', order: 0 }, { id: 'nb-old' });
    const expanded = expandFiles([{ name: 'vault.zip', bytes: zip }]);
    const r = await parse('notes', 'file', {
      ...files(...expanded.files),
      binary: expanded.binary,
    });
    expect(r.rows.filter((x) => x.candidate.collection === 'notebook')).toHaveLength(0);
    for (const row of r.rows) expect(row.candidate.data.notebookId).toBe('nb-old');
    expect(r.parsed.skipped?.attachment).toBe(1);
  });

  it('proposes a new notebook and drops notes with it when it is unticked', async () => {
    const expanded = expandFiles([{ name: 'vault.zip', bytes: zip }]);
    const r = await parse('notes', 'file', files(...expanded.files));
    const book = r.rows.find((x) => x.candidate.collection === 'notebook')!;
    expect(book.candidate.label).toBe('Alltag');
    const noted = r.rows.filter((x) => x.candidate.collection === 'note');
    expect(noted.every((x) => x.candidate.dependsOn === book.candidate.id)).toBe(true);
    const rows = r.rows.map((x) => (x === book ? { ...x, selected: false } : x));
    await expect(
      commitImport(r.manifest, { batchId: 'tb', importerId: 'file', source: 'v', rows }),
    ).rejects.toThrow();
  });
});

describe('Microsoft To Do (Outlook CSV) end to end', () => {
  it('imports tasks, marks completed ones and dedupes', async () => {
    const input = files({ name: 'Aufgaben.csv', text: fixture('outlook-tasks-de.csv') });
    const perSource = { fileList: '@source' };
    const first = await parse('todos', 'file', input, perSource);
    const taskRows = first.rows.filter((r) => r.candidate.collection === 'task');
    expect(taskRows.map((r) => r.candidate.label)).toEqual(['Müll rausbringen']);
    expect(taskRows[0]!.candidate.data).toMatchObject({ priority: 3, dueDate: '2026-01-16' });
    await commitImport(first.manifest, {
      batchId: 'tb',
      importerId: 'file',
      source: 'x',
      rows: first.rows,
    });
    expect((await taskRepo.active().toArray()).map((x) => x.title)).toEqual(['Müll rausbringen']);
    const dup = await parse('todos', 'file', input, perSource);
    expect(
      dup.rows.filter((r) => r.candidate.collection === 'task').every((r) => r.duplicate),
    ).toBe(true);
  });
});

describe('commit leaves no half state', () => {
  it('takes back what it wrote when a later collection fails', async () => {
    const r = await parse(
      'notes',
      'file',
      files({ name: 'a.md', text: '# Eins\nText' }, { name: 'b.md', text: '# Zwei\nText' }),
    );
    const bad = [
      ...r.rows,
      { ...r.rows[0]!, candidate: { ...r.rows[0]!.candidate, collection: 'nope' } },
    ];
    await expect(
      commitImport(r.manifest, { batchId: 'tb', importerId: 'file', source: 'x', rows: bad }),
    ).rejects.toThrow();
    expect(await noteRepo.active().count()).toBe(0);
    expect(await listBatches('notes')).toHaveLength(0);
  });
});

describe('detection and planning', () => {
  it('every source has an id, a target and detects nothing in an empty selection', () => {
    for (const s of SOURCES) {
      expect(s.id).toBeTruthy();
      expect(s.targets.length).toBeGreaterThan(0);
      expect(s.detect([])).toBe(0);
    }
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
  });

  it('recognises a Takeout ZIP with calendar and Keep, one run per part under one group id', () => {
    const zip = zipSync({
      'Takeout/Calendar/privat.ics': strToU8('BEGIN:VCALENDAR\nX-WR-CALNAME:Privat\nEND:VCALENDAR'),
      'Takeout/Keep/Idee.json': strToU8(
        '{"title":"Idee","textContent":"x","isTrashed":false,"isPinned":false}',
      ),
      'Takeout/Keep/Bild.jpg': new Uint8Array([1]),
    });
    const expanded = expandFiles([{ name: 'takeout.zip', bytes: zip }]);
    const sure = detectSources(expanded.files)
      .filter((d) => d.confidence >= 0.6)
      .map((d) => d.source.id);
    expect(sure).toEqual(expect.arrayContaining(['google-calendar', 'google-keep']));
    const runs = planRuns(
      SOURCES.filter((s) => sure.includes(s.id)),
      expanded.files,
      expanded.binary,
      'g1',
      'takeout.zip',
    );
    expect(runs.map((r) => r.moduleId).sort()).toEqual(['calendar', 'notes']);
    expect(new Set(runs.map((r) => r.preset!.groupId))).toEqual(new Set(['g1']));
    expect(runs.find((r) => r.moduleId === 'notes')!.preset!.binary).toBe(1);
  });

  it('knows a password-manager CSV and sends it to the vault, not the wizard', () => {
    const csv = {
      name: 'export.csv',
      text: 'Group,Title,Username,Password,URL,Notes\nRoot,A,u,p,,',
    };
    const top = detectSources([csv])[0]!;
    expect(top.source.id).toBe('vault-csv');
    expect(planRuns([top.source], [csv], 0, 'g', 'x')).toEqual([]);
    expect(top.source.targets[0]!.route).toBe('/accounts?tools=1');
  });

  it('tells bank CSVs, task CSVs and password CSVs apart', () => {
    const bank = {
      name: 'umsaetze.csv',
      text: 'Buchungstag;Betrag;Verwendungszweck\n01.01.2026;-5,00;Kaffee',
    };
    const outlook = { name: 'a.csv', text: fixture('outlook-tasks-en.csv') };
    expect(detectSources([bank])[0]!.source.id).toBe('bank');
    expect(detectSources([outlook])[0]!.source.id).toBe('outlook-tasks');
  });
});
