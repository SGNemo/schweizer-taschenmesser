/** Archives and folders as import input: ZIP is unpacked into text files, binaries are only counted. */
import { unzipSync, strFromU8 } from 'fflate';
import type { SourceFile } from './types';

/** Guards against archive bombs and runaway exports. */
export const LIMITS = {
  entries: 20000,
  /** Total bytes of the text files taken from an archive. */
  textBytes: 200 * 1024 * 1024,
  /** One text file. */
  fileBytes: 50 * 1024 * 1024,
} as const;

const TEXT = /\.(?:md|markdown|txt|json|csv|ics|vcf|vcard|enex|xml|opml|html?|qif|ofx|sta|mt940)$/i;

export interface ExpandedFiles {
  files: SourceFile[];
  /** Files that are not text (images, PDFs …): not stored, only counted for the report. */
  binary: number;
  /** Entries refused by the limits or unreadable. */
  refused: number;
}

export interface RawFile {
  name: string;
  bytes: Uint8Array;
}

/** `..`, absolute paths and drive letters never leave the archive. */
export function safePath(name: string): string | undefined {
  const path = name.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!path || /^[a-z]:/i.test(path) || path.split('/').includes('..')) return undefined;
  return path;
}

/** `.obsidian`, `.trash`, `.git` and other hidden files or folders of an export: settings, not content. */
export const isHiddenPath = (path: string): boolean =>
  path
    .replaceAll('\\', '/')
    .split('/')
    .some((seg) => seg.startsWith('.') && seg !== '.' && seg !== '..');

const isZip = (bytes: Uint8Array) =>
  bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03;

/**
 * Text of an export file: UTF-16 by its byte order mark (Excel "Unicode text"), else UTF-8, else
 * Windows-1252 (older German bank and Outlook exports). A leading BOM never reaches the parsers.
 * Exported for tests.
 */
export function decode(bytes: Uint8Array): string {
  const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return stripBom(new TextDecoder('utf-16le').decode(bytes));
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return stripBom(new TextDecoder('utf-16be').decode(bytes));
  const utf8 = strFromU8(bytes);
  return stripBom(utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(bytes) : utf8);
}

/**
 * Unpacks the chosen files. ZIPs (also nested one level is not followed) become one entry per text
 * file named `archive.zip/path`; other files are read as text when their name says so.
 * `onProgress(done, total)` is called per file; `cancelled()` stops early (the result is then discarded).
 */
export function expandFiles(
  raw: readonly RawFile[],
  hooks: { onProgress?: (done: number, total: number) => void; cancelled?: () => boolean } = {},
): ExpandedFiles {
  const out: ExpandedFiles = { files: [], binary: 0, refused: 0 };
  let textBytes = 0;
  const take = (name: string, bytes: Uint8Array) => {
    const path = safePath(name);
    // Binaries in hidden folders of an export (plugins, git objects, trash) are not counted as
    // attachments; hidden text files stay readable for detection (`.obsidian/app.json`).
    if (path && isHiddenPath(path) && !TEXT.test(path)) return;
    if (!path || bytes.length > LIMITS.fileBytes || textBytes + bytes.length > LIMITS.textBytes) {
      out.refused++;
      return;
    }
    if (!TEXT.test(path)) {
      out.binary++;
      return;
    }
    textBytes += bytes.length;
    out.files.push({ name: path, text: decode(bytes) });
  };
  let done = 0;
  for (const file of raw) {
    if (hooks.cancelled?.()) break;
    if (!isZip(file.bytes)) {
      take(file.name, file.bytes);
    } else {
      try {
        let seen = 0;
        const entries = unzipSync(file.bytes, {
          filter: (entry) => {
            if (entry.name.endsWith('/')) return false;
            if (isHiddenPath(entry.name) && !TEXT.test(entry.name)) return false;
            seen++;
            // Decide before inflating: too many entries or an oversized file never get unpacked.
            return seen <= LIMITS.entries && entry.originalSize <= LIMITS.fileBytes;
          },
        });
        if (seen > LIMITS.entries) out.refused += seen - LIMITS.entries;
        for (const [name, bytes] of Object.entries(entries)) take(`${file.name}/${name}`, bytes);
      } catch {
        out.refused++;
      }
    }
    hooks.onProgress?.(++done, raw.length);
  }
  return out;
}
