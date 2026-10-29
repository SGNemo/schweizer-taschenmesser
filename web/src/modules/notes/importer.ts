import { parseGoogleKeep } from '@/core/io/googleKeep';
import { parseMarkdownNote, parseMarkdownNotes, type ParsedNote } from '@/core/io/markdownNote';
import type { ImportCandidate, ImportInput, ImporterRuntime } from '@/core/importer/types';
import { t } from '@/strings';
import { noteRepo } from './repo';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Same title and the same first 80 characters of text = the same note. */
export const noteKey = (title: string, body: string) => `${norm(title)}|${norm(body).slice(0, 80)}`;

function candidate(note: ParsedNote): ImportCandidate {
  const firstLine = note.body.split('\n').find((l) => l.trim()) ?? '';
  const label = note.title || firstLine.slice(0, 80);
  return {
    collection: 'note',
    data: { title: note.title, body: note.body, pinned: note.pinned ?? false },
    label,
    detail: note.title ? firstLine.slice(0, 80) : undefined,
    dedupeKey: noteKey(note.title, note.body),
  };
}

const parsesAsJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** `.json` is Keep; a file of unknown type is Keep only when it really is JSON (a note starting with `[[Link]]` is Markdown). */
const isKeepFile = (name: string, text: string) =>
  /\.json$/i.test(name) ||
  (!/\.(?:md|markdown|txt)$/i.test(name) && /^\s*[[{]/.test(text) && parsesAsJson(text));

const runtime: ImporterRuntime = {
  parse(_id, input: ImportInput) {
    const notes: ParsedNote[] = [];
    const hints: string[] = [];
    if (input.kind === 'text') {
      const note = parseMarkdownNote(input.text);
      if (note) notes.push(note);
    } else if (input.kind === 'file') {
      const files = input.files ?? [{ name: input.fileName, text: input.text }];
      const markdown = files.filter((f) => !isKeepFile(f.name, f.text));
      let keepSkipped = 0;
      let unreadable = 0;
      for (const file of files.filter((f) => isKeepFile(f.name, f.text))) {
        const keep = parseGoogleKeep(file.text);
        if (keep.invalid) unreadable++;
        notes.push(...keep.notes);
        keepSkipped += keep.skipped;
      }
      const md = parseMarkdownNotes(markdown);
      notes.push(...md.notes);
      if (md.empty) hints.push(t.onboarding.notes.emptyFiles(md.empty));
      if (keepSkipped) hints.push(t.onboarding.notes.keepSkipped(keepSkipped));
      if (unreadable) hints.push(t.onboarding.notes.unreadable(unreadable));
    }
    return { candidates: notes.map(candidate), notes: hints };
  },
  async existingKeys() {
    const rows = await noteRepo.active().toArray();
    return new Set(rows.map((r) => noteKey(r.title, r.body)));
  },
};

export default runtime;
