/**
 * Release audit: proves that nothing secret ended up in files that are about to be published (or are
 * embedded into the installers). Erasable TypeScript, used by `../audit-release.mjs` and its unit test.
 *
 * Findings never contain the secret itself – only the file, the rule and (for secrets from the
 * environment) the *name* of the variable.
 */
import { inflateRawSync } from 'node:zlib';

export interface AuditFile {
  /** Path shown in findings. */
  name: string;
  data: Buffer;
}

export interface SecretInput {
  /** Environment variable the value came from (only the name is ever printed). */
  name: string;
  value: string;
}

export interface Finding {
  file: string;
  rule: string;
  detail?: string;
}

/** Secrets shorter than this are not searched for: too many accidental matches in binary data. */
const MIN_SECRET_LENGTH = 12;

const FORBIDDEN_NAME =
  /(^|[\\/])(\.env(\..*)?|.*\.(jks|keystore|p12|pfx|pem|key|sqlite3?|db)|id_rsa.*|.*private.*key.*)$/i;
/** Names that look forbidden but are meant to be public / test-only. */
const ALLOWED_NAME = /(^|[\\/])(\.env\.example|\.env\.e2e)$/i;

const text = (s: string) => Buffer.from(s, 'latin1');

/** Content markers of private key material (PEM, minisign/rsign secret key files, also base64-wrapped). */
const MARKERS: { rule: string; needle: Buffer }[] = [
  { rule: 'pem-private-key', needle: text('-----BEGIN ') },
  { rule: 'minisign-secret-key', needle: text('secret key') },
  {
    rule: 'tauri-secret-key-base64',
    needle: text(Buffer.from('untrusted comment: rsign encrypted secret key').toString('base64')),
  },
  {
    rule: 'tauri-secret-key-base64',
    needle: text(
      Buffer.from('untrusted comment: minisign encrypted secret key').toString('base64'),
    ),
  },
];

function pemIsPrivate(data: Buffer): boolean {
  return /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(data.toString('latin1'));
}

/** Every entry of a ZIP (APK, JAR, …) with its content; entries that cannot be read are skipped. */
export function zipEntries(buf: Buffer): AuditFile[] {
  const out: AuditFile[] = [];
  // End of central directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + compressed);
    try {
      out.push({
        name,
        data: method === 0 ? raw : method === 8 ? inflateRawSync(raw) : Buffer.alloc(0),
      });
    } catch {
      // damaged or unsupported entry – nothing to scan
    }
  }
  return out;
}

const isZip = (buf: Buffer) => buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;

/** Files plus, recursively, the contents of ZIP-like containers. */
export function expand(file: AuditFile, depth = 0): AuditFile[] {
  const list = [file];
  if (depth < 3 && isZip(file.data)) {
    for (const entry of zipEntries(file.data)) {
      list.push(...expand({ name: `${file.name}!${entry.name}`, data: entry.data }, depth + 1));
    }
  }
  return list;
}

/** The forms in which a secret could show up: as is, and (for base64 values such as a keystore) decoded. */
function secretNeedles(value: string): Buffer[] {
  const needles = [Buffer.from(value, 'utf8')];
  const compact = value.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=]{16,}$/.test(compact)) {
    const decoded = Buffer.from(compact, 'base64');
    if (decoded.length >= MIN_SECRET_LENGTH) needles.push(decoded);
    // Multi-line secrets (key files) are searched line by line, too.
  }
  for (const line of value.split(/\r?\n/)) {
    if (line.trim().length >= MIN_SECRET_LENGTH) needles.push(Buffer.from(line.trim(), 'utf8'));
  }
  return needles;
}

export function auditFiles(
  files: readonly AuditFile[],
  secrets: readonly SecretInput[],
): Finding[] {
  const findings: Finding[] = [];
  const searchable = secrets
    .filter((s) => s.value.trim().length >= MIN_SECRET_LENGTH)
    .map((s) => ({ name: s.name, needles: secretNeedles(s.value.trim()) }));

  for (const top of files) {
    for (const f of expand(top)) {
      const base = f.name.split('!').pop()!;
      if (FORBIDDEN_NAME.test(base) && !ALLOWED_NAME.test(base)) {
        findings.push({ file: f.name, rule: 'forbidden-file-name' });
      }
      if (pemIsPrivate(f.data)) findings.push({ file: f.name, rule: 'pem-private-key' });
      for (const m of MARKERS.filter((x) => x.rule !== 'pem-private-key')) {
        if (f.data.includes(m.needle)) {
          // "secret key" is a generic phrase (docs, licences): only flag it next to minisign/rsign wording.
          if (
            m.rule === 'minisign-secret-key' &&
            !/(minisign|rsign)[^\n]{0,40}secret key/i.test(f.data.toString('latin1'))
          ) {
            continue;
          }
          findings.push({ file: f.name, rule: m.rule });
        }
      }
      for (const s of searchable) {
        if (s.needles.some((n) => f.data.includes(n))) {
          findings.push({ file: f.name, rule: 'secret-value', detail: s.name });
        }
      }
    }
  }
  // De-duplicate identical findings.
  return [...new Map(findings.map((f) => [`${f.file}|${f.rule}|${f.detail}`, f])).values()];
}

/* ---- updater signatures ---- */

/** Key id (8 bytes, hex) of a minisign public key or signature given as Tauri stores it (base64 of the file text). */
export function minisignKeyId(base64OfFile: string): string | undefined {
  try {
    const lines = Buffer.from(base64OfFile.trim(), 'base64').toString('utf8').split(/\r?\n/);
    const raw = Buffer.from(lines[1] ?? '', 'base64');
    if (raw.length < 10) return undefined;
    // 2 bytes algorithm, then the 8-byte key id (little endian; shown big endian by minisign).
    return Buffer.from(raw.subarray(2, 10)).reverse().toString('hex').toUpperCase();
  } catch {
    return undefined;
  }
}

/** Every `.sig` must have been made with the key that belongs to the public key shipped in the app. */
export function checkSignatures(
  sigs: readonly { name: string; content: string }[],
  pubkeyBase64: string,
): Finding[] {
  const expected = minisignKeyId(pubkeyBase64);
  if (!expected) return [{ file: 'tauri.conf.json', rule: 'unreadable-public-key' }];
  const findings: Finding[] = [];
  for (const s of sigs) {
    const id = minisignKeyId(s.content);
    if (!id) findings.push({ file: s.name, rule: 'unreadable-signature' });
    else if (id !== expected) {
      findings.push({
        file: s.name,
        rule: 'signature-key-mismatch',
        detail: `${id} ≠ ${expected}`,
      });
    }
  }
  return findings;
}
