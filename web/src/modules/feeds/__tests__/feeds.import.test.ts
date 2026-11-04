// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport, undoImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import type { ImportInput } from '@/core/importer/types';
import manifest from '../manifest';
import { feedRepo } from '../repo';

const opml = readFileSync(
  resolve(process.cwd(), 'src/importers/__fixtures__/subscriptions.opml'),
  'utf8',
);

async function run(id: string, input: ImportInput) {
  const runtime = (await manifest.contributions!.onboarding!.load!()).default;
  const parsed = await runtime.parse(id, input, {
    today: '2026-09-29',
    options: {},
    batchId: 'fb',
  });
  return { parsed, rows: await buildPreview(manifest, runtime, parsed.candidates) };
}
const file = (text: string): ImportInput => ({ kind: 'file', text, fileName: 'abos.opml' });

beforeEach(async () => {
  await db.table('feeds_feed').clear();
  await db.table('_imports').clear();
});

describe('feeds import', () => {
  it('previews an OPML file, commits it, finds duplicates the second time and undoes', async () => {
    const first = await run('file', file(opml));
    expect(first.rows).toHaveLength(6);
    expect(first.rows.every((r) => r.selected)).toBe(true);
    expect(first.parsed.skipped?.unsupported).toBe(2);
    await commitImport(manifest, {
      batchId: 'fb',
      importerId: 'file',
      source: 'abos.opml',
      rows: first.rows,
    });
    expect(await feedRepo.active().count()).toBe(6);

    const again = await run('file', file(opml));
    expect(again.rows.every((r) => r.duplicate && !r.selected)).toBe(true);

    expect(await undoImport(manifest, 'fb')).toEqual({ removed: 6, kept: 0 });
    expect(await feedRepo.active().count()).toBe(0);
  });

  it('treats www., scheme and a trailing slash as the same feed', async () => {
    await feedRepo.create({ title: 'Wissen', url: 'http://wissen.example.org/rss', category: '' });
    const r = await run('file', file(opml));
    const wissen = r.rows.find((x) => x.candidate.label === 'Wissen')!;
    expect(wissen.duplicate).toBe(true);
  });

  it('reads pasted addresses, with or without a name, and skips lines that are no address', async () => {
    const r = await run('text', {
      kind: 'text',
      text: 'Tagesbericht https://tagesbericht.example.org/feed.xml\nblog.example.org/feed.xml\nkeine adresse hier\n',
    });
    expect(r.rows.map((x) => x.candidate.label)).toEqual(['Tagesbericht', 'blog.example.org']);
    expect(r.parsed.skipped?.unsupported).toBe(1);
  });

  it('a file that is no OPML gives a report line, no rows', async () => {
    const r = await run('file', file('{"not":"opml"}'));
    expect(r.rows).toHaveLength(0);
    expect(r.parsed.skipped?.unreadable).toBe(1);
  });
});
