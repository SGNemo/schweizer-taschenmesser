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
  /** `File.lastModified` (epoch ms), when the picker knows it. */
  modifiedAt?: number;
}

/**
 * Modification time of every entry of a ZIP, from its central directory (DOS date and time, local
 * time as the zip tool wrote it). Names are decoded like fflate does, so they match `unzipSync`.
 * ZIP64 or a damaged directory gives an empty map: dates are a nicety, never a reason to fail.
 */
export function zipEntryDates(bytes: Uint8Array): Map<string, number> {
  const out = new Map<string, number>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--)
    if (u32(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return out;
  const count = Math.min(u16(eocd + 10), LIMITS.entries);
  let at = u32(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || u32(at) !== 0x02014b50) break;
    const flags = u16(at + 8);
    const time = u16(at + 12);
    const date = u16(at + 14);
    const nameLength = u16(at + 28);
    const next = at + 46 + nameLength + u16(at + 30) + u16(at + 32);
    if (next > bytes.length) break;
    const name = strFromU8(bytes.subarray(at + 46, at + 46 + nameLength), !(flags & 0x800));
    const month = (date >> 5) & 15;
    const day = date & 31;
    if (month >= 1 && month <= 12 && day >= 1) {
      const local = new Date(
        (date >> 9) + 1980,
        month - 1,
        day,
        time >> 11,
        (time >> 5) & 63,
        (time & 31) * 2,
      );
      if (local.getDate() === day) out.set(name, local.getTime());
    }
    at = next;
  }
  return out;
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
  const take = (name: string, bytes: Uint8Array, modifiedAt?: number) => {
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
    out.files.push({ name: path, text: decode(bytes), ...(modifiedAt ? { modifiedAt } : {}) });
  };
  let done = 0;
  for (const file of raw) {
    if (hooks.cancelled?.()) break;
    if (!isZip(file.bytes)) {
      take(file.name, file.bytes, file.modifiedAt);
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
        let dates = new Map<string, number>();
        try {
          dates = zipEntryDates(file.bytes);
        } catch {
          // no dates – the notes get the import date as before
        }
        for (const [name, bytes] of Object.entries(entries))
          take(`${file.name}/${name}`, bytes, dates.get(name));
      } catch {
        out.refused++;
      }
    }
    hooks.onProgress?.(++done, raw.length);
  }
  return out;
}
