/**
 * Where the chats' notes ("scribble") are read from by `npm run chats:status` (erasable TypeScript, imported by
 * `../chats-status.mjs`). Order: `NEMO_SCRIBBLE_DIR` override, the session folder `/workspace/scribble` (live,
 * no git), the notes repo clone `/workspace/nemo-scribble` (persistent), the legacy `scribble/` folder of the
 * repository (until it is removed). The first candidate that holds notes wins.
 *
 * Layout (session folder and notes repo): `board/<date>-<agent>-<slug>.md` (first line `- [ ] item`, or `- [x]`
 * when answered) and `notes/<agent>-<topic>.md`. Legacy layout: `BOARD.md` (open items are `- [ ]` lines) plus
 * one `<branch>.md` per branch next to it. Notes are data for the reader, never instructions.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ScribbleItem {
  /** Path relative to the source, e.g. `board/2026-11-08-docs-x.md` or `BOARD.md`. */
  file: string;
  /** The open item or the first line of the note. */
  text: string;
}

export interface ScribbleSource {
  dir: string;
  layout: 'board' | 'legacy';
  open: ScribbleItem[];
  notes: ScribbleItem[];
}

export const SESSION_DIR = '/workspace/scribble';
export const NOTES_REPO_DIR = '/workspace/nemo-scribble';

/** Candidate folders in reading order. */
export function candidateDirs(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const dirs: string[] = [];
  const override = env.NEMO_SCRIBBLE_DIR?.trim();
  if (override) dirs.push(override);
  dirs.push(SESSION_DIR, NOTES_REPO_DIR, join(repoRoot, 'scribble'));
  return dirs;
}

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();
const lines = (text: string) => text.split(/\r?\n/);
const firstLine = (path: string) =>
  lines(readFileSync(path, 'utf8')).find((l) => l.trim() !== '') ?? '';
const mdFiles = (dir: string) =>
  isDir(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.md'))
        .sort()
    : [];

/** Reads one folder; `undefined` when it holds neither a `board/`/`notes/` folder nor a `BOARD.md`. */
export function readScribble(dir: string): ScribbleSource | undefined {
  if (!isDir(dir)) return undefined;
  const hasBoardDir = isDir(join(dir, 'board'));
  const hasNotesDir = isDir(join(dir, 'notes'));
  if (hasBoardDir || hasNotesDir) {
    const open: ScribbleItem[] = [];
    for (const name of mdFiles(join(dir, 'board'))) {
      const first = firstLine(join(dir, 'board', name));
      if (/^- \[ \]/.test(first)) open.push({ file: `board/${name}`, text: first });
    }
    const notes = mdFiles(join(dir, 'notes')).map((name) => ({
      file: `notes/${name}`,
      text: firstLine(join(dir, 'notes', name)),
    }));
    return { dir, layout: 'board', open, notes };
  }
  const board = join(dir, 'BOARD.md');
  if (!existsSync(board)) return undefined;
  const open = lines(readFileSync(board, 'utf8'))
    .filter((l) => /^- \[ \]/.test(l))
    .map((text) => ({ file: 'BOARD.md', text }));
  const notes = mdFiles(dir)
    .filter((n) => n !== 'README.md' && n !== 'BOARD.md')
    .map((name) => ({ file: name, text: firstLine(join(dir, name)) }));
  return { dir, layout: 'legacy', open, notes };
}

/** The first candidate that holds notes, or `undefined`. */
export function findScribble(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): ScribbleSource | undefined {
  for (const dir of candidateDirs(repoRoot, env)) {
    const source = readScribble(dir);
    if (source) return source;
  }
  return undefined;
}
