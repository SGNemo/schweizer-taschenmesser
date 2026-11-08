import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { expandFiles } from '../files';
import { runJob, isAbort } from '../run';
import { detectSources } from '../registry';
import { parseMarkdownFolder, placeOf } from './parse';

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

describe('Obsidian vault with numbered folders and sub-folders (D04)', () => {
  const files = [
    { name: 'Vault/.obsidian/app.json', text: '{"theme":"obsidian"}' },
    {
      name: 'Vault/10_Arbeit/Inbetriebnahme Halle 3.md',
      text: '# Inbetriebnahme Halle 3\nIP-Plan',
    },
    { name: 'Vault/10_Arbeit/Projekte/Netzplan.md', text: '# Netzplan\nVLAN 10 #netz' },
    { name: 'Vault/10_Arbeit/Projekte/Kunde A/Abnahme.md', text: '# Abnahme\nOk' },
    { name: 'Vault/Start.md', text: '# Start\nÜbersicht' },
  ];
  const r = parseMarkdownFolder(files);
  const by = (title: string) => r.notes.find((n) => n.title === title)!;

  it('keeps the top folder as notebook and the deeper folders as a tag', () => {
    expect(by('Inbetriebnahme Halle 3')).toMatchObject({ folder: '10_Arbeit', tags: [] });
    expect(by('Netzplan').folder).toBe('10_Arbeit');
    expect(by('Netzplan').tags).toEqual(['netz', 'Projekte']);
    expect(by('Netzplan').body).toBe('VLAN 10 #netz\n\n#Projekte');
    expect(by('Abnahme').tags).toEqual(['Projekte/Kunde-A']);
    expect(by('Start').folder).toBeUndefined();
  });

  it('never counts hidden settings files as notes or as skipped', () => {
    expect(r.total).toBe(4);
    expect(r.skipped).toEqual({});
  });

  it('places files by their folders, whatever the folder names hold', () => {
    expect(placeOf([])).toEqual({});
    expect(placeOf(['A'])).toEqual({ folder: 'A' });
    expect(placeOf(['A', 'B.C (alt)'])).toEqual({ folder: 'A', tag: 'B-C-alt' });
    expect(placeOf(['A', '***'])).toEqual({ folder: 'A' });
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
