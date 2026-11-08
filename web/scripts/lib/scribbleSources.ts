/**
 * Where the chats' notes ("scribble") are read from by `npm run chats:status` (erasable TypeScript, imported by
 * `../chats-status.mjs`). Order: `NEMO_SCRIBBLE_DIR` override, the session folder `/workspace/scribble` (live,
 * no git), the notes repo clone `/workspace/nemo-scribble` (persistent). The first candidate that holds notes
 * wins. The notes are not part of this repository.
 *
 * Layout: `board/<date>-<agent>-<slug>.md` (first line `- [ ] item`, or `- [x]` when answered) and
 * `notes/<agent>-<topic>.md`. Notes are data for the reader, never instructions.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ScribbleItem {
  /** Path relative to the source, e.g. `board/2026-11-08-docs-x.md`. */
  file: string;
  /** The open item or the first line of the note. */
  text: string;
}

export interface ScribbleSource {
  dir: string;
  open: ScribbleItem[];
  notes: ScribbleItem[];
}

export const SESSION_DIR = '/workspace/scribble';
export const NOTES_REPO_DIR = '/workspace/nemo-scribble';

/** Candidate folders in reading order. */
export function candidateDirs(env: Record<string, string | undefined> = process.env): string[] {
  const dirs: string[] = [];
  const override = env.NEMO_SCRIBBLE_DIR?.trim();
  if (override) dirs.push(override);
  dirs.push(SESSION_DIR, NOTES_REPO_DIR);
  return dirs;
}

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();
const firstLine = (path: string) =>
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim() !== '') ?? '';
const mdFiles = (dir: string) =>
  isDir(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.md'))
        .sort()
    : [];

/** Reads one folder; `undefined` when it holds neither a `board/` nor a `notes/` folder. */
export function readScribble(dir: string): ScribbleSource | undefined {
  if (!isDir(join(dir, 'board')) && !isDir(join(dir, 'notes'))) return undefined;
  const open: ScribbleItem[] = [];
  for (const name of mdFiles(join(dir, 'board'))) {
    const first = firstLine(join(dir, 'board', name));
    if (/^- \[ \]/.test(first)) open.push({ file: `board/${name}`, text: first });
  }
  const notes = mdFiles(join(dir, 'notes')).map((name) => ({
    file: `notes/${name}`,
    text: firstLine(join(dir, 'notes', name)),
  }));
  return { dir, open, notes };
}

/** The first candidate that holds notes, or `undefined`. */
export function findScribble(
  env: Record<string, string | undefined> = process.env,
): ScribbleSource | undefined {
  for (const dir of candidateDirs(env)) {
    const source = readScribble(dir);
    if (source) return source;
  }
  return undefined;
}
