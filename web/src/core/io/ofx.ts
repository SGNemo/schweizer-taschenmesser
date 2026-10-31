/**
 * OFX bank statements, both flavours: the SGML of OFX 1.x (tags without closing tags, header lines
 * before `<OFX>`) and the XML of OFX 2.x. Only the statement transactions are read: `DTPOSTED`,
 * `TRNAMT`, `NAME`, `MEMO`, `FITID`, plus `CURDEF` and the account id. Pure function on text.
 */
import { parseLooseAmount } from './amount';
import type { BankParseResult, BankTransaction } from './bank';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function unescapeText(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The leaf tags of a fragment: `<TAG>value` up to the next tag, closing tags ignored. */
function leaves(fragment: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of fragment.matchAll(/<([A-Za-z][A-Za-z0-9.]*)>([^<]*)/g)) {
    const value = m[2]!.trim();
    const tag = m[1]!.toUpperCase();
    if (value !== '' && !out.has(tag)) out.set(tag, unescapeText(value));
  }
  return out;
}

/** `YYYYMMDD[HHMMSS[.XXX]][tz]` → 'YYYY-MM-DD'. */
function ofxDate(value: string | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec((value ?? '').trim());
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d)
    return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** True for a file that looks like OFX in either flavour (checked on the content, not the name). */
export function looksLikeOfx(text: string): boolean {
  const head = text.slice(0, 4000);
  return /<OFX[\s>]/i.test(head) || /^\s*OFXHEADER\s*:/i.test(head);
}

export function parseOfx(text: string): BankParseResult {
  const body = text.replace(/^\uFEFF/, '');
  if (!/<OFX[\s>]/i.test(body)) throw new Error('not-ofx');
  // One statement per STMTRS / CCSTMTRS; a file without them is read as a single statement.
  const parts = body.split(/<(?:CC)?STMTRS>/i);
  const statements = parts.length > 1 ? parts.slice(1) : [body];
  const transactions: BankTransaction[] = [];
  let skipped = 0;
  const seenFitIds = new Set<string>();
  for (const statement of statements) {
    const chunks = statement.split(/<STMTTRN>/i);
    const head = leaves(chunks[0] ?? '');
    const currency = (head.get('CURDEF') ?? 'EUR').toUpperCase();
    const accountId = (head.get('IBAN') ?? head.get('ACCTID') ?? '').replace(/\s/g, '');
    for (const raw of chunks.slice(1)) {
      const end = raw.search(/<\/STMTTRN>|<\/BANKTRANLIST>|<LEDGERBAL>|<\/STMTRS>|<\/CCSTMTRS>/i);
      const f = leaves(end >= 0 ? raw.slice(0, end) : raw);
      const date = ofxDate(f.get('DTPOSTED') ?? f.get('DTUSER'));
      const amountMinor = parseLooseAmount(f.get('TRNAMT') ?? '');
      if (!date || amountMinor === undefined || amountMinor === 0) {
        skipped += 1;
        continue;
      }
      const fitId = f.get('FITID');
      if (fitId) {
        // The same transaction id twice in one file is one booking listed twice.
        const key = `${accountId}\u0000${fitId}`;
        if (seenFitIds.has(key)) continue;
        seenFitIds.add(key);
      }
      const name = oneLine(f.get('NAME') ?? f.get('PAYEE') ?? '');
      const memo = oneLine(f.get('MEMO') ?? '');
      transactions.push({
        date,
        amountMinor,
        currency,
        payee: name,
        purpose: memo,
        ...(accountId ? { accountIban: accountId } : {}),
        ...(fitId ? { fitId } : {}),
      });
    }
  }
  return { transactions, skipped, format: 'ofx' };
}
