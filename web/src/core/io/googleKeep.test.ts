import { describe, expect, it } from 'vitest';
import { parseGoogleKeep } from './googleKeep';

const note = (extra: Record<string, unknown>) => ({
  color: 'DEFAULT',
  isTrashed: false,
  isPinned: false,
  isArchived: false,
  textContent: '',
  title: '',
  userEditedTimestampUsec: 1700000000000000,
  createdTimestampUsec: 1690000000000000,
  ...extra,
});

describe('parseGoogleKeep', () => {
  it('reads text, labels and pinned', () => {
    const r = parseGoogleKeep(
      JSON.stringify(
        note({
          title: 'Geschenkideen',
          textContent: 'Für Mama: Schal\nFür Papa: Käse',
          labels: [{ name: 'Familie' }, { name: 'Weihnachten Ü' }],
          isPinned: true,
        }),
      ),
    );
    expect(r.notes).toEqual([
      {
        title: 'Geschenkideen',
        body: 'Für Mama: Schal\nFür Papa: Käse\n\n#Familie #Weihnachten-Ü',
        tags: ['Familie', 'Weihnachten-Ü'],
        pinned: true,
      },
    ]);
  });

  it('turns checklists into a Markdown task list', () => {
    const r = parseGoogleKeep(
      JSON.stringify(
        note({
          title: 'Einkauf',
          listContent: [
            { text: 'Milch', isChecked: false },
            { text: 'Brot', isChecked: true },
            { text: '  ', isChecked: false },
          ],
        }),
      ),
    );
    expect(r.notes[0]?.body).toBe('- [ ] Milch\n- [x] Brot');
  });

  it('leaves out trash and archive and counts them', () => {
    const r = parseGoogleKeep(
      JSON.stringify([
        note({ title: 'Weg', isTrashed: true }),
        note({ title: 'Alt', isArchived: true }),
        note({ title: 'Bleibt' }),
        note({}),
      ]),
    );
    expect(r.notes.map((n) => n.title)).toEqual(['Bleibt']);
    expect(r.skipped).toBe(2);
    expect(r.empty).toBe(1);
  });

  it('flags files that are not Keep notes', () => {
    expect(parseGoogleKeep('kein json').invalid).toBe(true);
    expect(parseGoogleKeep('{"foo":1}').invalid).toBe(true);
    expect(parseGoogleKeep('').invalid).toBe(true);
    expect(parseGoogleKeep('[]').invalid).toBe(true);
  });
});
