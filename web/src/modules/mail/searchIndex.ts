/**
 * The search on this device: an index over what the mail cache already holds (sealed thread headers and
 * opened mails), built in memory when a search runs and never written anywhere – not to IndexedDB, not to
 * `localStorage`, not to a sync op, a backup, a bug report or a model. It is rebuilt when the cache changes
 * (row count or newest `updatedAt` differ) and is gone with the cache: deleting the mail cache or all data
 * leaves nothing to build it from, and `dropSearchIndex` forgets the copy in memory at once.
 *
 * Search syntax: free words (all must match, each in sender, subject, preview, text or an attachment name),
 * `"quoted phrases"`, and the Gmail operators this cache can answer (`from:`, `subject:`, `filename:`,
 * `label:`, `has:attachment`, `is:unread|read|starred|important`, `in:inbox`, `newer_than:`, `older_than:`,
 * `after:`, `before:`). Any other operator (`to:`, `cc:`, `size:` …) is something only the mailbox can answer:
 * the local part then says so instead of guessing.
 */
import { openJson } from '@/core/crypto/aead';
import type { MailMessage } from '@/core/mail/types';
import { getDeviceKey } from '@/core/secrets/deviceKey';
import { now } from '@/core/time/now';
import { loadThreads, type CachedThreadView } from './cache';
import { bodyRepo, threadRepo } from './repo';
import { dropSearchIndex, searchGeneration, searchMemory } from './searchMemory';

/* ---------------------------------------- text helpers ---------------------------------------- */

/** Lower case, no accents, `ß` → `ss`: „Müller“ and „muller“ find each other. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss');
}

/** Plain text of an HTML body for the index only (it is never shown or parsed as markup). */
const stripHtml = (html: string): string =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

/** Damerau-free edit distance with an early stop above `max` (names are short; this stays cheap). */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** How many typos a word of this length may carry when it is matched against a name. */
const typosFor = (len: number): number => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

/* ------------------------------------------- query ------------------------------------------- */

const DAY = 86_400_000;
const UNIT: Record<string, number> = { d: DAY, m: 30 * DAY, y: 365 * DAY };

export interface ParsedQuery {
  /** Free words and phrases, folded. */
  words: string[];
  from: string[];
  subject: string[];
  filename: string[];
  labels: string[];
  flags: { attachment?: true; unread?: boolean; starred?: true; important?: true; inbox?: true };
  /** Epoch ms bounds. */
  after?: number;
  before?: number;
  /** Operators only the mailbox can answer (`to:`, `size:` …): the local part stays silent. */
  unsupported: string[];
}

function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /(\S+?:)?"([^"]*)"|\S+/g;
  for (let m = re.exec(q); m; m = re.exec(q))
    out.push(m[2] !== undefined ? `${m[1] ?? ''}${m[2]}` : m[0]);
  return out;
}

const dateOf = (v: string): number | undefined => {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : undefined;
};

export function parseQuery(query: string): ParsedQuery {
  const p: ParsedQuery = {
    words: [],
    from: [],
    subject: [],
    filename: [],
    labels: [],
    flags: {},
    unsupported: [],
  };
  const at = now();
  for (const tok of tokenize(query.trim())) {
    const m = /^(-?)([a-z_]+):(.*)$/i.exec(tok);
    if (!m) {
      const w = fold(tok);
      if (w) p.words.push(w);
      continue;
    }
    const [, neg, rawOp, rawValue] = m;
    const op = rawOp!.toLowerCase();
    const value = fold(rawValue!);
    if (neg || !value) {
      p.unsupported.push(tok);
      continue;
    }
    if (op === 'from') p.from.push(value);
    else if (op === 'subject') p.subject.push(value);
    else if (op === 'filename') p.filename.push(value);
    else if (op === 'label') p.labels.push(value);
    else if (op === 'has' && value === 'attachment') p.flags.attachment = true;
    else if (op === 'is' && value === 'unread') p.flags.unread = true;
    else if (op === 'is' && value === 'read') p.flags.unread = false;
    else if (op === 'is' && value === 'starred') p.flags.starred = true;
    else if (op === 'is' && value === 'important') p.flags.important = true;
    else if (op === 'in' && value === 'inbox') p.flags.inbox = true;
    else if ((op === 'newer_than' || op === 'older_than') && /^\d+[dmy]$/.test(value)) {
      const ms = Number(value.slice(0, -1)) * UNIT[value.slice(-1)]!;
      if (op === 'newer_than') p.after = Math.max(p.after ?? 0, at - ms);
      else p.before = Math.min(p.before ?? Infinity, at - ms);
    } else if ((op === 'after' || op === 'before') && dateOf(value) !== undefined) {
      if (op === 'after') p.after = Math.max(p.after ?? 0, dateOf(value)!);
      else p.before = Math.min(p.before ?? Infinity, dateOf(value)!);
    } else p.unsupported.push(tok);
  }
  return p;
}

/* ------------------------------------------- index ------------------------------------------- */

interface Doc {
  thread: CachedThreadView;
  /** Folded fields. */
  name: string;
  email: string;
  /** Words of the sender's name and address (for typo-tolerant matching). */
  nameWords: string[];
  subject: string;
  snippet: string;
  text: string;
  /** Attachment names as shown, and folded. */
  files: string[];
  filesFolded: string[];
  /** Plain text of the opened mails (shown as the hit excerpt). */
  plain: string;
}

interface Built {
  signature: string;
  docs: Doc[];
}

const built = searchMemory as Map<string, Built>;
export { dropSearchIndex };

/** Changes whenever a cached row of the account is added, changed or removed (plus every write through `cache.ts`). */
async function signatureOf(accountKey: string): Promise<string> {
  // One bulk read per table (a cursor walk is far slower); only the envelope times are used.
  const [threads, bodies] = await Promise.all([
    threadRepo.table.where('accountKey').equals(accountKey).toArray(),
    bodyRepo.table.where('accountKey').equals(accountKey).toArray(),
  ]);
  let newest = 0;
  for (const r of [...threads, ...bodies]) newest = Math.max(newest, r.updatedAt, r.deletedAt ?? 0);
  return `${searchGeneration()}|${threads.length}|${bodies.length}|${newest}`;
}

/** Text and attachment names of the opened mails of an account, per thread. */
async function bodiesByThread(
  accountKey: string,
): Promise<Map<string, { text: string[]; files: string[] }>> {
  const rows = await bodyRepo
    .active()
    .filter((r) => r.accountKey === accountKey)
    .toArray();
  const out = new Map<string, { text: string[]; files: string[] }>();
  let key: CryptoKey | undefined;
  for (const r of rows) {
    let text = '';
    let files: string[] = [];
    if (r.demo) {
      text = r.demo.text ?? (r.demo.html ? stripHtml(r.demo.html) : '');
      files = r.demo.attachments ?? [];
    } else if (r.sealed) {
      try {
        key ??= await getDeviceKey();
        const m = (await openJson(key, r.id, r.sealed)) as MailMessage;
        text = m.text ?? (m.html ? stripHtml(m.html) : '');
        files = (m.attachments ?? []).map((a) => a.filename);
      } catch {
        continue; // sealed with a key this device no longer has
      }
    }
    const entry = out.get(r.threadId) ?? { text: [], files: [] };
    if (text) entry.text.push(text);
    entry.files.push(...files);
    out.set(r.threadId, entry);
  }
  return out;
}

async function buildIndex(accountKey: string): Promise<Doc[]> {
  const signature = await signatureOf(accountKey);
  const have = built.get(accountKey);
  if (have?.signature === signature) return have.docs;
  const [threads, bodies] = await Promise.all([
    loadThreads(accountKey),
    bodiesByThread(accountKey),
  ]);
  const docs = threads.map((thread): Doc => {
    const b = bodies.get(thread.id);
    const files = [...new Set(b?.files ?? [])];
    const name = fold(thread.from.name ?? '');
    const email = fold(thread.from.email);
    const plain = (b?.text ?? []).join('\n');
    return {
      thread: files.length && !thread.hasAttachment ? { ...thread, hasAttachment: true } : thread,
      name,
      email,
      nameWords: [...name.split(/[^\p{L}\p{N}]+/u), ...email.split(/[^\p{L}\p{N}]+/u)].filter(
        (w) => w.length >= 3,
      ),
      subject: fold(thread.subject),
      snippet: fold(thread.snippet),
      text: fold(plain),
      files,
      filesFolded: files.map(fold),
      plain,
    };
  });
  built.set(accountKey, { signature, docs });
  return docs;
}

/* ------------------------------------------- search ------------------------------------------- */

/** Where a hit was found besides the row's own lines: an attachment name or a piece of the text. */
export type HitLine = { kind: 'file'; text: string } | { kind: 'text'; text: string };

export interface LocalHit {
  thread: CachedThreadView;
  /** Shown under the row when the hit is not in sender, subject or preview. */
  line?: HitLine;
}

export interface LocalResult {
  hits: LocalHit[];
  /** Words to highlight (folded): free words plus `from:`/`subject:`/`filename:` values. */
  terms: string[];
  /** The query holds operators the device cannot answer: no local hits are claimed. */
  unsupported: string[];
  /** Mails the index looked through (the honest size of „auf diesem Gerät“). */
  searched: number;
}

const nameMatch = (d: Doc, word: string): boolean => {
  if (d.name.includes(word) || d.email.includes(word)) return true;
  const typos = typosFor(word.length);
  return typos > 0 && d.nameWords.some((w) => withinEdits(word, w, typos));
};

/** One free word: sender (typo-tolerant), subject, preview, text, attachment names. */
function wordHit(d: Doc, word: string): HitLine | true | false {
  if (nameMatch(d, word) || d.subject.includes(word) || d.snippet.includes(word)) return true;
  const file = d.filesFolded.findIndex((f) => f.includes(word));
  if (file >= 0) return { kind: 'file', text: d.files[file]! };
  if (d.text.includes(word)) return { kind: 'text', text: excerpt(d.plain, word) };
  return false;
}

/** About 90 characters of text around the first hit, on one line. */
function excerpt(plain: string, word: string): string {
  const flat = plain.replace(/\s+/g, ' ').trim();
  const at = fold(flat).indexOf(word);
  if (at < 0) return flat.slice(0, 90);
  const start = Math.max(0, at - 30);
  const end = Math.min(flat.length, at + word.length + 60);
  return `${start > 0 ? '… ' : ''}${flat.slice(start, end)}${end < flat.length ? ' …' : ''}`;
}

function matches(d: Doc, q: ParsedQuery): LocalHit | undefined {
  const t = d.thread;
  if (q.after !== undefined && t.date < q.after) return undefined;
  if (q.before !== undefined && t.date >= q.before) return undefined;
  if (q.flags.attachment && !t.hasAttachment) return undefined;
  if (q.flags.unread !== undefined && t.unread !== q.flags.unread) return undefined;
  if (q.flags.starred && !t.labelIds.includes('STARRED')) return undefined;
  if (q.flags.important && !t.labelIds.includes('IMPORTANT')) return undefined;
  if (q.flags.inbox && !t.labelIds.includes('INBOX')) return undefined;
  if (q.labels.some((l) => !t.labelIds.some((id) => fold(id) === l))) return undefined;
  if (q.from.some((w) => !nameMatch(d, w))) return undefined;
  if (q.subject.some((w) => !d.subject.includes(w))) return undefined;
  let line: HitLine | undefined;
  for (const w of q.filename) {
    const i = d.filesFolded.findIndex((f) => f.includes(w));
    if (i < 0) return undefined;
    line ??= { kind: 'file', text: d.files[i]! };
  }
  for (const w of q.words) {
    const hit = wordHit(d, w);
    if (hit === false) return undefined;
    if (hit !== true) line ??= hit;
  }
  return line ? { thread: t, line } : { thread: t };
}

/** Searches the cached mails of one account, newest first. An empty query finds nothing. */
export async function searchLocal(accountKey: string, query: string): Promise<LocalResult> {
  const q = parseQuery(query);
  const terms = [...q.words, ...q.from, ...q.subject, ...q.filename];
  if (q.unsupported.length > 0) return { hits: [], terms, unsupported: q.unsupported, searched: 0 };
  const docs = await buildIndex(accountKey);
  const empty =
    terms.length === 0 &&
    q.labels.length === 0 &&
    Object.keys(q.flags).length === 0 &&
    q.after === undefined &&
    q.before === undefined;
  if (empty) return { hits: [], terms, unsupported: [], searched: docs.length };
  const hits: LocalHit[] = [];
  for (const d of docs) {
    const h = matches(d, q);
    if (h) hits.push(h);
  }
  return { hits, terms, unsupported: [], searched: docs.length };
}

/* ----------------------------------------- highlight ----------------------------------------- */

/**
 * Splits `text` into plain and hit parts for the search terms (accent- and case-blind). The parts are
 * rendered as React text (`<mark>` around hits), never as HTML.
 */
export function highlightParts(
  text: string,
  terms: readonly string[],
): { text: string; hit: boolean }[] {
  const wanted = terms.filter((w) => w.length > 0);
  if (wanted.length === 0 || !text) return [{ text, hit: false }];
  // Folding keeps the length for Latin letters with accents (NFD + strip) except „ß“ → „ss“; map positions per char.
  const map: number[] = [];
  let folded = '';
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]!);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
  }
  const marks = new Array<boolean>(text.length).fill(false);
  for (const w of wanted) {
    for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + 1)) {
      for (let k = at; k < at + w.length; k++) marks[map[k]!] = true;
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === marks[i]) last.text += text[i];
    else out.push({ text: text[i]!, hit: marks[i]! });
  }
  return out;
}
