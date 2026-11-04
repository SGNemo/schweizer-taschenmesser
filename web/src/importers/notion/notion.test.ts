import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { expandFiles } from '../files';
import { detectSources } from '../registry';
import { parseNotion } from './parse';

const ID1 = '0123456789abcdef0123456789abcdef';
const ID2 = 'fedcba9876543210fedcba9876543210';
const ID3 = '11111111111111112222222222222222';

const zip = zipSync({
  [`Export/Projekt Alpha ${ID1}.md`]: strToU8(
    `# Projekt Alpha\n\nStatus: In Arbeit\nTags: Büro, Wichtig\n\nSiehe [Aufgaben](Projekt%20Alpha/Aufgaben%20${ID2}.md) und [Weg](Gibt%20es%20nicht%20${ID3}.md).\n![Skizze](Projekt%20Alpha/skizze.png)\n[Vertrag](Projekt%20Alpha/vertrag.pdf)\n`,
  ),
  [`Export/Projekt Alpha/Aufgaben ${ID2}.md`]: strToU8('# Aufgaben\n\n- [ ] Äpfel & Müsli\n'),
  [`Export/Projekt Alpha/skizze.png`]: new Uint8Array([1, 2]),
  [`Export/Tabelle ${ID3}_all.csv`]: strToU8('Name,Status\nA,Offen\n'),
  [`Export/Leer ${ID3}.md`]: strToU8('\n'),
});

describe('Notion export', () => {
  const expanded = expandFiles([{ name: 'notion.zip', bytes: zip }]);
  const r = parseNotion(expanded.files, { binary: expanded.binary });

  it('is recognised by its id-suffixed page names', () => {
    expect(detectSources(expanded.files)[0]!.source.id).toBe('notion');
  });

  it('drops the id from titles, keeps properties, turns tags into #tags', () => {
    const page = r.notes.find((n) => n.title === 'Projekt Alpha')!;
    expect(page.body).toContain('Status: In Arbeit');
    expect(page.body).toContain('#Büro #Wichtig');
    expect(page.tags).toEqual(expect.arrayContaining(['Büro', 'Wichtig']));
  });

  it('links exported pages as wikilinks and keeps only the text of missing ones', () => {
    const page = r.notes.find((n) => n.title === 'Projekt Alpha')!;
    expect(page.body).toContain('[[Aufgaben]]');
    expect(page.body).not.toContain('Gibt%20es');
    expect(page.body).toContain('Weg.');
  });

  it('uses the top folder as notebook and counts files, images and tables', () => {
    const sub = r.notes.find((n) => n.title === 'Aufgaben')!;
    expect(sub.folder).toBe('Projekt Alpha');
    expect(sub.body).toContain('Äpfel & Müsli');
    // image + pdf link in the page, one binary file of the archive, one CSV table
    expect(r.skipped.attachment).toBe(3);
    expect(r.skipped.unsupported).toBe(1);
    expect(r.skipped.empty).toBe(1);
  });

  it('does not throw on odd input', () => {
    expect(
      parseNotion([{ name: `x ${ID1}.md`, text: '\u0000# ?' }]).notes.length,
    ).toBeLessThanOrEqual(1);
    expect(parseNotion([]).total).toBe(0);
  });
});
