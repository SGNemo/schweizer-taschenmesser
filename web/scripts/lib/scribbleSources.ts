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
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  statSync,
} from 'node:fs';
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
  fixedDirs: readonly string[] = [SESSION_DIR, NOTES_REPO_DIR],
): string[] {
  const dirs: string[] = [];
  const override = env.NEMO_SCRIBBLE_DIR?.trim();
  if (override) dirs.push(override);
  dirs.push(...fixedDirs, join(repoRoot, 'scribble'));
  return dirs;
}

/**
 * The notes come from other agents (and a git clone of the notes repo keeps whatever was committed), so every
 * read is defensive: only real directories and regular files are followed (no symlinks, devices, FIFOs),
 * files are opened without following links and read up to a fixed size, and what is printed has its control
 * characters replaced (a note must not be able to drive the terminal).
 */
const FIRST_LINE_BYTES = 4096;
const BOARD_BYTES = 1024 * 1024;
const MAX_FILES = 500;
const OPEN_ITEM_CHARS = 200;
const NOTE_CHARS = 100;

/** Control characters (C0, DEL, C1), line/paragraph separators and bidi overrides become a space. */
export function clean(text: string): string {
  return Array.from(text, (ch) => {
    const c = ch.codePointAt(0)!;
    const bad =
      c < 0x20 ||
      (c >= 0x7f && c <= 0x9f) ||
      c === 0x2028 ||
      c === 0x2029 ||
      (c >= 0x200b && c <= 0x200f) ||
      (c >= 0x202a && c <= 0x202e) ||
      (c >= 0x2066 && c <= 0x2069);
    return bad ? ' ' : ch;
  }).join('');
}
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

const lstatOf = (p: string) => {
  try {
    return lstatSync(p);
  } catch {
    return undefined;
  }
};
/** A real directory; a symlink to a directory is not one. */
const isRealDir = (p: string) => lstatOf(p)?.isDirectory() === true;
const lines = (text: string) => text.split(/\r?\n/);

/** Up to `max` bytes of a regular file, opened without following links; `undefined` for anything else. */
function readHead(path: string, max: number): string | undefined {
  if (lstatOf(path)?.isFile() !== true) return undefined;
  let fd: number | undefined;
  try {
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
    fd = openSync(path, flags);
    if (!fstatSync(fd).isFile()) return undefined;
    const buffer = Buffer.alloc(max);
    const read = readSync(fd, buffer, 0, max, 0);
    return buffer.toString('utf8', 0, read);
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

const firstLine = (path: string) =>
  lines(readHead(path, FIRST_LINE_BYTES) ?? '').find((l) => l.trim() !== '') ?? '';

/** Names of the regular `.md` files directly in `dir` (never links, devices, FIFOs), capped and sorted. */
function mdFiles(dir: string): string[] {
  if (!isRealDir(dir)) return [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.md') && lstatOf(join(dir, n))?.isFile() === true)
    .sort()
    .slice(0, MAX_FILES);
}

/** Reads one folder; `undefined` when it holds neither a `board/`/`notes/` folder nor a `BOARD.md`. */
export function readScribble(dir: string): ScribbleSource | undefined {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return undefined;
  if (isRealDir(join(dir, 'board')) || isRealDir(join(dir, 'notes'))) {
    const open: ScribbleItem[] = [];
    for (const name of mdFiles(join(dir, 'board'))) {
      const first = firstLine(join(dir, 'board', name));
      if (/^- \[ \]/.test(first)) {
        open.push({ file: clean(`board/${name}`), text: clip(clean(first), OPEN_ITEM_CHARS) });
      }
    }
    const notes = mdFiles(join(dir, 'notes')).map((name) => ({
      file: clean(`notes/${name}`),
      text: clip(clean(firstLine(join(dir, 'notes', name))), NOTE_CHARS),
    }));
    return { dir, layout: 'board', open, notes };
  }
  const board = readHead(join(dir, 'BOARD.md'), BOARD_BYTES);
  if (board === undefined) return undefined;
  const open = lines(board)
    .filter((l) => /^- \[ \]/.test(l))
    .slice(0, MAX_FILES)
    .map((text) => ({ file: 'BOARD.md', text: clip(clean(text), OPEN_ITEM_CHARS) }));
  const notes = mdFiles(dir)
    .filter((n) => n !== 'README.md' && n !== 'BOARD.md')
    .map((name) => ({
      file: clean(name),
      text: clip(clean(firstLine(join(dir, name))), NOTE_CHARS),
    }));
  return { dir, layout: 'legacy', open, notes };
}

/** The first candidate that holds notes, or `undefined`. */
export function findScribble(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
  fixedDirs: readonly string[] = [SESSION_DIR, NOTES_REPO_DIR],
): ScribbleSource | undefined {
  for (const dir of candidateDirs(repoRoot, env, fixedDirs)) {
    const source = readScribble(dir);
    if (source) return source;
  }
  return undefined;
}
