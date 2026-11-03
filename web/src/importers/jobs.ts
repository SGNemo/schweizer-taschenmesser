/** The heavy, pure steps of an import. Run in a Worker (`run.ts`) or inline (tests, no Worker). */
import type { ParsedNote } from '@/core/io/markdownNote';
import { parseEnex } from './enex/parse';
import { expandFiles, type ExpandedFiles, type RawFile } from './files';
import { parseMarkdownFolder, type MarkdownFolderResult } from './obsidian/parse';
import { addSkip, type SkipCounts, type SourceFile } from './types';

export interface EnexJobResult {
  notes: ParsedNote[];
  skipped: SkipCounts;
  /** Files that were no Evernote export. */
  unreadable: number;
}

export interface Jobs {
  expand: { in: { files: RawFile[] }; out: ExpandedFiles };
  enex: { in: { files: SourceFile[] }; out: EnexJobResult };
  markdown: { in: { files: SourceFile[]; binary: number }; out: MarkdownFolderResult };
}

export type JobName = keyof Jobs;
export type Progress = (done: number, total: number) => void;

export const JOBS: {
  [K in JobName]: (input: Jobs[K]['in'], progress: Progress) => Jobs[K]['out'];
} = {
  expand: ({ files }, progress) => expandFiles(files, { onProgress: progress }),
  enex({ files }, progress) {
    const out: EnexJobResult = { notes: [], skipped: {}, unreadable: 0 };
    files.forEach((file, i) => {
      const r = parseEnex(file.text);
      if (r.invalid) out.unreadable++;
      out.notes.push(...r.notes);
      for (const [reason, n] of Object.entries(r.skipped))
        addSkip(out.skipped, reason as keyof SkipCounts, n);
      progress(i + 1, files.length);
    });
    return out;
  },
  markdown: ({ files, binary }, progress) => {
    const r = parseMarkdownFolder(files, { binary });
    progress(1, 1);
    return r;
  },
};
