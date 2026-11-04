import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { expandFiles } from '../files';
import { runJob, isAbort } from '../run';
import { detectSources } from '../registry';
import { parseMarkdownFolder } from './parse';

const vault = {
  'MeinVault/.obsidian/app.json': strToU8('{"x":1}'),
  'MeinVault/.trash/alt.md': strToU8('# Gelöscht'),
  'MeinVault/Projekte/Garten.md': strToU8(
    '---\ntitle: Gartenplan\ntags: [haus, garten]\n---\nBeete ![[beet.png]] und [[Kompost]]\n![Skizze](bilder/skizze.jpg)\n',
  ),
  'MeinVault/Projekte/Kompost.md': strToU8('# Kompost\nSchichten #garten'),
  'MeinVault/Tagebuch.md': strToU8('Heute: Äpfel & Müsli 🍎'),
  'MeinVault/Leer.md': strToU8('   \n'),
  'MeinVault/bilder/skizze.jpg': new Uint8Array([0xff, 0xd8, 0xff]),
  'MeinVault/beet.png': new Uint8Array([0x89, 0x50]),
  '../evil.md': strToU8('# nope'),
};
const zip = (entries: Record<string, Uint8Array>) => zipSync(entries);

describe('Obsidian / Markdown folder', () => {
  const expanded = expandFiles([{ name: 'vault.zip', bytes: zip(vault) }]);

  it('unpacks a ZIP: text files kept, binaries counted, paths made safe', () => {
    expect(expanded.binary).toBe(2);
    expect(expanded.files.some((f) => f.name.includes('..'))).toBe(false);
    expect(expanded.files.find((f) => f.name.endsWith('Tagebuch.md'))!.text).toBe(
      'Heute: Äpfel & Müsli 🍎',
    );
  });

  const r = parseMarkdownFolder(expanded.files, { binary: expanded.binary });

  it('skips hidden folders and empty files; the vault name is not a notebook', () => {
    expect(r.notes.map((n) => n.title).sort()).toEqual(['Gartenplan', 'Kompost', 'Tagebuch']);
    expect(r.skipped.empty).toBe(1);
  });

  it('uses the top-level folder as notebook, keeps tags and wikilinks', () => {
    const garten = r.notes.find((n) => n.title === 'Gartenplan')!;
    expect(garten.folder).toBe('Projekte');
    expect(garten.tags).toEqual(expect.arrayContaining(['haus', 'garten']));
    expect(garten.body).toContain('[[Kompost]]');
    expect(r.notes.find((n) => n.title === 'Tagebuch')!.folder).toBeUndefined();
  });

  it('counts embedded and attached images instead of leaving dead links', () => {
    expect(r.skipped.attachment).toBe(2 + 2); // two binaries + two embeds removed from the text
    expect(r.notes.find((n) => n.title === 'Gartenplan')!.body).not.toContain('beet.png');
  });

  it('is detected as Obsidian by the .obsidian folder', () => {
    const top = detectSources(expanded.files)[0]!;
    expect(top.source.id).toBe('obsidian');
    expect(top.confidence).toBe(1);
  });
});

describe('archive safety', () => {
  it('refuses a broken ZIP without throwing', () => {
    const r = expandFiles([
      { name: 'bad.zip', bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]) },
    ]);
    expect(r.files).toEqual([]);
    expect(r.refused).toBe(1);
  });

  it('reads a Windows-1252 text file', () => {
    const r = expandFiles([{ name: 'a.txt', bytes: new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c]) }]);
    expect(r.files[0]!.text).toBe('Müll');
  });
});

describe('jobs', () => {
  it('runs inline without a Worker and reports progress', async () => {
    const seen: number[] = [];
    const out = await runJob(
      'markdown',
      { files: [{ name: 'a.md', text: '# A\nx' }], binary: 0 },
      { onProgress: (d) => seen.push(d) },
    );
    expect(out.notes).toHaveLength(1);
    expect(seen).toEqual([1]);
  });

  it('a cancelled job rejects with AbortError and returns nothing', async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      runJob('markdown', { files: [], binary: 0 }, { signal: ctl.signal }),
    ).rejects.toSatisfy(isAbort);
  });
});
