import { parseGoogleKeep } from '@/core/io/googleKeep';
import { parseMarkdownNote, type ParsedNote } from '@/core/io/markdownNote';
import type {
  ImportCandidate,
  ImportContext,
  ImportInput,
  ImporterRuntime,
} from '@/core/importer/types';
import { runJob } from '@/importers/run';
import { skipNotes } from '@/importers/report';
import { addSkip, type SkipCounts, type SourceFile } from '@/importers/types';
import { tImp } from '@/strings.importers';
import { t } from '@/strings';
import { noteKey } from './exchange';
import { noteRepo, notebookRepo } from './repo';

export { noteKey } from './exchange';

function candidate(note: ParsedNote, notebookId?: string, newNotebook?: string): ImportCandidate {
  const firstLine = note.body.split('\n').find((l) => l.trim()) ?? '';
  const label = note.title || firstLine.slice(0, 80);
  return {
    collection: 'note',
    data: {
      title: note.title,
      body: note.body,
      pinned: note.pinned ?? false,
      ...(notebookId ? { notebookId } : {}),
    },
    label,
    detail: note.title ? firstLine.slice(0, 80) : undefined,
    dedupeKey: noteKey(note.title, note.body),
    ...(newNotebook ? { dependsOn: newNotebook } : {}),
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

const isEnexFile = (f: SourceFile) =>
  /\.enex$/i.test(f.name) ||
  /^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<en-export[\s>]/i.test(f.text.slice(0, 1000));

/** Top-level folders of an import become notebooks: an existing one with the same name is reused. */
async function withNotebooks(notes: ParsedNote[], ctx: ImportContext): Promise<ImportCandidate[]> {
  const folders = [...new Set(notes.map((n) => n.folder).filter((f): f is string => !!f))];
  if (folders.length === 0) return notes.map((n) => candidate(n));
  const stored = await notebookRepo.active().toArray();
  let order = stored.reduce((max, nb) => Math.max(max, nb.order), 0);
  const ids = new Map<string, string>();
  const created = new Set<string>();
  const out: ImportCandidate[] = [];
  folders.forEach((name, i) => {
    const same = stored.find((nb) => nb.name.trim().toLowerCase() === name.toLowerCase());
    if (same) return void ids.set(name, same.id);
    const id = `imp-${ctx.batchId}-nb${i}`;
    ids.set(name, id);
    created.add(id);
    out.push({
      collection: 'notebook',
      id,
      data: { name, order: ++order },
      label: name,
      detail: tImp.get().newNotebook,
      dedupeKey: `notebook|${name.toLowerCase()}`,
    });
  });
  for (const note of notes) {
    const id = note.folder ? ids.get(note.folder) : undefined;
    out.push(candidate(note, id, id && created.has(id) ? id : undefined));
  }
  return out;
}

const runtime: ImporterRuntime = {
  async parse(_id, input: ImportInput, ctx) {
    const notes: ParsedNote[] = [];
    const hints: string[] = [];
    const skipped: SkipCounts = {};
    if (input.kind === 'text') {
      const note = parseMarkdownNote(input.text);
      if (note) notes.push(note);
    } else if (input.kind === 'file') {
      const files = input.files ?? [{ name: input.fileName, text: input.text }];
      const opts = { signal: ctx.signal, onProgress: ctx.progress };
      const enex = files.filter(isEnexFile);
      const rest = files.filter((f) => !isEnexFile(f));
      const keepFiles = rest.filter((f) => isKeepFile(f.name, f.text));
      const markdown = rest.filter((f) => !isKeepFile(f.name, f.text));
      let unreadable = 0;
      if (enex.length > 0) {
        const r = await runJob('enex', { files: enex }, opts);
        notes.push(...r.notes);
        unreadable += r.unreadable;
        for (const [reason, n] of Object.entries(r.skipped))
          addSkip(skipped, reason as keyof SkipCounts, n);
      }
      for (const file of keepFiles) {
        const keep = parseGoogleKeep(file.text);
        if (keep.invalid) unreadable++;
        notes.push(...keep.notes);
        addSkip(skipped, 'trashed', keep.skipped);
        addSkip(skipped, 'empty', keep.empty);
        addSkip(skipped, 'attachment', keep.attachments);
      }
      if (markdown.length > 0 || (input.binary ?? 0) > 0) {
        const md = await runJob('markdown', { files: markdown, binary: input.binary ?? 0 }, opts);
        notes.push(...md.notes);
        for (const [reason, n] of Object.entries(md.skipped))
          addSkip(skipped, reason as keyof SkipCounts, n);
      }
      addSkip(skipped, 'unreadable', unreadable);
    }
    hints.push(...skipNotes(skipped));
    return { candidates: await withNotebooks(notes, ctx), notes: hints, skipped };
  },
  async existingKeys(collection) {
    if (collection === 'notebook') return new Set();
    const rows = await noteRepo.active().toArray();
    return new Set(rows.map((r) => noteKey(r.title, r.body)));
  },
};

export default runtime;
