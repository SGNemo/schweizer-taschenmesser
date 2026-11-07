// @vitest-environment jsdom
/**
 * Import v2: one test per new or sharpened source – recognised, counted, previewed, duplicates on the
 * second run, undone as a whole run. All fixtures are invented.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { planRuns, summaryLine, certainty } from '@/core/importer/appImport';
import { commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import { listRuns, undoRun } from '@/core/importer/runs';
import type { ImportPreset } from '@/core/importer/types';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { itemRepo } from '@/modules/bookmarks/repo';
import { personRepo } from '@/modules/people/repo';
import { listRepo, taskRepo } from '@/modules/todos/repo';
import { decode, expandFiles } from './files';
import { detectSources, sourceById, SOURCES } from './registry';
import { dayIn, parseTickTickCsv } from './ticktick/parse';
import type { SourceFile } from './types';

const fixture = (n: string) =>
  readFileSync(resolve(process.cwd(), 'src/importers/__fixtures__', n), 'utf8');

/** Runs one planned part like the wizard does: parse with the preset, preview, commit. */
async function runPart(moduleId: string, preset: ImportPreset, batchId: string) {
  const manifest = getManifest(moduleId)!;
  const runtime = (await manifest.contributions!.onboarding!.load!()).default;
  const parsed = await runtime.parse(
    preset.importerId,
    {
      kind: 'file',
      text: preset.files[0]!.text,
      fileName: preset.files[0]!.name,
      files: preset.files,
    },
    { today: '2026-11-06', options: preset.options ?? {}, batchId },
  );
  const rows = await buildPreview(manifest, runtime, parsed.candidates);
  return { manifest, parsed, rows };
}

/** Detect → plan → parse → commit every part under one group id, like the sheet and the host. */
async function move(files: SourceFile[], groupId: string) {
  const sure = detectSources(files)
    .filter((d) => d.confidence >= 0.6)
    .map((d) => d.source);
  const parts = planRuns(sure, files, 0, groupId, 'export.zip');
  const results = [];
  for (const [n, part] of parts.entries()) {
    const r = await runPart(part.moduleId, part.preset!, `${groupId}${n}`);
    results.push(r);
    if (r.rows.some((x) => x.selected))
      await commitImport(r.manifest, {
        batchId: `${groupId}${n}`,
        importerId: part.preset!.importerId,
        source: part.preset!.source ?? 'x',
        rows: r.rows,
        base: { groupId },
      });
  }
  return { sure, parts, results };
}

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 6, 10, 0).getTime());
  for (const m of visibleManifests)
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  await db.table('_imports').clear();
  await db.table('_outbox').clear();
});
afterEach(() => setNow());

describe('encodings', () => {
  it('drops a UTF-8 BOM and reads UTF-16 by its byte order mark', () => {
    expect(decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('A');
    const le = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0xe4, 0x00]);
    expect(decode(le)).toBe('Hä');
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0xe4]);
    expect(decode(be)).toBe('Hä');
  });

  it('falls back to Windows-1252 for old German exports', () => {
    // "Müll" in Windows-1252 is not valid UTF-8.
    expect(decode(new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c]))).toBe('Müll');
  });
});

describe('certainty and counts', () => {
  it('words the confidence', () => {
    expect(certainty(1)).toBe('sure');
    expect(certainty(0.7)).toBe('likely');
    expect(certainty(0.4)).toBe('maybe');
  });

  it('every source that counts gives numbers only', () => {
    for (const s of SOURCES)
      expect(s.summarize?.([]) ?? {}).toSatisfy((x: object) =>
        Object.values(x).every((v) => typeof v === 'number'),
      );
  });
});

describe('Todoist ZIP (one CSV per project) end to end', () => {
  const head =
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT';
  const zip = zipSync({
    'Haushalt.csv': strToU8(
      [
        head,
        'task,Fenster putzen,,1,1,,,15 Nov 2026,en,Europe/Berlin,45,minute',
        'task,Blumen gießen,,4,1,,,every monday,en,Europe/Berlin,,',
        'task,Erde kaufen,,4,2,,,,en,Europe/Berlin,,',
      ].join('\n'),
    ),
    'Arbeit.csv': strToU8(
      [head, 'section,Diese Woche,,,,,,,,,,', 'task,Bericht schreiben,,2,1,,,,en,,90,minute'].join(
        '\n',
      ),
    ),
    // Todoist backups add the project id to the file name.
    'Privat [2290578498].csv': strToU8(
      [head, 'task,Geburtstag planen,,4,1,,,jeden 3.,de,,,'].join('\n'),
    ),
  });
  const files = () => expandFiles([{ name: 'Todoist.zip', bytes: zip }]).files;

  it('is recognised for sure and counted: 3 projects, 5 tasks', () => {
    const [top] = detectSources(files());
    expect(top!.source.id).toBe('todoist');
    expect(certainty(top!.confidence)).toBe('sure');
    expect(top!.source.summarize!(files())).toEqual({ projects: 3, tasks: 5 });
    expect(summaryLine(top!.source.summarize!(files()))).toBe('3 Projekte · 5 Aufgaben');
  });

  it('makes one preview with a list per project, repeats and estimates; duplicates; undo', async () => {
    const { parts, results } = await move(files(), 'g1');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.preset!.options).toEqual({ fileList: '@source' });
    const rows = results[0]!.rows;
    const lists = rows
      .filter((r) => r.candidate.collection === 'list')
      .map((r) => r.candidate.label);
    expect(lists.sort()).toEqual(['Arbeit', 'Haushalt', 'Privat']);
    const task = (title: string) => rows.find((r) => r.candidate.label === title)!.candidate.data;
    expect(task('Fenster putzen')).toMatchObject({ estimateMin: 45, dueDate: '2026-11-15' });
    expect(task('Bericht schreiben')).toMatchObject({ estimateMin: 90 });
    expect(task('Blumen gießen')).toMatchObject({
      recurrence: { freq: 'weekly', byWeekday: [1] },
      dueDate: '2026-11-09',
    });
    expect(task('Geburtstag planen')).toMatchObject({
      recurrence: { freq: 'monthly', byMonthDay: 3 },
      dueDate: '2026-12-03',
    });
    expect(task('Erde kaufen').parentId).toBeTruthy();
    expect(await taskRepo.active().count()).toBe(5);
    expect(await listRepo.active().count()).toBe(3);

    // The same export again: everything is already there.
    const again = await runPart('todos', parts[0]!.preset!, 'g2');
    expect(
      again.rows.filter((r) => r.candidate.collection === 'task').every((r) => r.duplicate),
    ).toBe(true);

    const [run] = await listRuns();
    expect(run).toMatchObject({ groupId: 'g1', count: 8, undone: false });
    expect(await undoRun('g1')).toEqual({ removed: 8, kept: 0 });
    expect(await taskRepo.active().count()).toBe(0);
    expect((await listRuns())[0]!.undone).toBe(true);
  });
});

describe('TickTick backup end to end', () => {
  const file = () => ({ name: 'TickTick-backup.csv', text: fixture('ticktick.csv') });

  it('reads days in the task’s time zone, repeats, durations, subtasks; skips notes', () => {
    expect(dayIn('2026-11-08T23:00:00+0000', 'Europe/Berlin')).toBe('2026-11-09');
    const { tasks, skipped } = parseTickTickCsv(file().text);
    expect(skipped).toBe(1);
    const by = (title: string) => tasks.find((x) => x.title === title)!;
    expect(by('Fenster putzen')).toMatchObject({
      due: '2026-11-10',
      estimateMin: 90,
      priority: 2,
      description: 'Erst innen, dann außen',
      list: 'Haushalt',
    });
    expect(by('Leiter leihen').parentKey).toBe('a1');
    expect(by('Müll rausbringen')).toMatchObject({
      due: '2026-11-09',
      recurrence: { freq: 'weekly', byWeekday: [1] },
    });
    expect(by('Müll rausbringen').estimateMin).toBeUndefined();
    expect(by('Bericht „Q4“ abgeben')).toMatchObject({ priority: 3, due: '2026-11-21' });
    expect(by('Alte Ablage').done).toBe(true);
    // A rule the app cannot hold stays a hint.
    expect(by('Steuer, jährlich').recurrence).toBeUndefined();
    expect(by('Steuer, jährlich').dateHint?.recurring).toBe(true);
  });

  it('is recognised, counted, imported, a duplicate the second time and undone', async () => {
    const [top] = detectSources([file()]);
    expect(top!.source.id).toBe('ticktick');
    expect(top!.source.summarize!([file()])).toEqual({ lists: 2, tasks: 5 });
    const { results } = await move([file()], 't1');
    const rows = results[0]!.rows;
    // Completed tasks stay out by default; the rest lands in one list per TickTick list.
    expect(rows.filter((r) => r.candidate.collection === 'task')).toHaveLength(5);
    expect(await taskRepo.active().count()).toBe(5);
    const again = await runPart(
      'todos',
      { importerId: 'file', files: [file()], options: { fileList: '@source' } },
      't2',
    );
    expect(
      again.rows.filter((r) => r.candidate.collection === 'task').every((r) => r.duplicate),
    ).toBe(true);
    await undoRun('t1');
    expect(await taskRepo.active().count()).toBe(0);
  });
});

describe('Contacts (vCard) end to end', () => {
  const file = () => ({
    name: 'Takeout/Contacts/Alle Kontakte.vcf',
    text: fixture('contacts.vcf'),
  });

  it('is recognised, counted, takes the birthdays, says what stays out, dedupes and undoes', async () => {
    const [top] = detectSources([file()]);
    expect(top!.source.id).toBe('contacts');
    expect(top!.source.summarize!([file()])).toEqual({ contacts: 2 });
    const { results } = await move([file()], 'c1');
    expect(results[0]!.rows.map((r) => r.candidate.label)).toEqual([
      'Anna Beispiel',
      'Jürgen Müller',
    ]);
    expect(results[0]!.parsed.notes.join(' ')).toContain('1 Kontakt ohne Geburtstag');
    expect(await personRepo.active().count()).toBe(2);
    const again = await runPart('people', { importerId: 'file', files: [file()] }, 'c2');
    expect(again.rows.every((r) => r.duplicate)).toBe(true);
    await undoRun('c1');
    expect(await personRepo.active().count()).toBe(0);
  });
});

describe('Browser bookmarks end to end', () => {
  const file = () => ({ name: 'bookmarks_06.11.26.html', text: fixture('bookmarks.html') });

  it('is recognised, counted, imported, a duplicate the second time and undone', async () => {
    const [top] = detectSources([file()]);
    expect(top!.source.id).toBe('bookmarks');
    expect(top!.source.summarize!([file()])).toEqual({ bookmarks: 3 });
    const { results } = await move([file()], 'b1');
    const labels = results[0]!.rows.filter((r) => r.selected).map((r) => r.candidate.label);
    expect(labels).toEqual(expect.arrayContaining(['Rezepte & Ideen', 'Fahrplan']));
    expect(await itemRepo.active().count()).toBe(labels.length);
    const again = await runPart('bookmarks', { importerId: 'html', files: [file()] }, 'b2');
    expect(again.rows.filter((r) => !r.invalid).every((r) => r.duplicate)).toBe(true);
    await undoRun('b1');
    expect(await itemRepo.active().count()).toBe(0);
  });

  it('an ordinary web page is not a bookmarks file', () => {
    expect(
      sourceById('bookmarks')!.detect([
        { name: 'index.html', text: '<html><body><a href="x">x</a>' },
      ]),
    ).toBe(0);
  });
});

describe('a Takeout with several parts is one run', () => {
  it('lists the parts under one group and undoes all of them', async () => {
    const zip = zipSync({
      'Takeout/Contacts/Alle.vcf': strToU8(fixture('contacts.vcf')),
      'Takeout/Calendar/Privat.ics': strToU8(
        'BEGIN:VCALENDAR\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\nBEGIN:VEVENT\nUID:e1\nDTSTART;VALUE=DATE:20261120\nSUMMARY:Konzert\nEND:VEVENT\nEND:VCALENDAR',
      ),
    });
    const files = expandFiles([{ name: 'takeout.zip', bytes: zip }]).files;
    const { parts } = await move(files, 'tk');
    expect(parts.map((p) => p.moduleId).sort()).toEqual(['calendar', 'people']);
    const [run] = await listRuns();
    expect(run!.parts.map((p) => p.moduleId).sort()).toEqual(['calendar', 'people']);
    expect(run!.count).toBe(3);
    expect(run!.source).toBe('export.zip');
    await undoRun('tk');
    expect(await personRepo.active().count()).toBe(0);
    expect((await listRuns())[0]!.undone).toBe(true);
  });
});
